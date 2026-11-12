// End-to-end automatic production (US1, mode "auto"): prompt -> MP4(s) with voice, captions, music, SFX, QA,
// and a per-step usage/cost log. The work is split into stages that persist their state in the work dir, so
// the same code runs in-process (CLI) or as one BullMQ job per stage on the ai / audio / render workers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_VERSION, type StoryboardOutput } from "@makvid/ai";
import type { AspectRatio, VideoSpec } from "@makvid/spec";
import { mixAudio, pickMusic, musicLibrary, musicPath, sfxLibrary, sfxPath } from "@makvid/media";
import { narrate } from "@makvid/tts";
import { StepCache, type PipelineContext, type Step, type UsageEntry } from "./context";
import { ingest, storyboard, suggestStyles, writeScript, type ScriptResult } from "./steps/ai";
import { applyNarration, buildSpec, musicMoods, videoDurationMs } from "./steps/build";
import { qaAndFix, renderAll, type RenderedAspect } from "./steps/render";

export interface ProduceInput {
  prompt: string;
  aspects: AspectRatio[];
  durationSec?: number;
  styleId?: string; // forces a style; otherwise the top suggestion
}

export const STAGES = ["script", "style", "storyboard", "audio", "qa", "render"] as const;
export type Stage = (typeof STAGES)[number];
/** Which worker queue runs each stage. */
export const STAGE_QUEUE: Record<Stage, "ai" | "audio" | "render"> = {
  script: "ai",
  style: "ai",
  storyboard: "ai",
  audio: "audio",
  qa: "render",
  render: "render",
};

export interface ProduceState {
  input: ProduceInput;
  script?: ScriptResult;
  styleSuggestions?: Array<{ styleId: string; reason: string }>;
  styleId?: string;
  board?: StoryboardOutput;
  spec?: VideoSpec;
  musicId?: string;
  mixedWav?: string;
  loudnessLufs?: number;
  qa?: { passed: boolean; attempts: number; issues: number };
  outputs?: RenderedAspect[];
  usage: UsageEntry[];
}

export interface ProduceResult {
  status: "ready" | "needs_attention";
  title: string;
  styleId: string;
  styleSuggestions: Array<{ styleId: string; reason: string }>;
  spec: VideoSpec;
  outputs: RenderedAspect[];
  qa: { passed: boolean; attempts: number; issues: number };
  loudnessLufs: number;
  usage: UsageEntry[];
  costUsd: number;
  seconds: number;
}

const stateFile = (workDir: string) => join(workDir, "state.json");
export function loadState(workDir: string): ProduceState | undefined {
  return existsSync(stateFile(workDir))
    ? (JSON.parse(readFileSync(stateFile(workDir), "utf8")) as ProduceState)
    : undefined;
}
function saveState(workDir: string, s: ProduceState) {
  mkdirSync(workDir, { recursive: true });
  writeFileSync(stateFile(workDir), JSON.stringify(s, null, 2));
}

