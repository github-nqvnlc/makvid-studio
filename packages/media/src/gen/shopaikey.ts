// ShopAIKey image generation (key reseller in front of Google Nano Banana; product-owner decision, ADR 0011).
// Verified with a live call on 2026-11-13: the reseller's custom `/images/google/generations` endpoint answers
// "Model not found" for Nano Banana with our key, while its Gemini-compatible route works:
//   POST https://api.shopaikey.com/v1beta/models/<model>:generateContent?key=<key>
//   body: { contents: [{ parts: [{ text }] }],
//           generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize }, seed } }
//   response: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }], usageMetadata }
// The `x-goog-api-key` header is refused there (401); only the `key` query parameter authenticates, so the URL
// must never be logged. Model ids keep the price-list name (`gemini-nano-banana-2.1`).
import { GOOGLE_RATIOS, imageSizeFor, nearestAspect } from "./google";
import { MediaGenError, type GeneratedImage, type ImageRequest, type MediaGenProvider } from "./types";

const BASE = "https://api.shopaikey.com/v1beta/models";
export const SHOPAIKEY_IMAGE_MODEL = "gemini-nano-banana-2.1";
/**
 * Estimated USD per 1K image (list 0.21 credit, one $1 credit at 26,000 VND / 8 ≈ $0.026; 2026-11-13).
 * 2K images are charged 1.5× (Google's 2K / 1K ratio). Override with SHOPAIKEY_IMAGE_COST_USD.
 */
export const SHOPAIKEY_DEFAULT_COST_USD = 0.026;

export interface ShopAiKeyOptions {
  apiKey: string;
  model?: string;
  /** USD per 1K image. */
  costPerImageUsd?: number;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface Part {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}
interface GenerateResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Part[] } }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/** PNG / JPEG / WebP magic bytes → mime; anything else is not accepted as an image. */
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
    const m = opts.model ?? SHOPAIKEY_IMAGE_MODEL;
    // The custom endpoint's short names ("nano-banana-2.1") map to the price-list ids.
    this.model = m.startsWith("nano-banana") ? `gemini-${m}` : m;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    const imageSize = imageSizeFor(req.width, req.height);
    const body = {
      contents: [{ parts: [{ text: req.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: nearestAspect(req.width, req.height, GOOGLE_RATIOS), imageSize },
        seed: req.seed,
      },
    };
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.opts.apiKey)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 180_000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      // Never include the error text: fetch errors can echo the URL, which carries the key.
      throw new MediaGenError(
        timeout ? "timeout" : "http",
        timeout ? "image request timed out" : "network error",
      );
    }
    const raw: unknown = await res.json().catch(() => ({}));
    const json = (Array.isArray(raw) ? (raw[0] ?? {}) : raw) as GenerateResponse;
    if (!res.ok)
      throw new MediaGenError("http", `image request failed (${res.status}): ${json.error?.message ?? ""}`);
    if (json.promptFeedback?.blockReason)
      throw new MediaGenError("blocked", `prompt blocked: ${json.promptFeedback.blockReason}`);
    const cand = json.candidates?.[0];
    const part = cand?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (!data) {
      const reason = cand?.finishReason ?? "";
      if (/SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY/i.test(reason))
        throw new MediaGenError("blocked", `image blocked: ${reason}`);
      throw new MediaGenError("no_image", "the response had no image");
    }
    const image = Buffer.from(data, "base64");
    const mime = sniff(image);
    if (!mime) throw new MediaGenError("no_image", "the response was not an image");
    const per1K = this.opts.costPerImageUsd ?? SHOPAIKEY_DEFAULT_COST_USD;
    return {
      image,
      mime,
      costUsd: Math.round(per1K * (imageSize === "2K" ? 1.5 : 1) * 1e6) / 1e6,
      provider: this.id,
      model: this.model,
    };
  }
}
