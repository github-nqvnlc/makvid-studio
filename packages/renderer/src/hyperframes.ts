// HyperFramesRenderer: primary renderer, pinned @hyperframes/producer@0.9.34 (Apache-2.0).
// Single pass via createRenderJob/executeRenderJob; long scenes via planV2 -> renderChunkV2 -> assembleV2.
// Network: compiled scenes contain no external URLs (compiler + lint), and production renders run in
// the render container with --network none (verified in M0, T004).
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { assembleV2, createRenderJob, executeRenderJob, planV2, renderChunkV2 } from "@hyperframes/producer";
import { captureFrames } from "./capture";
import { closeSharedBrowser } from "./browser";
import { frameHashes, probe } from "./ffmpeg";
import { fpsNumber, type Renderer, type RenderResult, type RenderSceneInput } from "./types";

export interface HyperFramesOptions {
  workers?: number;
  quality?: "draft" | "standard" | "high";
  /** Frames per chunk when rendering chunked (0 = always single pass). */
  chunkFrames?: number;
}

export class HyperFramesRenderer implements Renderer {
  readonly id = "hyperframes" as const;
  readonly version = "0.9.34";
  constructor(private readonly opts: HyperFramesOptions = {}) {}

  async renderScene(
    input: RenderSceneInput,
    onProgress?: (p: { framesDone: number; framesTotal: number }) => void,
  ): Promise<RenderResult> {
    if (input.frameRange)
      throw new Error("HyperFramesRenderer renders whole scenes; use renderChunked for ranges");
    const fps = fpsNumber(input.fps);
    const sceneDir = resolve(input.sceneDir);
    const outPath = resolve(input.outPath);
    mkdirSync(dirname(outPath), { recursive: true });
    // The producer keeps its frame work dir next to the output file; render into a local temp dir so a
    // slow or network-mounted output volume can't lose frames, then move the MP4 into place.
    const attempts = 2;
    for (let attempt = 1; ; attempt++) {
      const work = mkdtempSync(join(tmpdir(), "mkv-hf-"));
      try {
        const job = createRenderJob({
          fps: Math.round(fps),
          quality: this.opts.quality ?? "standard",
          ...(this.opts.workers ? { workers: this.opts.workers } : {}),
        });
        const tmpOut = join(work, "scene.mp4");
        await executeRenderJob(
          job,
          sceneDir,
          tmpOut,
          (j: { progress: number }) => onProgress?.({ framesDone: Math.round(j.progress), framesTotal: 100 }),
          input.signal,
        );
        copyFileSync(tmpOut, outPath);
        break;
      } catch (e) {
        if (attempt >= attempts || input.signal?.aborted) throw e;
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    }
    const p = await probe(outPath);
    return {
      outPath,
      frames: p.frames,
      durationMs: Math.round(p.durationSec * 1000),
      frameHashes: await frameHashes(outPath),
    };
  }

  /** Distributed path: plan once, render chunks (could run on different workers), assemble. */
  async renderChunked(
    input: RenderSceneInput & { chunkFrames: number },
  ): Promise<RenderResult & { chunks: number }> {
    const fps = Math.round(fpsNumber(input.fps));
    const sceneDir = resolve(input.sceneDir);
    const outPath = resolve(input.outPath);
    const work = `${outPath}.chunks`;
    rmSync(work, { recursive: true, force: true });
    mkdirSync(join(work, "parts"), { recursive: true });
    const plan = await planV2(
      sceneDir,
      {
        fps: fps as 24 | 25 | 30 | 60,
        width: input.width,
        height: input.height,
        format: "mp4",
        chunkSize: input.chunkFrames,
      },
      join(work, "plan"),
    );
    const parts: string[] = [];
    for (let i = 0; i < plan.chunkCount; i++) {
      const part = join(work, "parts", `${i}.mp4`);
      await renderChunkV2(join(work, "plan"), i, part);
      parts.push(part);
    }
    await assembleV2(join(work, "plan"), parts, outPath);
    rmSync(work, { recursive: true, force: true });
    const p = await probe(outPath);
    return {
      outPath,
      frames: p.frames,
      durationMs: Math.round(p.durationSec * 1000),
      frameHashes: await frameHashes(outPath),
      chunks: plan.chunkCount,
    };
  }

  captureFrames(input: { sceneDir: string; width: number; height: number; atMs: number[] }) {
    return captureFrames(input);
  }

  close() {
    return closeSharedBrowser();
  }
}
