import { describe, expect, it } from "vitest";
import { fitGroup, fitText, splitGraphemes, splitWords, type Measure } from "../src";

// Deterministic fake metrics: every grapheme is 0.55 em wide, a space 0.3 em.
const measure: Measure = (text, size) =>
  splitGraphemes(text).reduce((w, g) => w + (g === " " ? 0.3 : 0.55), 0) * size;

const box = { maxWidth: 900, maxHeight: 400, maxFontSize: 120, minFontSize: 48, lineHeight: 1.2, measure };

describe("splitGraphemes", () => {
  it("keeps Vietnamese diacritics with their base letter", () => {
    expect(splitGraphemes("Ẩn Ỹ Ự")).toEqual(["Ẩ", "n", " ", "Ỹ", " ", "Ự"]);
  });
  it("normalizes decomposed input first (NFD -> NFC)", () => {
    const nfd = "Tiếng Việt".normalize("NFD");
    expect(nfd.length).toBeGreaterThan(10);
    expect(splitGraphemes(nfd).join("")).toBe("Tiếng Việt");
    expect(splitGraphemes(nfd)).toHaveLength(10);
  });
  it("never yields a lone combining mark", () => {
    const text = "Ẩn số quan trọng nhất là thời gian — Ỹ Ự ữ ặ".normalize("NFD");
    for (const g of splitGraphemes(text)) expect(/^\p{M}/u.test(g)).toBe(false);
  });
});

describe("fitText", () => {
  it("keeps a short title at max size on one line", () => {
    const r = fitText("Lãi kép", box);
    expect(r).toMatchObject({ fontSize: 120, lines: ["Lãi kép"], overflow: false });
  });

  it("shrinks before overflowing and never breaks inside a word", () => {
    const text = "Sức mạnh thật sự của lãi kép nằm ở thời gian dài";
    const r = fitText(text, box);
    expect(r.overflow).toBe(false);
    expect(r.fontSize).toBeLessThan(120);
    expect(r.lines.join(" ")).toBe(text);
    for (const l of r.lines) expect(measure(l, r.fontSize)).toBeLessThanOrEqual(box.maxWidth);
    expect(r.lines.length * r.fontSize * box.lineHeight).toBeLessThanOrEqual(box.maxHeight);
  });

  it("handles a 200-character title by shrinking to min and reporting overflow honestly", () => {
    const long = "Ẩn số quan trọng nhất của lãi kép chính là thời gian ".repeat(4).slice(0, 200);
    const r = fitText(long, { ...box, maxHeight: 250 });
    expect(r.fontSize).toBe(48);
    expect(r.overflow).toBe(true);
    expect(r.lines.join(" ")).toBe(splitWords(long).join(" "));
  });

  it("puts an over-long compound word on its own line instead of splitting it", () => {
    const r = fitText("xem https://vi.wikipedia.org/wiki/Lãi_kép_và_lãi_đơn_trong_ngân_hàng ngay", box);
    expect(r.lines.some((l) => l.startsWith("https://"))).toBe(true);
    for (const l of r.lines) expect(l.includes("https://") ? l.split(" ").length : 1).toBe(1);
    expect(r.overflow).toBe(true);
  });

  it("balances lines (no orphan last word)", () => {
    const r = fitText("Bắt đầu tiết kiệm ngay hôm nay", {
      ...box,
      maxFontSize: 110,
      minFontSize: 110,
      maxWidth: 1000,
    });
    expect(r.lines.length).toBe(2);
    const words = r.lines.map((l) => l.split(" ").length);
    expect(Math.abs(words[0]! - words[1]!)).toBeLessThanOrEqual(1);
  });

  it("respects maxLines", () => {
    const r = fitText("một hai ba bốn năm sáu bảy tám chín mười", { ...box, maxLines: 2 });
    expect(r.lines.length).toBeLessThanOrEqual(2);
  });

  it("fitGroup gives list items one shared size", () => {
    const rs = fitGroup(["Vốn ban đầu", "Lãi suất ổn định trong nhiều năm liền", "Thời gian"], {
      ...box,
      maxHeight: 150,
    });
    expect(new Set(rs.map((r) => r.fontSize)).size).toBe(1);
  });
});
