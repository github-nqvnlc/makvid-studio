// Word timing inside one synthesized caption chunk (FPT returns no timestamps; ADR 0002).
// Vietnamese words are single syllables, so boundaries are found as energy dips between syllables near
// the position predicted by a grapheme-weighted interpolation.
import { splitGraphemes } from "@makvid/style-kit";
import { envelopeDb, type Pcm } from "./wav";

export interface WordSpan {
  text: string;
  startMs: number;
  endMs: number;
}

const weight = (w: string) => splitGraphemes(w.replace(/[.,!?;:"“”()…—–-]/g, "")).length + 1.5;

/** Baseline: spread words over the chunk proportionally to their (grapheme) length. */
export function interpolateWords(words: string[], durationMs: number): WordSpan[] {
  const ws = words.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((text, i) => {
    const d = (ws[i]! / total) * durationMs;
    const s = { text, startMs: t, endMs: t + d };
    t += d;
    return s;
  });
}

/**
 * Refine interpolated boundaries by snapping each to the deepest energy dip within ±searchMs.
 * Boundaries stay ordered and at least minGapMs apart.
 */
export function alignWordsByEnergy(
  words: string[],
  pcm: Pcm,
  opts: { searchMs?: number; minWordMs?: number } = {},
): WordSpan[] {
  const hopMs = 5;
  const env = envelopeDb(pcm, 25, hopMs);
  const durationMs = (pcm.samples.length / pcm.sampleRate) * 1000;
  const base = interpolateWords(words, durationMs);
  if (words.length < 2) return base;
  const search = opts.searchMs ?? 140;
  const minWord = opts.minWordMs ?? 70;
  // Smooth the envelope a little (3-frame moving average).
  const sm = env.map((_, i) => ((env[i - 1] ?? env[i]!) + env[i]! + (env[i + 1] ?? env[i]!)) / 3);
  const bounds: number[] = [];
  let prev = 0;
  for (let k = 1; k < words.length; k++) {
    const guess = base[k]!.startMs;
    const lo = Math.max(prev + minWord, guess - search);
    const hi = Math.min(durationMs - minWord * (words.length - k), guess + search);
    let best = guess;
    let bestScore = Infinity;
    for (let t = lo; t <= hi; t += hopMs) {
      const f = Math.round(t / hopMs);
      const v = sm[f];
      if (v === undefined) continue;
      // Prefer deep dips, lightly penalize distance from the interpolated guess.
      const score = v + Math.abs(t - guess) * 0.04;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    bounds.push(best);
    prev = best;
  }
  const starts = [0, ...bounds];
  return words.map((text, i) => ({ text, startMs: starts[i]!, endMs: starts[i + 1] ?? durationMs }));
}
