// Neon effects, all on the scene timeline and seeded (no Math.random / timers): a sign "switching on"
// with a few flickers, and short glitches that shift text lines sideways for a couple of frames.
import type { Rng, Timeline } from "@makvid/style-kit";

type Q = <T extends Element = HTMLElement>(selector: string) => T[];

/** Flicker on: off/on toggles in the first ~0.5 s after `at`, then steady. */
export function flickerOn(tl: Timeline, rng: Rng, targets: Element[], at: number): void {
  if (!targets.length) return;
  tl.set(targets, { opacity: 0 }, 0);
  let t = at;
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    tl.set(targets, { opacity: rng.range(0.55, 0.9) }, t);
    t += rng.range(0.04, 0.08);
    tl.set(targets, { opacity: 0.1 }, t);
    t += rng.range(0.04, 0.09);
  }
  tl.set(targets, { opacity: 1 }, t);
}

/**
 * Seeded glitches: 1–2 moments in the scene (after the entrance, before the end) where each line jumps a few
 * pixels sideways for ~0.1 s. Small offsets so fitted text never leaves its box by more than the margin.
 */
export function glitch(tl: Timeline, rng: Rng, qa: Q, selector: string, duration: number): void {
  const lines = qa(selector);
  if (!lines.length || duration < 2.2) return;
  const count = duration > 5 ? 2 : 1;
  for (let g = 0; g < count; g++) {
    const at = rng.range(1.4 + g * (duration / 2.4), Math.min(duration - 0.5, 1.9 + g * (duration / 2.4)));
    for (const [i, el] of lines.entries()) {
      const dx = (i % 2 ? -1 : 1) * rng.range(6, 14);
      tl.set(el, { x: dx, opacity: 0.85 }, at);
      tl.set(el, { x: -dx / 2 }, at + 0.05);
      tl.set(el, { x: 0, opacity: 1 }, at + 0.1);
    }
  }
}

/** Slow "hum" of the sign frame: a gentle opacity pulse across the scene. */
export function hum(tl: Timeline, targets: Element[], duration: number): void {
  if (!targets.length) return;
  for (let t = 0.6; t + 1.2 < duration; t += 1.2) {
    tl.fromTo(targets, { opacity: 0.85 }, { opacity: 0.6 }, { duration: 0.6, ease: "sine.inOut" }, t);
    tl.fromTo(targets, { opacity: 0.6 }, { opacity: 0.85 }, { duration: 0.6, ease: "sine.inOut" }, t + 0.6);
  }
}
