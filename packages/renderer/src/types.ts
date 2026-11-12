// Renderer contract (contracts/provider-interfaces.md). Every renderer turns a compiled scene directory
// (HTML + local assets, no external URLs) into an H.264 MP4, and can capture frames with DOM metrics for QA.
export type Fps = number | { num: number; den: number };

export interface RenderSceneInput {
  sceneDir: string;
  width: number;
  height: number;
  fps: Fps;
  /** Render only frames [start, endExclusive) (chunked rendering). */
  frameRange?: [number, number];
  outPath: string;
  signal?: AbortSignal;
}

export interface RenderResult {
  outPath: string;
  frames: number;
  durationMs: number;
  frameHashes?: string[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QaElement {
  qa: string; // data-qa value
  rect: Rect;
  opacity: number; // effective opacity (product of ancestors)
  fontSize: number;
  color: string;
  background: string | null; // effective solid background, null when unknown (gradient/image)
  contrast: number | null; // WCAG ratio text vs background
  overflow: boolean; // a fitted line or the element content exceeds its box
  text: string;
}

export interface DomMetrics {
  width: number;
  height: number;
  elements: QaElement[];
  /** Requests the page tried to make outside the scene directory (must be empty). */
  blockedRequests: string[];
  fontsLoaded: string[];
}

export interface CapturedFrame {
  atMs: number;
  png: Buffer;
  dom?: DomMetrics;
}

export interface Renderer {
  readonly id: "hyperframes" | "fallback";
  readonly version: string;
  renderScene(
    input: RenderSceneInput,
    onProgress?: (p: { framesDone: number; framesTotal: number }) => void,
  ): Promise<RenderResult>;
  captureFrames(input: {
    sceneDir: string;
    width: number;
    height: number;
    atMs: number[];
  }): Promise<CapturedFrame[]>;
  close?(): Promise<void>;
}

export const fpsNumber = (fps: Fps): number => (typeof fps === "number" ? fps : fps.num / fps.den);
