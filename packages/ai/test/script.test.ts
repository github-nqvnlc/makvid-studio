import { describe, expect, it } from "vitest";
import { estimateSeconds, targetWords, validateScript } from "../src";

describe("script sizing (calibrated on M2 acceptance)", () => {
  it("targets ~4.3 words/s plus 1.5 s overhead", () => {
    expect(targetWords(45)).toBe(187);
    expect(estimateSeconds([Array(187).fill("từ").join(" ")])).toBeCloseTo(45, 0);
  });
  it("flags digits, long hooks and duration outside ±10%", () => {
    const long = Array(16).fill("chữ").join(" ");
    const body = Array(9).fill(Array(20).fill("từ").join(" "));
    const p = validateScript({ title: "x", sentences: [long, "có 10 triệu", ...body] }, 45);
    expect(p.join("|")).toMatch(/hook/);
    expect(p.join("|")).toMatch(/chữ số/);
    expect(validateScript({ title: "x", sentences: ["Ngắn gọn thôi", "một câu"] }, 45).join()).toMatch(
      /quá ngắn/,
    );
  });
});
