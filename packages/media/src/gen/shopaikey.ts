// ShopAIKey image generation (key reseller in front of Google Nano Banana; product-owner decision, ADR 0011).
// Docs read 2026-11-13: shopaikey.com/docs/nano-banana and the OpenAPI spec at api.shopaikey.com/openapi.
//   POST https://api.shopaikey.com/images/google/generations
//   headers: Authorization: Bearer <key>
//   body: { model: "nano-banana-2.1", prompt, size: "<aspect>", imageSize: "0.5K"|"1K"|"2K"|"4K",
//           format: "png"|"jpeg"|"webp", response_format: "url"|"b64_json" }
//   response: { created, data: [{ b64_json } | { url }] }; errors: { error: { message } }
// No seed parameter and no usage block: the cost is the configured price per image (their price list).
// By default the reseller uploads results to its own public bucket and returns a URL; we always ask for base64.
import { safeFetch } from "../net/safe-fetch";
import { imageSizeFor, nearestAspect } from "./google";
import { MediaGenError, type GeneratedImage, type ImageRequest, type MediaGenProvider } from "./types";

const ENDPOINT = "https://api.shopaikey.com/images/google/generations";
export const SHOPAIKEY_IMAGE_MODEL = "nano-banana-2.1";
const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
/**
 * Estimated USD per image: list price 0.21 credit per call, one $1 credit bought at 26,000 VND / 8
 * (homepage pricing config, 2026-11-13) ≈ 683 VND ≈ $0.026. Override with SHOPAIKEY_IMAGE_COST_USD.
 */
export const SHOPAIKEY_DEFAULT_COST_USD = 0.026;

export interface ShopAiKeyOptions {
  apiKey: string;
  model?: string;
  costPerImageUsd?: number;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface ImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
}

/** PNG / JPEG / WebP magic bytes → mime (the response carries no type). */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP")
    return "image/webp";
  return null;
}

export class ShopAiKeyImageProvider implements MediaGenProvider {
  readonly id = "shopaikey";
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: ShopAiKeyOptions) {
    // The price list names models "gemini-nano-banana-2.1"; the image endpoint only accepts "nano-banana-2.1".
    this.model = (opts.model ?? SHOPAIKEY_IMAGE_MODEL).replace(/^gemini-/, "");
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    const body = {
      model: this.model,
      prompt: req.prompt,
      size: nearestAspect(req.width, req.height, RATIOS),
      imageSize: imageSizeFor(req.width, req.height),
      format: "png",
      response_format: "b64_json",
    };
    let res: Response;
    try {
      res = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 180_000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new MediaGenError(timeout ? "timeout" : "http", timeout ? "image request timed out" : String(e));
    }
    const json = (await res.json().catch(() => ({}))) as ImageResponse;
    if (!res.ok)
      throw new MediaGenError("http", `image request failed (${res.status}): ${json.error?.message ?? ""}`);
    const item = json.data?.[0];
    let image: Buffer | null = null;
    if (item?.b64_json) image = Buffer.from(item.b64_json.replace(/^data:[^,]*,/, ""), "base64");
    else if (item?.url) {
      // Fallback when the server ignores response_format: download through the SSRF-safe fetcher.
      const r = await safeFetch(item.url, { maxBytes: 30 * 1024 * 1024 }).catch(() => null);
      if (r && r.status === 200) image = r.body;
    }
    const mime = image ? sniff(image) : null;
    if (!image || !mime) throw new MediaGenError("no_image", "the response had no image");
    return {
      image,
      mime,
      costUsd: this.opts.costPerImageUsd ?? SHOPAIKEY_DEFAULT_COST_USD,
      provider: this.id,
      model: this.model,
    };
  }
}
