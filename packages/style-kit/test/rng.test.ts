import { describe, expect, it } from "vitest";
import { rng } from "../src";

const take = (seed: number, n = 1000) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => r.next());
};

describe("rng", () => {
  it("is deterministic for a seed", () => {
    expect(take(20261112)).toEqual(take(20261112));
  });
  it("differs across seeds", () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });
  it("matches the mulberry32 reference sequence", () => {
    // Reference values from the M0 spike implementation (same algorithm in the browser).
    function mulberry32(a: number) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const ref = mulberry32(20261112);
    expect(take(20261112, 50)).toEqual(Array.from({ length: 50 }, () => ref()));
  });
  it("stays in range and is roughly uniform", () => {
    const xs = take(7, 20000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.01);
  });
  it("int / pick / fork are stable", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a.int(1, 6), a.pick(["x", "y", "z"]), a.range(10, 20)]).toEqual([
      b.int(1, 6),
      b.pick(["x", "y", "z"]),
      b.range(10, 20),
    ]);
    expect(rng(42).fork("hook").next()).toBe(rng(42).fork("hook").next());
    expect(rng(42).fork("hook").next()).not.toBe(rng(42).fork("cta").next());
    for (let i = 0; i < 500; i++) {
      const v = a.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