/** Run one stage against the persisted state (idempotent: AI/TTS calls are cached by input). */
export async function runStage(
  ctx0: PipelineContext,
  stage: Stage,
  input: ProduceInput,
  opts: { cacheDir?: string } = {},
): Promise<ProduceState> {
  const state: ProduceState = loadState(ctx0.workDir) ?? { input, usage: [] };
  const ctx: PipelineContext = { ...ctx0, onUsage: (u) => (state.usage.push(u), ctx0.onUsage(u)) };
  const cache = new StepCache(join(ctx.workDir, "steps"));
  const durationSec = input.durationSec ?? 45;
  const p = (step: Step, key: string, fraction: number, params?: Record<string, string | number>) =>
    ctx.onProgress({ step, key, fraction, ...(params ? { params } : {}) });
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`stage "${stage}" needs ${what}; run the previous stage first`);
    return v;
  };

  switch (stage) {
    case "script": {
      p("ingest", "progress.ingest", 0.02);
      const source = ingest(input.prompt);
      p("script", "progress.script", 0.05);
      state.script = await cache.run("script", { source, durationSec, v: PROMPT_VERSION }, () =>
        writeScript(ctx, source, durationSec),
      );
      break;
    }
    case "style": {
      p("style_suggest", "progress.style", 0.15);
      const script = need(state.script, "the script");
      state.styleSuggestions = await cache.run("style_suggest", { script, v: PROMPT_VERSION }, () =>
        suggestStyles(ctx, script),
      );
      state.styleId = input.styleId ?? state.styleSuggestions[0]!.styleId;
      break;
    }
    case "storyboard": {
      p("storyboard", "progress.storyboard", 0.2);
      const script = need(state.script, "the script");
      const styleId = need(state.styleId, "a style");
      state.board = await cache.run("storyboard", { script, styleId, v: PROMPT_VERSION }, () =>
        storyboard(ctx, script, styleId),
      );
      const music = pickMusic({ moods: musicMoods(ctx.stylesRoot, styleId) });
      state.musicId = music.id;
      state.spec = buildSpec({
        prompt: input.prompt,
        script,
        board: state.board,
        styleId,
        aspects: input.aspects,
        durationSec,
        voiceId: ctx.voiceId,
        musicTrackId: music.id,
      });
      break;
    }
    case "audio": {
      p("tts", "progress.voice", 0.35);
      let spec = need(state.spec, "a storyboard");
      const parts = spec.script.map((s) => ({ scriptId: s.id, text: s.text }));
      const nar = await cache.run("tts", { parts, voice: ctx.voiceId }, async () => {
        const n = await narrate(parts, { tts: ctx.tts, aligner: ctx.aligner, voiceId: ctx.voiceId });
        ctx.onUsage({
          step: "tts",
          provider: ctx.tts.id,
          model: ctx.voiceId,
          ttsChars: n.chars,
          costUsd: n.costUsd,
        });
        const { wav, ...rest } = n;
        return { ...rest, wavB64: wav.toString("base64") };
      });
      const narrationFile = join(ctx.workDir, "narration.wav");
      writeFileSync(narrationFile, Buffer.from(nar.wavB64, "base64"));
      spec = applyNarration(spec, nar.words, nar.parts, nar.durationMs);
      p("tts", "progress.mix", 0.5);
      const sfx = sfxLibrary();
      const music = musicLibrary().find((m) => m.id === state.musicId) ?? musicLibrary()[0]!;
      const mixed = await mixAudio({
        narrationWav: narrationFile,
        durationMs: videoDurationMs(spec),
        musicFile: musicPath(music),
        sfx: spec.audio.sfx.map((s) => ({
          file: sfxPath(sfx.find((x) => x.id === s.sfxId) ?? sfx[0]!),
          atMs: s.atMs,
          gainDb: s.gainDb ?? -16,
        })),
        outWav: join(ctx.workDir, "mix.wav"),
      });
      state.spec = spec;
      state.mixedWav = mixed.outWav;
      state.loudnessLufs = mixed.integratedLufs;
      break;
    }
    case "qa": {
      p("qa", "progress.qa", 0.6);
      const qa = await qaAndFix(ctx, need(state.spec, "a timed spec"));
      state.spec = qa.spec;
      state.qa = { passed: qa.passed, attempts: qa.attempts, issues: qa.issues.length };
      writeFileSync(join(ctx.workDir, "spec.json"), JSON.stringify(qa.spec, null, 2));
      break;
    }
    case "render": {
      p("render_scene", "progress.render", 0.75);
      state.outputs = await renderAll(
        ctx,
        need(state.spec, "a checked spec"),
        need(state.mixedWav, "the mixed audio"),
        join(ctx.workDir, "out"),
        opts.cacheDir ?? join(ctx.workDir, "render-cache"),
      );
      p("mux", "progress.done", 1);
      break;
    }
  }
  saveState(ctx.workDir, state);
  return state;
}

export function resultFromState(state: ProduceState, seconds: number): ProduceResult {
  const usage = state.usage;
  return {
    status: state.qa?.passed ? "ready" : "needs_attention",
    title: state.script?.title ?? "",
    styleId: state.styleId ?? "",
    styleSuggestions: state.styleSuggestions ?? [],
    spec: state.spec!,
    outputs: state.outputs ?? [],
    qa: state.qa ?? { passed: false, attempts: 0, issues: 0 },
    loudnessLufs: state.loudnessLufs ?? NaN,
    usage,
    costUsd: Math.round(usage.reduce((a, u) => a + (u.costUsd ?? 0), 0) * 1e6) / 1e6,
    seconds,
  };
}

/** In-process run of every stage (CLI, tests). Usage counts only this run's new calls. */
export async function produceVideo(
  ctx: PipelineContext,
  input: ProduceInput,
  opts: { cacheDir?: string } = {},
): Promise<ProduceResult> {
  const t0 = performance.now();
  const prev = loadState(ctx.workDir);
  if (prev) saveState(ctx.workDir, { ...prev, input, usage: [] });
  let state: ProduceState | undefined;
  for (const s of STAGES) state = await runStage(ctx, s, input, opts);
  return resultFromState(state!, Math.round((performance.now() - t0) / 100) / 10);
}
