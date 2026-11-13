// AI media generation (T124, ADR 0011). Off by default: with no provider configured a project never calls a paid
// image service and its media-gen cost is zero.

export interface ImageRequest {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}

export interface GeneratedImage {
  image: Buffer;
  mime: string;
  /** What this call cost; 0 when served from the cache. */
  costUsd: number;
  /** True when the result came from the content-hash cache (no provider call). */
  cached?: boolean;
  /** Which provider actually made it (differs from the wrapper when a fallback answered). */
  provider?: string;
  model?: string;
}

export interface VideoRequest {
  prompt: string;
  durationSec: number;
  seed: number;
}

export interface MediaGenProvider {
  readonly id: string;
  readonly model: string;
  generateImage(req: ImageRequest): Promise<GeneratedImage>;
  generateVideo?(req: VideoRequest): Promise<{ video: Buffer; mime: string; costUsd: number }>;
}

/** One paid call, for usage records (provider names stay internal; never shown to users). */
export interface MediaGenUsage {
  provider: string;
  model: string;
  images: number;
  costUsd: number;
}

/** Where cached results live (memory in tests, assets + media_gen_cache rows in the app). */
export interface MediaGenStore {
  get(key: string): Promise<{ image: Buffer; mime: string } | null>;
  put(
    key: string,
    entry: { image: Buffer; mime: string; provider: string; model: string; costUsd: number; prompt: string },
  ): Promise<void>;
}

/** A generation failed (safety block, quota, bad response). Callers fall back to HTML/SVG-only scenes. */
export class MediaGenError extends Error {
  constructor(
    readonly code: "blocked" | "no_image" | "http" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "MediaGenError";
  }
}
