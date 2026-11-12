// Build the VideoSpec from script + storyboard (T076), then apply narration timing (T078).
import { join } from "node:path";
import type { StoryboardOutput } from "@makvid/ai";
import {
  parseVideoSpec,
  SPEC_VERSION,
  type AspectRatio,
  type Scene,
  type SlotValue,
  type VideoSpec,
  type Word,
} from "@makvid/spec";
import { loadPack } from "@makvid/style-kit/node";
import { hashOf } from "../context";
import type { ScriptResult } from "./ai";

export const FPS = 30;
const TRANSITIONS = ["fade", "slide"] as const;

function toSlotValue(v: unknown): SlotValue | undefined {
  if (typeof v === "string") return v.normalize("NFC").trim();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (Array.isArray(v) && v.every((x) => typeof x === "string"))
    return v.map((x: string) => x.normalize("NFC").trim());
  if (v && typeof v === "object" && Array.isArray((v as { series?: unknown }).series)) {
    const s = (v as { series: Array<{ label: unknown; value: unknown }> }).series.map((x) => ({
      label: String(x.label),
      value: Number(x.value),
    }));
    return { series: s };
  }
  return undefined;
}

export function buildSpec(opts: {
  prompt: string;
  script: ScriptResult;
  board: StoryboardOutput;
  styleId: string;
  aspects: AspectRatio[];
  durationSec: number;
  voiceId: string;
  musicTrackId?: string;
}): VideoSpec {
  const script = opts.script.sentences.map((text, i) => ({ id: `s${i + 1}`, text }));
  const scenes: Scene[] = opts.board.scenes.map((sc, i) => {
    const slots: Record<string, SlotValue> = {};
    for (const [k, v] of Object.entries(sc.slots)) {
      // Never invent social handles or brand names: the handle comes from the user / brand kit only.
      if (k === "handle") continue;
      const sv = toSlotValue(v);
      if (sv !== undefined && sv !== "") slots[k] = sv;
    }
    return {
      id: `sc${i + 1}-${sc.templateId}`,
      styleId: opts.styleId,
      templateId: sc.templateId,
      slots,
      scriptRefs: sc.sentences.map((n) => `s${n}`),
      assets: [],
      ...(i > 0 ? { transitionIn: { presetId: TRANSITIONS[i % 2]!, durationMs: 400 } } : {}),
    };
  });
  const seed = Number.parseInt(hashOf(opts.prompt).slice(0, 8), 16) >>> 0;
  const spec = {
    specVersion: SPEC_VERSION,
    meta: {
      language: "vi" as const,
      aspectRatios: opts.aspects,
      fps: FPS as 30,
      resolution: "1080p" as const,
      primaryStyleId: opts.styleId,
      voice: { voiceId: opts.voiceId },
      ...(opts.musicTrackId ? { music: { trackId: opts.musicTrackId } } : {}),
      targetDurationSec: Math.min(600, Math.max(30, opts.durationSec)),
      seed,
    },
    script,
    scenes,
    audio: { sfx: [], ducking: { enabled: true, reductionDb: 12 }, loudnessTargetLufs: -14 },
    captions: { enabled: true, maxLines: 2 as const },
    variables: {},
  };
  const r = parseVideoSpec(spec);
  if (!r.ok) throw new Error(`storyboard produced an invalid VideoSpec: ${r.issues.join("; ")}`);
  return r.spec;
}

export function musicMoods(stylesRoot: string, styleId: string): string[] {
  return loadPack(join(stylesRoot, styleId)).manifest.musicMoods;
}

/**
 * Scene timing from narration: a scene starts slightly before its first sentence is spoken and ends where
 * the next scene starts; all boundaries are whole frames so scene videos concatenate exactly.
 */
export function applyNarration(
  spec: VideoSpec,
  words: Word[],
  parts: Array<{ scriptId: string; startMs: number; endMs: number }>,
  narrationMs: number,
): VideoSpec {
  const lead = 200;
  const frame = (ms: number) => Math.round((ms * FPS) / 1000);
  const partStart = new Map(parts.map((p) => [p.scriptId, p.startMs]));
  const boundaries = spec.scenes.map((s, i) =>
    i === 0 ? 0 : frame(Math.max(0, (partStart.get(s.scriptRefs[0]!) ?? 0) - lead)),
  );
  const endFrame = frame(narrationMs + 700);
  const scenes = spec.scenes.map((s, i) => {
    const f0 = boundaries[i]!;
    const f1 = i + 1 < boundaries.length ? boundaries[i + 1]! : endFrame;
    const startMs = Math.round((f0 * 1000) / FPS);
    const durationMs = Math.round(((f1 - f0) * 1000) / FPS);
    return { ...s, timing: { startMs, durationMs: Math.max(500, durationMs) } };
  });
  const sfx = scenes
    .slice(1)
    .map((s) => ({ sfxId: "whoosh", atMs: Math.max(0, s.timing.startMs - 120), gainDb: -16 }));
  const next = {
    ...spec,
    scenes,
    audio: { ...spec.audio, narration: { assetKey: "narration.wav", words }, sfx },
  };
  const r = parseVideoSpec(next);
  if (!r.ok) throw new Error(`timed VideoSpec invalid: ${r.issues.join("; ")}`);
  return r.spec;
}

export const videoDurationMs = (spec: VideoSpec) => {
  const last = spec.scenes.at(-1)!.timing!;
  return last.startMs + last.durationMs;
};
