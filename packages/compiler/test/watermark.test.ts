// T141: free-plan watermark in every scene when meta.watermark is set; absent otherwise; opposite the logo.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { compileVideo, WATERMARK_TEXT, watermarkHtml } from "../src";

const root = resolve(__dirname, "../../..");
const stylesRoot = join(root, "packages", "styles");
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "mkv-wm-"));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const spec = (watermark?: boolean): VideoSpec => {
  const r = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!r.ok) throw new Error(r.issues.join());
  return { ...r.spec, meta: { ...r.spec.meta, ...(watermark ? { watermark } : {}) } };
};

describe("watermark", () => {
  it("is drawn in every scene only when the spec asks for it", async () => {
    const on = await compileVideo(spec(true), { aspect: "9:16", stylesRoot, outDir: tmp(), engine: "test" });
    for (const s of on.scenes) {
      const html = readFileSync(join(s.dir, "index.html"), "utf8");
      expect(html).toContain(`class="mkv-watermark"`);
      expect(html).toContain(WATERMARK_TEXT);
    }
    const off = await compileVideo(spec(), { aspect: "9:16", stylesRoot, outDir: tmp(), engine: "test" });
    expect(readFileSync(join(off.scenes[0]!.dir, "index.html"), "utf8")).not.toContain("mkv-watermark");
    // Different HTML -> different scene cache key: an upgrade re-renders without the mark.
    expect(on.scenes[0]!.cacheKey).not.toBe(off.scenes[0]!.cacheKey);
  }, 60_000);

  it("sits on the side the brand logo does not use", () => {
    expect(watermarkHtml(true).css).toContain("left:var(--safe-left)");
    expect(watermarkHtml(true, { colors: {}, logo: { file: "x.png", position: "top-left" } }).css).toContain(
      "right:var(--safe-right)",
    );
    expect(watermarkHtml(false)).toEqual({ html: "", css: "" });
  });
});
