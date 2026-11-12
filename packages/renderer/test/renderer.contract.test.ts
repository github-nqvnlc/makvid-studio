// Runs the shared Renderer contract against both renderers. Needs Chrome + FFmpeg, so it is opt-in:
// MAKVID_RENDER_TESTS=1 pnpm --filter @makvid/renderer test   (CI: render-smoke job in the container)
import { describe } from "vitest";
import { FallbackRenderer, HyperFramesRenderer } from "../src";
import { fallbackChunked, rendererContract } from "./renderer.contract";

const enabled = process.env.MAKVID_RENDER_TESTS === "1";

describe.runIf(enabled)("Renderer contract: HyperFramesRenderer", () => {
  rendererContract(() => new HyperFramesRenderer({ workers: 4 }), {
    chunked: async (r, i) =>
      (
        await (r as HyperFramesRenderer).renderChunked({
          ...i,
          width: 1920,
          height: 1080,
          fps: 30,
          chunkFrames: 30,
        })
      ).outPath,
  });
});

describe.runIf(enabled)("Renderer contract: FallbackRenderer", () => {
  rendererContract(() => new FallbackRenderer(), { chunked: fallbackChunked });
});
