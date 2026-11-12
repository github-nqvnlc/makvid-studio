// T067: QA rules on deliberately broken scenes (overflow, overlap, outside safe area, low contrast,
// network, missing glyph). DOM metrics are synthetic here; the Chrome path is covered by
// tests/visual/overflow.test.ts and the renderer contract.
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack, type FontBook } from "@makvid/style-kit/node";
import { checkFrame, type DomMetrics, type QaElement } from "../src";

const el = (
  qa: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<QaElement> = {},
): QaElement => ({
  qa,
  rect: { x, y, width: w, height: h },
  opacity: 1,
  fontSize: 60,
  color: "rgb(20, 20, 20)",
  background: "rgb(246, 245, 241)",
  contrast: 15,
  overflow: false,
  text: qa,
  ...extra,
});
const dom = (elements: QaElement[], blockedRequests: string[] = []): DomMetrics => ({
  width: 1080,
  height: 1920,
  elements,
  blockedRequests,
  fontsLoaded: [],
});
const rules = (d: DomMetrics) => checkFrame(d, 1000, { aspect: "9:16" }).map((i) => i.rule);

describe("QA checker on broken scenes", () => {
  it("passes a clean frame", () => {
    expect(rules(dom([el("headline", 100, 400, 700, 300), el("caption", 200, 1400, 500, 120)]))).toEqual([]);
  });
  it("flags text overflow", () => {
    expect(rules(dom([el("headline", 100, 400, 700, 300, { overflow: true })]))).toContain("overflow");
  });
  it("flags overlapping blocks", () => {
    expect(rules(dom([el("title", 100, 400, 700, 300), el("chart", 300, 600, 500, 300)]))).toContain(
      "overlap",
    );
  });
  it("flags text overlapping the caption even when nested inside it", () => {
    expect(rules(dom([el("caption", 100, 1300, 800, 200), el("label", 300, 1350, 200, 60)]))).toContain(
      "overlap",
    );
  });
  it("flags elements outside the 9:16 safe area (TikTok UI zones)", () => {
    expect(rules(dom([el("headline", 20, 400, 700, 300)]))).toContain("safe-area"); // left of 6%
    expect(rules(dom([el("cta", 100, 1700, 600, 100)]))).toContain("safe-area"); // inside bottom 20%
    expect(rules(dom([el("badge", 900, 600, 150, 80)]))).toContain("safe-area"); // right action rail
  });
  it("flags low contrast", () => {
    expect(rules(dom([el("subtitle", 100, 400, 700, 100, { contrast: 1.4, fontSize: 40 })]))).toContain(
      "contrast",
    );
    expect(rules(dom([el("small", 100, 400, 700, 100, { contrast: 3.5, fontSize: 18 })]))).toContain(
      "contrast",
    );
  });
  it("flags external network requests", () => {
    expect(rules(dom([], ["https://cdn.example.com/font.woff2"]))).toContain("network");
  });
  it("ignores elements mid-animation (low opacity)", () => {
    expect(rules(dom([el("headline", 20, 400, 700, 300, { opacity: 0.2, overflow: true })]))).toEqual([]);
  });
});

describe("missing glyph check (font coverage)", () => {
  const pack = loadPack(join(resolve(__dirname, "../../.."), "packages", "styles", "minimal"));
  const book: FontBook = pack.fonts;
  it("has every Vietnamese glyph", () => {
    expect(book.missingGlyphs("Be Vietnam Pro", 800, "Ẩn Ỹ Ự ữ ặ đ Đ ₫")).toEqual([]);
  });
  it("reports characters the pack fonts cannot render", () => {
    expect(book.missingGlyphs("Be Vietnam Pro", 800, "Tiếng Việt 漢字 😀")).toEqual(
      expect.arrayContaining(["漢", "字", "😀"]),
    );
  });
});
