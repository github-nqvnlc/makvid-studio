// FallbackRenderer: Puppeteer + virtual-time frame stepping through window.__timelines.main.seek(t),
// PNG frames piped to FFmpeg. Independent of HyperFrames (its runtime is stubbed) — the exit path if
// HyperFrames (pre-1.0) breaks or changes license.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { captureFrames } from "./capture";
import { closeSharedBrowser, openScene } from "./browser";
import { frameHashes, pngPipeEncoder } from "./ffmpeg";
import { fpsNumber, type Renderer, type RenderResult, type RenderSceneInput } from "./types";

export class FallbackRenderer implements Renderer {
  readonly id = "fallback" as const;
  readonly version = "0.1.0+puppeteer-core@25.11.0";

  async renderScene(
    input: RenderSceneInput,
    onProgress?: (p: { framesDone: number; framesTotal: number }) => void,
  ): Promise<RenderResult> {
    const fps = fpsNumber(input.fps);
    const s = await openScene(input.sceneDir, input.width, input.height);
    try {
      const total = Math.round(s.duration * fps);
      const [start, end] = input.frameRange ?? [0, total];
      mkdirSync(dirname(input.outPath), { recursive: true });
      const enc = pngPipeEncoder(fps, input.outPath);
      for (let f = start; f < Math.min(end, total); f++) {
        if (input.signal?.aborted) throw new Error("render aborted");
        await s.seek(f / fps);
        const png = await s.page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: input.width, height: input.height },
        });
        await enc.write(Buffer.from(png));
        onProgress?.({ framesDone: f - start + 1, framesTotal: end - start });
      }
      await enc.end();
      if (s.blocked.length) throw new Error(`scene requested external resources: ${s.blocked.join(", ")}`);
      const frames = Math.min(end, total) - start;
      return {
        outPath: input.outPath,
        frames,
        durationMs: Math.round((frames / fps) * 1000),
        frameHashes: await frameHashes(input.outPath),
      };
    } finally {
      await s.close();
    }
  }

  captureFrames(input: { sceneDir: string; width: number; height: number; atMs: number[] }) {
    return captureFrames(input);
  }

  close() {
    return closeSharedBrowser();
  }
}
