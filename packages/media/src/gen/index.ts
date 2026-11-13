import { GoogleImageProvider } from "./google";
import { ShopAiKeyImageProvider } from "./shopaikey";
import { MediaGenError, type GeneratedImage, type ImageRequest, type MediaGenProvider } from "./types";

export * from "./types";
export * from "./google";
export * from "./shopaikey";
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

/**
 * Tries providers in order. Moves on when a provider is unreachable or refuses the key (HTTP error, timeout,
 * empty answer); a content-safety block is final, since another provider would refuse the same prompt.
 */
export class FallbackMediaGen implements MediaGenProvider {
  readonly id: string;
  readonly model: string;
  constructor(private readonly providers: MediaGenProvider[]) {
    if (!providers.length) throw new Error("FallbackMediaGen needs at least one provider");
    this.id = providers[0]!.id;
    this.model = providers[0]!.model;
  }
  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    let last: unknown;
    for (const p of this.providers) {
      try {
        const out = await p.generateImage(req);
        return { provider: p.id, model: p.model, ...out };
      } catch (e) {
        if (e instanceof MediaGenError && e.code === "blocked") throw e;
        last = e;
      }
    }
    throw last;
  }
}

export interface MediaGenConfig {
  /** `off` (default), `mock`, or a comma-separated provider order: `shopaikey`, `google`, `shopaikey,google`. */
  mode?: string;
  geminiApiKey?: string;
  googleModel?: string;
  shopAiKey?: string;
  shopAiKeyModel?: string;
  shopAiKeyCostUsd?: number;
}

/** Null when media generation is off or no listed provider has a key: scenes stay HTML/SVG-only at zero cost. */
export function createMediaGen(cfg: MediaGenConfig): MediaGenProvider | null {
  const names = (cfg.mode ?? "off")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.includes("mock")) return new MockMediaGen();
  const list: MediaGenProvider[] = [];
  for (const n of names) {
    if (n === "google" && cfg.geminiApiKey) {
      list.push(
        new GoogleImageProvider({
          apiKey: cfg.geminiApiKey,
          ...(cfg.googleModel ? { model: cfg.googleModel } : {}),
        }),
      );
    }
    if (n === "shopaikey" && cfg.shopAiKey) {
      list.push(
        new ShopAiKeyImageProvider({
          apiKey: cfg.shopAiKey,
          ...(cfg.shopAiKeyModel ? { model: cfg.shopAiKeyModel } : {}),
          ...(cfg.shopAiKeyCostUsd !== undefined ? { costPerImageUsd: cfg.shopAiKeyCostUsd } : {}),
        }),
      );
    }
  }
  if (!list.length) return null;
  return list.length === 1 ? list[0]! : new FallbackMediaGen(list);
}

/** Reads MAKVID_MEDIAGEN, GEMINI_API_KEY, MAKVID_MEDIAGEN_MODEL, SHOPAIKEY_API_KEY, SHOPAIKEY_IMAGE_MODEL,
 *  SHOPAIKEY_IMAGE_COST_USD. With MAKVID_MOCK_PROVIDERS=1 any enabled mode becomes `mock` (no paid calls). */
export function mediaGenFromEnv(env: NodeJS.ProcessEnv = process.env): MediaGenProvider | null {
  const mode = env.MAKVID_MEDIAGEN;
  const cost = Number(env.SHOPAIKEY_IMAGE_COST_USD);
  return createMediaGen({
    mode: env.MAKVID_MOCK_PROVIDERS === "1" && mode && mode !== "off" ? "mock" : mode,
    geminiApiKey: env.GEMINI_API_KEY,
    googleModel: env.MAKVID_MEDIAGEN_MODEL,
    shopAiKey: env.SHOPAIKEY_API_KEY,
    shopAiKeyModel: env.SHOPAIKEY_IMAGE_MODEL,
    ...(env.SHOPAIKEY_IMAGE_COST_USD && Number.isFinite(cost) ? { shopAiKeyCostUsd: cost } : {}),
  });
}
