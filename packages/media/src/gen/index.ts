import { GoogleImageProvider } from "./google";
import type { GeneratedImage, ImageRequest, MediaGenProvider } from "./types";

export * from "./types";
export * from "./google";
export * from "./cache";

/** Free, offline stand-in for tests and `dev:mock`: a deterministic SVG that shows the prompt. */
export class MockMediaGen implements MediaGenProvider {
  readonly id = "mock";
  readonly model = "mock-image";
  calls = 0;
  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    this.calls++;
    const hue = (req.seed * 47) % 360;
    const text = req.prompt.slice(0, 60).replace(/[<>&"]/g, "");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${req.width}" height="${req.height}">` +
      `<rect width="100%" height="100%" fill="hsl(${hue} 60% 45%)"/>` +
      `<text x="50%" y="50%" fill="#fff" font-size="32" text-anchor="middle">${text}</text></svg>`;
    return { image: Buffer.from(svg), mime: "image/svg+xml", costUsd: 0 };
  }
}

export interface MediaGenConfig {
  /** `off` (default), `google`, or `mock`. */
  mode?: string;
  apiKey?: string;
  model?: string;
}

/** Null when media generation is off or not configured: callers keep HTML/SVG-only scenes at zero cost. */
export function createMediaGen(cfg: MediaGenConfig): MediaGenProvider | null {
  const mode = (cfg.mode ?? "off").toLowerCase();
  if (mode === "mock") return new MockMediaGen();
  if (mode === "google" && cfg.apiKey) {
    return new GoogleImageProvider({ apiKey: cfg.apiKey, ...(cfg.model ? { model: cfg.model } : {}) });
  }
  return null;
}

/** Reads MAKVID_MEDIAGEN (+ GEMINI_API_KEY, MAKVID_MEDIAGEN_MODEL). */
export function mediaGenFromEnv(env: NodeJS.ProcessEnv = process.env): MediaGenProvider | null {
  return createMediaGen({
    mode: env.MAKVID_MOCK_PROVIDERS === "1" && env.MAKVID_MEDIAGEN ? "mock" : env.MAKVID_MEDIAGEN,
    apiKey: env.GEMINI_API_KEY,
    model: env.MAKVID_MEDIAGEN_MODEL,
  });
}
