// T120: brand kit override in all 4 aspects. The sample video is compiled in two different packs with a brand
// kit (colours, a display + body font under new family names, a logo). In every scene: headings use the brand
// display font, body text the brand body font, the background is the brand colour, the logo is visible inside
// the frame but outside the content region, and the usual QA (overflow, safe area, contrast) still passes.
// Opt-in (needs Chrome): MAKVID_VISUAL_TESTS=1 pnpm --filter @makvid/tests test visual/brand-kit
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { applyBrand, brandFontMissingGlyphs, compileVideo, type BrandKit } from "@makvid/compiler";
import { captureFrames, checkFrame, closeSharedBrowser, openScene } from "@makvid/renderer";
import { ASPECT_SIZES, parseVideoSpec, type AspectRatio } from "@makvid/spec";
import { loadPack } from "@makvid/style-kit/node";

const root = resolve(__dirname, "../..");
const styles = join(root, "packages", "styles");
const fonts = (pack: string, prefix: string) =>
  ["latin", "latin-ext", "vietnamese"].map((s) => join(styles, pack, "fonts", `${prefix}-${s}`));
const brand: BrandKit = {
  colors: { bg: "#102a43", fg: "#f0f4f8", muted: "#bcccdc", accent: "#f7c948", accentInk: "#102a43", surface: "#243b53" },
  fonts: {
    display: { family: "Brand Display", weight: 800, files: fonts("slides", "lexend").map((f) => `${f}-800-normal.woff2`) },
    body: { family: "Brand Body", weight: 400, files: fonts("flat-illustration", "nunito").map((f) => `${f}-400-normal.woff2`) },
  },
  logo: { file: join(root, "fixtures/brand/logo.svg"), position: "top-right" },
};
const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];

describe("brand kit fonts", () => {
  it("accepts fonts with full Vietnamese coverage and reports missing glyphs otherwise", () => {
    expect(brandFontMissingGlyphs(brand.fonts!.display!)).toEqual([]);
    const latinOnly = { ...brand.fonts!.display!, files: [brand.fonts!.display!.files[0]!] };
    expect(brandFontMissingGlyphs(latinOnly)).toContain("ệ");
  });
  it("never mutates the style pack itself", () => {
    const pack = loadPack(join(styles, "minimal"));
    const before = JSON.stringify(pack.tokens);
    const branded = applyBrand(pack, brand);
    expect(branded.tokens.colors.bg).toBe("#102a43");
    expect(JSON.stringify(pack.tokens)).toBe(before);
  });
});

describe.runIf(process.env.MAKVID_VISUAL_TESTS === "1")("brand kit in every scene and aspect (T120)", () => {
  afterAll(() => closeSharedBrowser());
  for (const styleId of ["minimal", "kinetic"])
    for (const aspect of ASPECTS)
      it(`${styleId} ${aspect}`, async () => {
        const parsed = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
        if (!parsed.ok) throw new Error(parsed.issues.join("; "));
        const spec = { ...parsed.spec, scenes: parsed.spec.scenes.map((s) => ({ ...s, styleId })) };
        const video = await compileVideo(spec, {
          aspect,
          stylesRoot: styles,
          outDir: mkdtempSync(join(tmpdir(), "mkv-brand-")),
          engine: "brand-test",
          brand,
        });
        const { width, height } = ASPECT_SIZES[aspect];
        const problems: string[] = [];
        for (const s of video.scenes) {
          const at = Math.round(s.durationMs * 0.7);
          const [frame] = await captureFrames({ sceneDir: s.dir, width, height, atMs: [at] });
          for (const i of checkFrame(frame!.dom!, at, { aspect })) problems.push(`${s.sceneId} ${i.rule}: ${i.detail}`);
          const page = await openScene(s.dir, width, height);
          try {
            await page.seek(at / 1000);
            const r = await page.page.evaluate(() => {
              const font = (sel: string) => {
                const el = document.querySelector(sel);
                return el ? getComputedStyle(el).fontFamily : null;
              };
              const logo = document.querySelector<HTMLImageElement>(".brand-logo")!.getBoundingClientRect();
              const region = document.querySelector(".region")!.getBoundingClientRect();
              return {
                heading: font(".headline, .title-text, .hl-text, .list-title, .cmp-title, .q-text, .cta-head, .stat-value"),
                body: font(".item-text, .subtitle, .ci, .stat-label, .q-author, .cta-handle, .kicker"),
                bg: getComputedStyle(document.getElementById("root")!).backgroundColor,
                logo: { x: logo.x, y: logo.y, w: logo.width, h: logo.height, bottom: logo.bottom },
                regionTop: region.top,
                loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")),
              };
            });
            if (!r.heading?.includes("Brand Display")) problems.push(`${s.sceneId}: heading font ${r.heading}`);
            if (r.body && !r.body.includes("Brand Body")) problems.push(`${s.sceneId}: body font ${r.body}`);
            if (r.bg !== "rgb(16, 42, 67)") problems.push(`${s.sceneId}: background ${r.bg}`);
            if (!(r.logo.w > 20 && r.logo.h > 20 && r.logo.x >= 0 && r.logo.x + r.logo.w <= width && r.logo.y >= 0))
              problems.push(`${s.sceneId}: logo not inside the frame ${JSON.stringify(r.logo)}`);
            if (r.logo.bottom > r.regionTop + 1) problems.push(`${s.sceneId}: logo overlaps the content region`);
            if (!r.loaded.includes("Brand Display")) problems.push(`${s.sceneId}: brand font not loaded`);
          } finally {
            await page.close();
          }
        }
        expect(problems).toEqual([]);
      });
});
