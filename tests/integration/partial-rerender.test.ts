// T095: a single-scene chat edit re-renders only that scene (plus transition neighbours when needed) and is
// at least 3x faster than the full render, with the real renderer (Chrome + FFmpeg).
// Run: MAKVID_RENDER_TESTS=1 pnpm --filter @makvid/tests test integration/partial-rerender
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applySpecPatch, parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { createRenderer, closeSharedBrowser } from "@makvid/renderer";
import { writeWav } from "@makvid/tts";
import { renderAll, type PipelineContext } from "@makvid/pipeline";

const root = resolve(__dirname, "../..");

describe.runIf(process.env.MAKVID_RENDER_TESTS === "1")("partial re-render (T095)", () => {
  it("re-renders only the edited scene and is >= 3x faster than a full render", async () => {
    const parsed = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
    if (!parsed.ok) throw new Error(parsed.issues.join("; "));
    const spec: VideoSpec = { ...parsed.spec, meta: { ...parsed.spec.meta, aspectRatios: ["9:16"] } };
    const workDir = mkdtempSync(join(tmpdir(), "mkv-partial-"));
    let rendered = 0;
    const renderer = createRenderer("fallback");
    const ctx = {
      renderer: {
        ...renderer,
        id: renderer.id,
        version: renderer.version,
        renderScene: (i: Parameters<typeof renderer.renderScene>[0]) => (rendered++, renderer.renderScene(i)),
        captureFrames: (i: Parameters<typeof renderer.captureFrames>[0]) => renderer.captureFrames(i),
      },
      stylesRoot: join(root, "packages", "styles"),
      workDir,
      onUsage: () => undefined,
      onProgress: () => undefined,
    } as unknown as PipelineContext;
    const durationMs = spec.scenes.reduce((a, s) => a + (s.timing?.durationMs ?? 4000), 0) + 2000;
    const wav = join(workDir, "mix.wav");
    writeFileSync(wav, writeWav({ sampleRate: 22050, samples: new Float32Array(Math.round((22050 * durationMs) / 1000)) }));
    const cache = join(workDir, "cache");

    let t0 = performance.now();
    await renderAll(ctx, spec, wav, join(workDir, "out1"), cache);
    const full = performance.now() - t0;
    const fullScenes = rendered;
    expect(fullScenes).toBe(spec.scenes.length);

    // The chat edit "change the title of scene 2" (a slot of one scene, no timing change).
    const idx = spec.scenes.findIndex((s) => s.templateId === "title");
    const patched = applySpecPatch(spec, [{ op: "add", path: `/scenes/${idx}/slots/title`, value: "Lãi kép là gì?" }]);
    if (!patched.ok) throw new Error(patched.issues.join("; "));
    rendered = 0;
    t0 = performance.now();
    const out = await renderAll(ctx, patched.spec, wav, join(workDir, "out2"), cache);
    const partial = performance.now() - t0;
    await closeSharedBrowser();

    expect(rendered).toBe(1); // only the edited scene
    expect(out[0]!.cacheHits).toBe(spec.scenes.length - 1);
    console.log(`full ${Math.round(full)} ms (${fullScenes} scenes), one-scene edit ${Math.round(partial)} ms`);
    expect(full / partial).toBeGreaterThanOrEqual(3);
  }, 900_000);
});
