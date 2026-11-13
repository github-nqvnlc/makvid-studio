// Stop-motion helpers: movement happens in discrete steps (8 per second) like paper moved by hand between
// shots, and pieces "boil" (tiny seeded changes every 1/4 s) while they rest. Values come from the scene rng,
// so every frame is reproducible.
//
// Safe area: a tilted piece's corner swings sideways by (height / 2) · sin(tilt). Pieces that start at the
// region's left edge are nudged right by that amount; full-width pieces (list items, cards) do not tilt at all
// and boil with a sub-pixel vertical jiggle instead (inside the 1 px QA tolerance), so nothing ever leaves the region.
import type { Rng, Timeline } from "@makvid/style-kit";

const STEP = 1 / 8;
const BOIL = 0.6; // degrees of extra tilt while boiling

export interface Piece {
  el: HTMLElement;
  /** Resting tilt in degrees (0 for full-width pieces). */
  tilt: number;
  /** Horizontal nudge (px) that keeps the tilted corners inside the region. */
  dx: number;
  /** Full-width piece: no tilt, vertical jiggle. */
  flat: boolean;
}

/** Seeded resting tilts; `flat` pieces never tilt. Heights come from fitted line sizes (stable before fonts load). */
export function pieces(rng: Rng, els: HTMLElement[], max = 2, flat = false): Piece[] {
  return els.map((el) => {
    const tilt = flat ? 0 : rng.range(-max, max);
    const swing = ((el.offsetHeight || 0) / 2) * Math.sin(((Math.abs(tilt) + BOIL) * Math.PI) / 180);
    return { el, tilt, dx: flat ? 0 : Math.ceil(swing) + 1, flat };
  });
}

/**
 * Bring pieces in with stepped motion: each piece drops from `fromY` px above and lands on its rest pose in
 * `steps` hand-moved steps. `gap` seconds between pieces. Returns when the last piece has landed.
 */
export function stepIn(tl: Timeline, ps: Piece[], at: number, gap: number, fromY = -60, steps = 4): number {
  let t = at;
  for (const p of ps) {
    tl.set(p.el, { opacity: 0 }, 0);
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const ease = 1 - (1 - f) * (1 - f);
      tl.set(p.el, { opacity: 1, x: p.dx, y: fromY * (1 - ease), rotation: p.tilt * ease }, t + s * STEP);
    }
    t += gap;
  }
  return t + steps * STEP;
}

/** Boil: from `from` to the end, every 1/4 s each piece shifts slightly around its rest pose. */
export function boil(tl: Timeline, rng: Rng, ps: Piece[], from: number, duration: number): void {
  for (let t = from; t < duration; t += STEP * 2)
    for (const p of ps)
      tl.set(
        p.el,
        p.flat ? { y: rng.range(-0.8, 0.8) } : { x: p.dx, rotation: p.tilt + rng.range(-BOIL, BOIL) },
        t,
      );
}
