// Contact sheet of a style pack: every template of the sample fixture at 60 % of the scene, in one aspect.
// Host preview only (goldens are produced in the render container).
// Usage: pnpm --filter @makvid/cli exec tsx scripts/pack-sheet.ts <style-id> <aspect 9:16|16:9|1:1|4:5> <out.png>
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { compileVideo } from "@makvid/compiler";
import { captureFrames, closeSharedBrowser } from "@makvid/renderer";
import { ASPECT_SIZES, parseVideoSpec, type AspectRatio } from "@makvid/spec";

const [styleId, aspectArg = "9:16", out = `${styleId}.png`] = process.argv.slice(2);
if (!styleId) throw new Error("usage: pack-sheet.ts <style-id> <aspect> <out.png>");
const aspect = aspectArg as AspectRatio;
const root = resolve(import.meta.dirname, "../../..");
const parsed = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const spec = {
  ...parsed.spec,
  meta: { ...parsed.spec.meta, primaryStyleId: styleId, aspectRatios: [aspect] },
  scenes: parsed.spec.scenes.map((s) => ({ ...s, styleId })),
};
const work = mkdtempSync(join(tmpdir(), `mkv-sheet-${styleId}-`));
const video = await compileVideo(spec, {
  aspect,
  stylesRoot: join(root, "packages", "styles"),
  outDir: work,
  engine: "sheet",
});
const { width, height } = ASPECT_SIZES[aspect];
const frames: string[] = [];
for (const s of video.scenes) {
  const [f] = await captureFrames({ sceneDir: s.dir, width, height, atMs: [Math.round(s.durationMs * 0.6)] });
  const file = join(work, `${String(frames.length).padStart(2, "0")}.png`);
  writeFileSync(file, f!.png);
  frames.push(file);
}
await closeSharedBrowser();
const cols = aspect === "16:9" ? 2 : 4;
const scale = aspect === "16:9" ? 0.3 : 0.25;
mkdirSync(dirname(resolve(out)), { recursive: true });
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  ...frames.flatMap((f) => ["-i", f]),
  "-filter_complex",
  `${frames.map((_, i) => `[${i}]scale=iw*${scale}:-1[s${i}]`).join(";")};${frames.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${frames.length}:layout=${frames
    .map((_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = c === 0 ? "0" : Array.from({ length: c }, () => "w0").join("+");
      const y = r === 0 ? "0" : Array.from({ length: r }, () => "h0").join("+");
      return `${x}_${y}`;
    })
    .join("|")}`,
  out,
]);
console.log(out);
