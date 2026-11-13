// T160: per-scene style mixing — captions stay in the primary style, a bridge opens every style change.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { compileVideo, splitCaptionCss, STYLE_BRIDGE, stylesUsed, transitionFor } from "../src";

const root = resolve(__dirname, "../../..");
const stylesRoot = join(root, "packages", "styles");
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "mkv-mix-"));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Sample spec with primary "minimal": scenes 3–4 in neon, scene 6 in paper-collage. */
const mixedSpec = (): VideoSpec => {
  const r = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!r.ok) throw new Error(r.issues.join());
  const s = r.spec;
  const styles = ["minimal", "minimal", "neon", "neon", "minimal", "paper-collage", "minimal", "minimal"];
  return {
    ...s,
    meta: { ...s.meta, primaryStyleId: "minimal" },
    scenes: s.scenes.map((sc, i) => ({ ...sc, styleId: styles[i] ?? "minimal" })),
  };
};

describe("splitCaptionCss", () => {
  it("separates caption rules from the rest", () => {
    const css = `.a{color:red}\n#captions .fit{color:var(--c-captionFg)}\n.b{x:1}\n.a-9x16 #captions .cap-w.on{color:blue}`;
    const { captions, rest } = splitCaptionCss(css);
    expect(captions).toBe(
      "#captions .fit{color:var(--c-captionFg)}\n.a-9x16 #captions .cap-w.on{color:blue}",
    );
    expect(rest).not.toContain("#captions");
    expect(rest).toContain(".a{color:red}");
    expect(rest).toContain(".b{x:1}");
  });
});

describe("transitions at style changes", () => {
  it("adds the bridge only where the style changes and keeps explicit transitions", () => {
    const s = mixedSpec();
    expect(transitionFor(s.scenes, 0)).toBeUndefined();
    expect(transitionFor(s.scenes, 1)?.styleChange ?? false).toBe(false);
    expect(transitionFor(s.scenes, 2)?.styleChange).toBe(true);
    const bare = s.scenes.map((sc) => ({ ...sc, transitionIn: undefined }));
    expect(transitionFor(bare, 2)).toEqual({ ...STYLE_BRIDGE, styleChange: true });
    expect(transitionFor(bare, 1)).toBeUndefined();
    expect(transitionFor(s.scenes, 3)?.styleChange ?? false).toBe(false);
    expect(transitionFor(s.scenes, 4)?.styleChange).toBe(true);
    const own = { presetId: "slide", durationMs: 400 };
    const withOwn = s.scenes.map((sc, i) => (i === 2 ? { ...sc, transitionIn: own } : sc));
    expect(transitionFor(withOwn, 2)).toEqual({ ...own, styleChange: true });
    expect(stylesUsed("minimal", s.scenes)).toEqual(["minimal", "neon", "paper-collage"]);
  });
});

describe("compileVideo with mixed styles", () => {
  it("uses each scene's pack for the stage and the primary pack for captions", async () => {
    const v = await compileVideo(mixedSpec(), { aspect: "9:16", stylesRoot, outDir: tmp(), engine: "test" });
    const html = (i: number) => readFileSync(join(v.scenes[i]!.dir, "index.html"), "utf8");
    const data = (i: number) =>
      JSON.parse(/<script type="application\/json" id="scene-data">(.*?)<\/script>/s.exec(html(i))![1]!) as {
        transitionIn?: { fromColor?: string };
      };

    // Scene 3 is neon: neon stage, but no neon caption rules and the minimal caption font is shipped.
    const neon = html(2);
    expect(neon).toContain('class="pack-neon');
    const style = /<style>([\s\S]*?)<\/style>/.exec(neon)![1]!;
    // no neon caption rule survives (they use the neon glow tokens)
    expect(style).not.toMatch(/#captions[^{}]*{[^}]*--c-glow/);
    expect(style).toContain(".pack-neon::after");
    expect(style).toContain("#captions{--c-bg:");
    const minimalTokens = JSON.parse(readFileSync(join(stylesRoot, "minimal", "tokens.json"), "utf8")) as {
      fonts: { caption: { family: string } };
      colors: { bg: string };
    };
    expect(style).toContain(`--f-caption:"${minimalTokens.fonts.caption.family}"`);
    expect(style).toContain(`font-family:"${minimalTokens.fonts.caption.family}"`);
    const fonts = readFileSync(join(stylesRoot, "minimal", "fonts", "fonts.json"), "utf8");
    const capFile = (JSON.parse(fonts) as { faces: Array<{ family: string; file: string }> }).faces.find(
      (f) => f.family === minimalTokens.fonts.caption.family,
    )!.file;
    expect(existsSync(join(v.scenes[2]!.dir, "assets", "fonts", capFile))).toBe(true);

    // Bridges: neon opens from the minimal background, scene 5 (back to minimal) from the neon background.
    expect(data(2).transitionIn?.fromColor).toBe(minimalTokens.colors.bg);
    const neonBg = (
      JSON.parse(readFileSync(join(stylesRoot, "neon", "tokens.json"), "utf8")) as {
        colors: { bg: string };
      }
    ).colors.bg;
    expect(data(4).transitionIn?.fromColor).toBe(neonBg);
    expect(data(1).transitionIn?.fromColor).toBeUndefined();
    expect(data(3).transitionIn?.fromColor).toBeUndefined();

    // Primary-style scenes are unchanged by mixing (same HTML as an all-minimal compile).
    expect(html(0)).toContain('class="pack-minimal');
    expect(v.scenes.every((s) => s.fits.every((f) => !f.overflow))).toBe(true);
  }, 120_000);

  it("rejects an unknown primary style", async () => {
    const s = mixedSpec();
    s.meta.primaryStyleId = "no-such-style";
    await expect(
      compileVideo(s, { aspect: "1:1", stylesRoot, outDir: tmp(), engine: "test" }),
    ).rejects.toThrow(/primary style "no-such-style" not found/);
  }, 60_000);
});
