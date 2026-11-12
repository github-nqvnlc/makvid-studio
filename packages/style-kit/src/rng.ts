/**
 * Seeded PRNG (mulberry32). Compositions must never use Math.random (constitution III):
 * the same seed always yields the same sequence, in Node and in the browser.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Independent child stream, stable for a given label (e.g. a scene id). */
  fork(label: string): Rng;
}

/** FNV-1a 32-bit hash of a string; used to derive child seeds. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const self: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor((max - min + 1) * next()),
    pick: (items) => {
      if (!items.length) throw new Error("pick() on empty array");
      return items[Math.floor(items.length * next())] as (typeof items)[number];
    },
    fork: (label) => rng((seed ^ hash32(label)) >>> 0),
  };
  return self;
}
