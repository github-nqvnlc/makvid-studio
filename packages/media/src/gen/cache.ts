// Content-hash cache in front of any MediaGenProvider: the same prompt, size, seed and model never costs twice.
import { createHash } from "node:crypto";
import type { GeneratedImage, ImageRequest, MediaGenProvider, MediaGenStore, MediaGenUsage } from "./types";

/** Stable key: provider + model + NFC prompt (trimmed, spaces collapsed) + size + seed. */
export function mediaGenCacheKey(provider: string, model: string, req: ImageRequest): string {
  const prompt = req.prompt.normalize("NFC").trim().replace(/\s+/g, " ");
  const payload = JSON.stringify([provider, model, "image", prompt, req.width, req.height, req.seed]);
  return createHash("sha256").update(payload).digest("hex");
}

export class MemoryMediaGenStore implements MediaGenStore {
  readonly entries = new Map<string, { image: Buffer; mime: string }>();
  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async put(key: string, e: { image: Buffer; mime: string }) {
    this.entries.set(key, { image: e.image, mime: e.mime });
  }
}

export class CachedMediaGen implements MediaGenProvider {
  readonly id: string;
  readonly model: string;
  constructor(
    private readonly inner: MediaGenProvider,
    private readonly store: MediaGenStore,
    /** Called once per paid call (never on a cache hit). */
    private readonly onUsage: (u: MediaGenUsage) => void | Promise<void> = () => undefined,
  ) {
    this.id = inner.id;
    this.model = inner.model;
  }

  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    const key = mediaGenCacheKey(this.id, this.model, req);
    const hit = await this.store.get(key);
    if (hit) return { ...hit, costUsd: 0, cached: true };
    const out = await this.inner.generateImage(req);
    const provider = out.provider ?? this.id;
    const model = out.model ?? this.model;
    await this.store.put(key, {
      image: out.image,
      mime: out.mime,
      provider,
      model,
      costUsd: out.costUsd,
      prompt: req.prompt,
    });
    await this.onUsage({ provider, model, images: 1, costUsd: out.costUsd });
    return { ...out, cached: false };
  }
}
