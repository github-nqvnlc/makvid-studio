import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { compileVideo, CompileError, hashDir, sceneCacheKey, validateSlots } from "../src";

const root = resolve(__dirname, "../../..");
const stylesRoot = join(root, "packages", "styles");
const spec = (): VideoSpec => {
  const r = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!r.ok) throw new Error(r.issues.join());
  return r.spec;
};
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "mkv-compile-"));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("compileVideo", () => {
  it("is deterministic: same spec -> byte-identical scene dirs and cache keys", async () => {
    const a = await compileVideo(spec(), { aspect: "9:16", stylesRoot, outDir: tmp(), engine: "test" });
    const b = await compileVideo(spec(), { aspect: "9:16", stylesRoot, outDir: tmp(), engine: "test" });
    expect(a.scenes.map((s) => s.cacheKey)).toEqual(b.scenes.map((s) => s.cacheKey));
    expect(hashDir(a.scenes[0]!.dir)).toEqual(hashDir(b.scenes[0]!.dir));
  }, 60_000);

  it("produces self-contained scenes: no external URLs, local runtime/fonts", async () => {
    const v = await compileVideo(spec(), { aspect: "16:9", stylesRoot, outDir: tmp(), engine: "test" });
    expect(v.scenes).toHaveLength(8);
    expect(v.durationMs).toBe(30_500);
    for (const s of v.scenes) {
      const html = readFileSync(join(s.dir, "index.html"), "utf8");
      expect(html).not.toMatch(/(src|href)=["']https?:/);
      expect(html).not.toMatch(/url\(["']?https?:/);
      expect(html).toContain('data-composition-id="main"');
      expect(Object.keys(hashDir(join(s.dir, "assets")))).toEqual(
        expect.arrayContaining(["pack.js", "vendor/gsap.min.js", "vendor/hyperframe.runtime.iife.js"]),
      );
      expect(s.fits.every((f) => !f.overflow)).toBe(true);
    }
  }, 60_000);

  it("changing one slot changes only that scene's cache key", async () => {
    const s1 = spec();
    const s2 = spec();
    s2.scenes[3]!.slots.title = "Ba điều cần nhớ";
    const a = await compileVideo(s1, { aspect: "1:1", stylesRoot, outDir: tmp(), engine: "test" });
    const b = await compileVideo(s2, { aspect: "1:1", stylesRoot, outDir: tmp(), engine: "test" });
    const changed = a.scenes.filter((s, i) => s.cacheKey !== b.scenes[i]!.cacheKey).map((s) => s.sceneId);
    expect(changed).toEqual(["list"]);
  }, 60_000);

  it("the mkv runtime omits GSAP from the scene", async () => {
    const v = await compileVideo(spec(), {
      aspect: "4:5",
      stylesRoot,
      outDir: tmp(),
      engine: "test",
      runtime: "mkv",
    });
    const html = readFileSync(join(v.scenes[0]!.dir, "index.html"), "utf8");
    expect(html).not.toContain("gsap.min.js");
    expect(html).toContain('"runtime":"mkv"');
  }, 60_000);

  it("rejects slots that violate the template schema", async () => {
    const s = spec();
    s.scenes[0]!.slots.headline = "x".repeat(61);
    await expect(
      compileVideo(s, { aspect: "16:9", stylesRoot, outDir: tmp(), engine: "test" }),
    ).rejects.toThrow(CompileError);
    expect(
      validateSlots(s.scenes[0]!, { slots: { headline: { type: "text", required: true, maxLength: 60 } } }),
    ).toEqual([
      'scene "hook" slot "headline" exceeds maxLength 60',
      'scene "hook" slot "kicker" is not defined by template "hook"',
    ]);
  });

  it("cache key depends on engine and export config", () => {
    const k = (engine: string, fps: number) =>
      sceneCacheKey("<html>", { a: "1" }, { width: 1, height: 1, fps, renderer: "r" }, engine);
    expect(k("e1", 30)).toBe(k("e1", 30));
    expect(k("e1", 30)).not.toBe(k("e2", 30));
    expect(k("e1", 30)).not.toBe(k("e1", 60));
  });
});
