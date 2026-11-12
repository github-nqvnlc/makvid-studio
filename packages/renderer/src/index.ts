// Renderer interface + HyperFrames and fallback renderers, capture, mux.
import { FallbackRenderer } from "./fallback";
import { HyperFramesRenderer, type HyperFramesOptions } from "./hyperframes";
import type { Renderer } from "./types";

export * from "./types";
export * from "./ffmpeg";
export * from "./mux";
export { captureFrames } from "./capture";
export { findChrome, closeSharedBrowser } from "./browser";
export { FallbackRenderer } from "./fallback";
export { HyperFramesRenderer, type HyperFramesOptions } from "./hyperframes";

export function createRenderer(id: "hyperframes" | "fallback", opts: HyperFramesOptions = {}): Renderer {
  return id === "hyperframes" ? new HyperFramesRenderer(opts) : new FallbackRenderer();
}
export * from "./qa";
