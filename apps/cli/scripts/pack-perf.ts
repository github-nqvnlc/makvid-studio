// Measure a style pack render cost per frame (ms) for one template, against manifest.perfBudget.
// Renders the scene to video with the given renderer (default fallback) and divides wall time by frames,
// i.e. the production render path (frame capture + encode), after one warm-up render.
// Usage: pnpm --filter @makvid/cli exec tsx scripts/pack-perf.ts <style-id> [template=hook] [aspect=9:16] [renderer=fallback]
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileVideo } from "@makvid/compiler";
import { closeSharedBrowser, createRenderer } from "@makvid/renderer";
import { ASPECT_SIZES, parseVideoSpec, type AspectRatio } from "@makvid/spec";

const [styleId, template = "hook", aspectArg = "9:16", rendererId = "fallback"] = process.argv.slice(2);
if (!styleId) throw new Error("usage: pack-perf.ts <style-id> [template] [aspect] [renderer]");
const aspect = aspectArg as AspectRatio;
const root = resolve(import.meta.dirname, "../../..");
const parsed = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const scene = parsed.spec.scenes.find((s) => s.templateId === template)!;
const spec = {
  ...parsed.spec,
  meta: { ...parsed.spec.meta, primaryStyleId: styleId, aspectRatios: [aspect] },
  // 15 s scene so the renderer start-up is amortised over 450 frames.
  scenes: [
    {
      ...scene,
      styleId,
      transitionIn: undefined,
      timing: { startMs: 0, durationMs: Number(process.env.PERF_SCENE_MS ?? 15_000) },
    },
  ],
};
const manifest = JSON.parse(
  readFileSync(join(root, "packages/styles", styleId, "manifest.json"), "utf8"),
) as {
  perfBudget: { maxMsPerFrame: number };
};
const video = await compileVideo(spec, {
  aspect,
  stylesRoot: join(root, "packages", "styles"),
  outDir: mkdtempSync(join(tmpdir(), "mkv-perf-")),
  engine: "perf",
});
const s = video.scenes[0]!;
const { width, height } = ASPECT_SIZES[aspect];
const renderer = createRenderer(rendererId === "hyperframes" ? "hyperframes" : "fallback");
const dir = mkdtempSync(join(tmpdir(), "mkv-perf-out-"));
const input = { sceneDir: s.dir, width, height, fps: 30, outPath: join(dir, "warm.mp4") };
await renderer.renderScene(input); // warm-up (browser, fonts)
const t0 = performance.now();
const r = await renderer.renderScene({ ...input, outPath: join(dir, "scene.mp4") });
const ms = (performance.now() - t0) / r.frames;
await renderer.close?.();
await closeSharedBrowser();
const budget = manifest.perfBudget.maxMsPerFrame;
console.log(
  `${styleId}/${template} ${aspect}: ${ms.toFixed(0)} ms/frame (budget ${budget}) ${ms <= budget ? "OK" : "OVER"}`,
);
process.exitCode = ms <= budget ? 0 : 1;
