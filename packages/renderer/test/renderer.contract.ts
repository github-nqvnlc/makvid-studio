// Shared Renderer contract (T025): every Renderer must satisfy these properties.
// Imported by renderer.contract.test.ts for HyperFramesRenderer and FallbackRenderer.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { parseVideoSpec } from "@makvid/spec";
import { compileVideo, type CompiledVideo } from "@makvid/compiler";
import { concatAndMux, probe, ssim, type Renderer } from "../src";

const root = resolve(__dirname, "../../..");

export async function compileFixture(runtime?: "gsap" | "mkv"): Promise<CompiledVideo> {
  const r = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!r.ok) throw new Error(r.issues.join());
  return compileVideo(r.spec, {
    aspect: "16:9",
    stylesRoot: join(root, "packages/styles"),
    outDir: mkdtempSync(join(tmpdir(), "mkv-contract-")),
    engine: "contract",
    ...(runtime ? { runtime } : {}),
  });
}

export function rendererContract(
  make: () => Renderer,
  opts: { chunked: (r: Renderer, input: { sceneDir: string; outPath: string }) => Promise<string> },
) {
  const out = mkdtempSync(join(tmpdir(), "mkv-render-"));
  let video: CompiledVideo;
  const scene = () => video.scenes[0]!; // "hook", 3.0 s = 90 frames
  const input = (name: string) => ({
    sceneDir: scene().dir,
    width: video.width,
    height: video.height,
    fps: 30,
    outPath: join(out, name),
  });

  it("renders the exact frame count and size (H.264 yuv420p)", async () => {
    video = await compileFixture();
    const r = make();
    const res = await r.renderScene(input("a.mp4"));
    const p = await probe(res.outPath);
    expect(p.frames).toBe(90);
    expect([p.width, p.height]).toEqual([1920, 1080]);
    expect(p.vcodec).toBe("h264");
    expect(p.pixFmt).toBe("yuv420p");
    expect(res.frameHashes).toHaveLength(90);
    await r.close?.();
  }, 300_000);

  it("is deterministic: two renders give identical per-frame hashes", async () => {
    const r = make();
    const a = await r.renderScene(input("b1.mp4"));
    const b = await r.renderScene(input("b2.mp4"));
    expect(a.frameHashes).toEqual(b.frameHashes);
    await r.close?.();
  }, 300_000);

  it("chunked render matches the single pass (SSIM >= 0.99, same frame count)", async () => {
    const r = make();
    const single = await r.renderScene(input("c-single.mp4"));
    const chunked = await opts.chunked(r, { sceneDir: scene().dir, outPath: join(out, "c-chunked.mp4") });
    expect((await probe(chunked)).frames).toBe(single.frames);
    expect(await ssim(single.outPath, chunked)).toBeGreaterThanOrEqual(0.99);
    await r.close?.();
  }, 300_000);

  it("captures the same frame regardless of seek order", async () => {
    const r = make();
    const frames = await r.captureFrames({
      sceneDir: scene().dir,
      width: video.width,
      height: video.height,
      atMs: [2000, 400, 2900, 2000],
    });
    expect(frames[0]!.png.equals(frames[3]!.png)).toBe(true);
    expect(frames[0]!.dom!.blockedRequests).toEqual([]);
    await r.close?.();
  }, 300_000);
}

/** Fallback chunking: render frame ranges separately, then concat (what a distributed worker would do). */
export async function fallbackChunked(
  r: Renderer,
  i: { sceneDir: string; outPath: string },
): Promise<string> {
  const parts: string[] = [];
  for (const [s, e] of [
    [0, 30],
    [30, 60],
    [60, 90],
  ] as const) {
    const part = `${i.outPath}.${s}.mp4`;
    await r.renderScene({
      sceneDir: i.sceneDir,
      width: 1920,
      height: 1080,
      fps: 30,
      frameRange: [s, e],
      outPath: part,
    });
    parts.push(part);
  }
  await concatAndMux({ scenes: parts, outPath: i.outPath, fps: 30 });
  return i.outPath;
}
