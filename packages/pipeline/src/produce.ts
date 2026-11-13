// End-to-end production: prompt -> MP4(s) with voice, captions, music, SFX, QA, and a per-step usage/cost log.
// Mode "auto" (US1) runs every stage; mode "review" (US3) pauses after script + style suggestions and after the
// storyboard (thumbnail grid) until the user accepts or edits. The work is split into stages that persist their state in the work dir, so
// the same code runs in-process (CLI) or as one BullMQ job per stage on the ai / audio / render workers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_VERSION, type StoryboardOutput } from "@makvid/ai";
import type { BrandKit } from "@makvid/compiler";
import type { AspectRatio, VideoSpec } from "@makvid/spec";
import {
  BuiltinMusicProvider,
  ingestMedia,
  mixAudio,
  sfxLibrary,
  sfxPath,
  type MusicChoice,
} from "@makvid/media";
import { narrate } from "@makvid/tts";
import { hashOf, StepCache, type PipelineContext, type Step, type UsageEntry } from "./context";
import {
  ingest,
  scriptFromSource,
  storyboard,
  styleOptions,
  suggestStyles,
  writeScript,
  type ScriptResult,
  type SourceMaterial,
} from "./steps/ai";
import { applyNarration, applySourceData, buildSpec, musicMoods, videoDurationMs } from "./steps/build";
import { storyboardPreview, type ScenePreview } from "./steps/preview";
import { qaAndFix, renderAll, type RenderedAspect } from "./steps/render";
import { narrationFromSource } from "./steps/source-narration";

export interface ProduceInput {
  prompt: string;
  aspects: AspectRatio[];
  durationSec?: number;
  styleId?: string; // forces a style; otherwise the top suggestion
  /** "auto" (default) never pauses; "review" pauses for the user twice (US3). */
  mode?: "auto" | "review";
  /** Already-ingested source (script, article, GitHub, table, media); `prompt` is then a short label. */
  source?: SourceMaterial;
  /** Uploaded audio/video in the work dir: transcribed (whisper + MFA) by the script stage on the worker. */
  mediaFile?: string;
  /** kind "media": keep the original voice (transcript narrated verbatim, no TTS). */
  useSourceAudio?: boolean;
  /** Brand kit (US8) resolved to local files in the work dir. */
  brand?: BrandKit;
  /** Voice chosen by the user (voice picker); defaults to the context voice. */
  voiceId?: string;
}

export const STAGES = ["script", "style", "storyboard", "audio", "qa", "render"] as const;
export type Stage = (typeof STAGES)[number] | "preview";
export type ReviewPoint = "script_review" | "storyboard_review";

/**
 * Stages grouped into segments that run without stopping. Auto: one segment. Review: script + style
 * suggestions -> pause (script_review) -> storyboard + thumbnail grid -> pause (storyboard_review) -> the rest.
 */
