// Scene timing and word timing.
// Until the audio step exists (M2), word onsets are estimated from the script so captions can be
// laid out and tested; real narration words (spec.audio.narration.words) always win.
import { splitGraphemes, splitWords } from "@makvid/style-kit";
import type { VideoSpec, Word } from "@makvid/spec";

/** Vietnamese narration pace used for estimates (graphemes per second, excluding spaces). */
const GRAPHEMES_PER_SEC = 14;

export interface SceneTiming {
  sceneId: string;
  startMs: number;
  durationMs: number;
}

export function sceneTimings(spec: VideoSpec): SceneTiming[] {
  let cursor = 0;
  return spec.scenes.map((s) => {
    if (s.timing) {
      cursor = s.timing.startMs + s.timing.durationMs;
      return { sceneId: s.id, startMs: s.timing.startMs, durationMs: s.timing.durationMs };
    }
    const text = s.scriptRefs.map((r) => spec.script.find((p) => p.id === r)?.text ?? "").join(" ");
    const g = splitGraphemes(text).filter((c) => c.trim()).length;
    const durationMs = Math.max(2500, Math.round((g / GRAPHEMES_PER_SEC) * 1000 + 600));
    const t = { sceneId: s.id, startMs: cursor, durationMs };
    cursor += durationMs;
    return t;
  });
}

/** Estimate word onsets for a scene's script inside [startMs, startMs + durationMs]. */
export function estimateWords(spec: VideoSpec, sceneIndex: number, timing: SceneTiming): Word[] {
  const scene = spec.scenes[sceneIndex]!;
  const parts = scene.scriptRefs
    .map((r) => spec.script.find((p) => p.id === r))
    .filter(Boolean) as VideoSpec["script"];
  const items: Array<{ text: string; scriptId: string; weight: number }> = [];
  for (const p of parts)
    for (const w of splitWords(p.text)) {
      const pause = /[.!?]$/.test(w) ? 4 : /[,;:—–]$/.test(w) ? 2 : 0;
      items.push({ text: w, scriptId: p.id, weight: splitGraphemes(w).length + 1 + pause });
    }
  if (!items.length) return [];
  const lead = Math.min(250, timing.durationMs * 0.08);
  const tail = Math.min(400, timing.durationMs * 0.12);
  const span = timing.durationMs - lead - tail;
  const total = items.reduce((a, b) => a + b.weight, 0);
  let t = timing.startMs + lead;
  return items.map((it) => {
    const dur = (it.weight / total) * span;
    const w: Word = {
      text: it.text,
      startMs: Math.round(t),
      endMs: Math.round(t + dur * 0.85),
      scriptId: it.scriptId,
    };
    t += dur;
    return w;
  });
}

/** Narration words for every scene: real ones when present, otherwise estimates. */
export function wordsByScene(spec: VideoSpec, timings: SceneTiming[]): Word[][] {
  const real = spec.audio.narration?.words;
  return spec.scenes.map((s, i) => {
    const t = timings[i]!;
    if (real?.length) {
      const ids = new Set(s.scriptRefs);
      return real.filter(
        (w) => ids.has(w.scriptId) && w.startMs >= t.startMs && w.startMs < t.startMs + t.durationMs,
      );
    }
    return estimateWords(spec, i, t);
  });
}