export function produceSegments(mode: ProduceInput["mode"] = "auto"): Stage[][] {
  return mode === "review"
    ? [
        ["script", "style"],
        ["storyboard", "preview"],
        ["audio", "qa", "render"],
      ]
    : [[...STAGES]];
}
const PAUSE_AFTER: Partial<Record<Stage, ReviewPoint>> = {
  style: "script_review",
  preview: "storyboard_review",
};
const NEEDS_APPROVAL: Partial<Record<Stage, ReviewPoint>> = {
  storyboard: "script_review",
  audio: "storyboard_review",
};
/** Which worker queue runs each stage. */
export const STAGE_QUEUE: Record<Stage, "ai" | "audio" | "render"> = {
  script: "ai",
  style: "ai",
  storyboard: "ai",
  preview: "render",
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
  music?: MusicChoice;
  mixedWav?: string;
  loudnessLufs?: number;
  qa?: { passed: boolean; attempts: number; issues: number };
  outputs?: RenderedAspect[];
  /** Ingested source (US4), kept for later stages (chart data, source audio). */
  source?: SourceMaterial;
  /** Review mode: the point the pipeline is waiting at (cleared when the user resumes). */
  awaiting?: ReviewPoint;
  approved?: ReviewPoint[];
  /** Storyboard thumbnail grid (review mode). */
  previews?: ScenePreview[];
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
export function saveState(workDir: string, s: ProduceState) {
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
  const ctx: PipelineContext = {
    ...ctx0,
    voiceId: input.voiceId ?? ctx0.voiceId,
    ...(input.brand ? { brand: input.brand } : {}),
    onUsage: (u) => (state.usage.push(u), ctx0.onUsage(u)),
  };
  const cache = new StepCache(join(ctx.workDir, "steps"));
  const durationSec = input.durationSec ?? 45;
  const p = (step: Step, key: string, fraction: number, params?: Record<string, string | number>) =>
    ctx.onProgress({ step, key, fraction, ...(params ? { params } : {}) });
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`stage "${stage}" needs ${what}; run the previous stage first`);
    return v;
  };

  const gate = input.mode === "review" ? NEEDS_APPROVAL[stage] : undefined;
  if (gate && !state.approved?.includes(gate))
    throw new Error(`stage "${stage}" waits for the user (${gate}); resume the project first`);

  switch (stage) {
    case "script": {
      p("ingest", "progress.ingest", 0.02);
      const source =
        state.source ??
        input.source ??
        (input.mediaFile
          ? await ingestMedia(input.mediaFile, { speech: ctx.aligner, workDir: join(ctx.workDir, "source") })
          : ingest(input.prompt));
      state.source = source;
      p("script", "progress.script", 0.05);
      state.script =
        source.kind === "script" || (source.kind === "media" && input.useSourceAudio)
          ? scriptFromSource(source) // the user's narration (or the recording's transcript), word for word
          : await cache.run("script", { source: source.markdown, durationSec, v: PROMPT_VERSION }, () =>
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
      const moods = musicMoods(ctx.stylesRoot, styleId);
      const provider = ctx.music ?? new BuiltinMusicProvider();
      const minDurationMs = durationSec * 1000;
      const seed = Number.parseInt(hashOf(input.prompt).slice(0, 8), 16);
      let music: MusicChoice;
      try {
        music = await provider.choose({ moods, minDurationMs, seed });
      } catch {
        music = await new BuiltinMusicProvider().choose({ moods }); // catalog unavailable -> project-owned bed
      }
      state.music = music;
      state.spec = buildSpec({
        prompt: input.prompt,
        script,
        board: state.board,
        styleId,
        aspects: input.aspects,
        durationSec,
        voiceId: ctx.voiceId,
        musicTrackId: `${music.provider}:${music.trackId}`,
      });
      if (state.source) state.spec = applySourceData(state.spec, state.source);
      break;
    }
    case "preview": {
      p("storyboard", "progress.preview", 0.25);
      state.previews = await storyboardPreview(ctx, need(state.spec, "a storyboard"));
      break;
    }
    case "audio": {
      p("tts", "progress.voice", 0.35);
      let spec = need(state.spec, "a storyboard");
      const parts = spec.script.map((s) => ({ scriptId: s.id, text: s.text }));
      const fromSource = input.useSourceAudio && state.source?.kind === "media";
      const nar = fromSource
        ? (() => {
            const n = narrationFromSource(spec, state.source!);
            const { wav, ...rest } = n;
            return { ...rest, chars: 0, costUsd: 0, wavB64: wav.toString("base64") };
          })()
        : await cache.run("tts", { parts, voice: ctx.voiceId }, async () => {
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
      const choice = state.music ?? (await new BuiltinMusicProvider().choose({ moods: [] }));
      let musicFile: string;
      try {
        musicFile = await (
          choice.provider === "builtin"
            ? new BuiltinMusicProvider()
            : (ctx.music ?? new BuiltinMusicProvider())
        ).fetchAudio(choice, join(ctx.workDir, "music.audio"));
      } catch {
        const fb = await new BuiltinMusicProvider().choose({ moods: [] });
        state.music = fb;
        musicFile = await new BuiltinMusicProvider().fetchAudio(fb);
      }
      const mixed = await mixAudio({
        narrationWav: narrationFile,
        durationMs: videoDurationMs(spec),
        musicFile,
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
  if (input.mode === "review" && PAUSE_AFTER[stage]) state.awaiting = PAUSE_AFTER[stage];
  saveState(ctx.workDir, state);
  return state;
}

/** Edits the user makes at the script review (all optional: an empty object accepts as is). */
export interface ScriptReview {
  title?: string;
  sentences?: string[];
  /** One of the suggestions (or any installed style). */
  styleId?: string;
}
/** Edits at the storyboard review. */
export interface StoryboardReview {
  /** Scenes to remove; narration used only by those scenes is removed too. */
  dropSceneIds?: string[];
}

function awaiting(workDir: string, point: ReviewPoint): ProduceState {
  const state = loadState(workDir);
  if (!state || state.awaiting !== point)
    throw new Error(`project is not waiting for ${point} (now: ${state?.awaiting ?? "nothing"})`);
  return state;
}

/** Apply the user's script review and approve it; the next segment can then run. */
export function applyScriptReview(stylesRoot: string, workDir: string, review: ScriptReview): ProduceState {
  const state = awaiting(workDir, "script_review");
  const script = state.script!;
  if (review.sentences) {
    const sentences = review.sentences.map((x) => x.normalize("NFC").trim()).filter(Boolean);
    if (!sentences.length) throw new Error("the script needs at least one sentence");
    script.sentences = sentences;
  }
  if (review.title?.trim()) script.title = review.title.normalize("NFC").trim();
  if (review.styleId) {
    if (!styleOptions(stylesRoot).some((o) => o.id === review.styleId))
      throw new Error(`unknown style "${review.styleId}"`);
    state.styleId = review.styleId;
  }
  delete state.board;
  delete state.spec;
  delete state.previews;
  delete state.awaiting;
  state.approved = [...(state.approved ?? []), "script_review"];
  saveState(workDir, state);
  return state;
}

/** Apply the user's storyboard review (drop scenes) and approve it. */
export function applyStoryboardReview(workDir: string, review: StoryboardReview): ProduceState {
  const state = awaiting(workDir, "storyboard_review");
  const spec = state.spec!;
  const drop = new Set(review.dropSceneIds ?? []);
  const unknown = [...drop].filter((id) => !spec.scenes.some((s) => s.id === id));
  if (unknown.length) throw new Error(`unknown scene ${unknown.join(", ")}`);
  const scenes = spec.scenes.filter((s) => !drop.has(s.id));
  if (!scenes.length) throw new Error("the video needs at least one scene");
  const used = new Set(scenes.flatMap((s) => s.scriptRefs));
  state.spec = {
    ...spec,
    script: spec.script.filter((x) => used.has(x.id)),
    scenes: scenes.map((s, i) => {
      if (i > 0 || !s.transitionIn) return s;
      const first = { ...s };
      delete first.transitionIn; // the opening scene has no transition in
      return first;
    }),
  };
  state.previews = state.previews?.filter((p) => !drop.has(p.sceneId));
  delete state.awaiting;
  state.approved = [...(state.approved ?? []), "storyboard_review"];
  saveState(workDir, state);
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

/** In-process review callbacks (CLI, tests); the web app pauses the queue flow and resumes instead. */
export interface Reviewer {
  script(state: ProduceState): Promise<ScriptReview>;
  storyboard(state: ProduceState): Promise<StoryboardReview>;
}

/** In-process run of every stage (CLI, tests). Usage counts only this run's new calls. */
export async function produceVideo(
  ctx: PipelineContext,
  input: ProduceInput,
  opts: { cacheDir?: string; reviewer?: Reviewer } = {},
): Promise<ProduceResult> {
  const t0 = performance.now();
  const prev = loadState(ctx.workDir);
  if (prev) {
    const next: ProduceState = { ...prev, input, usage: [] };
    delete next.awaiting;
    delete next.approved;
    saveState(ctx.workDir, next);
  }
  if (input.mode === "review" && !opts.reviewer) throw new Error("review mode needs a reviewer");
  let state: ProduceState | undefined;
  for (const segment of produceSegments(input.mode)) {
    for (const s of segment) state = await runStage(ctx, s, input, opts);
    if (state?.awaiting === "script_review")
      state = applyScriptReview(ctx.stylesRoot, ctx.workDir, await opts.reviewer!.script(state));
    else if (state?.awaiting === "storyboard_review")
      state = applyStoryboardReview(ctx.workDir, await opts.reviewer!.storyboard(state));
  }
  return resultFromState(state!, Math.round((performance.now() - t0) / 100) / 10);
}
