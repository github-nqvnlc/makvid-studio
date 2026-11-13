// Google image generation through the Gemini Interactions API (docs read 2026-11-13:
// ai.google.dev/gemini-api/docs/image-generation, ai.google.dev/api/interactions, /docs/pricing).
//   POST https://generativelanguage.googleapis.com/v1beta/interactions
//   headers: x-goog-api-key, Api-Revision: 2026-05-20
//   body: { model, input, response_format: { type: "image", aspect_ratio, image_size }, generation_config: { seed },
//           store: false }
//   response: { status, steps: [{ type: "model_output", content: [{ type: "image", data (base64), mime_type }] }],
//               usage: { total_input_tokens, output_tokens_by_modality: [{ modality, tokens }], ... } }
// Pricing (paid tier, standard): input $1.50 / 1M tokens, text + thinking output $7.50 / 1M, image output
// $30 / 1M ($0.0336 per 1K image). Every image carries Google's SynthID watermark.
import { MediaGenError, type GeneratedImage, type ImageRequest, type MediaGenProvider } from "./types";

export const GOOGLE_IMAGE_MODEL = "gemini-nano-banana-2.1";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";

/** USD per token (paid tier, standard). */
export const GOOGLE_IMAGE_PRICE = {
  input: 1.5 / 1e6,
  textOutput: 7.5 / 1e6,
  imageOutput: 30 / 1e6,
  /** Used when a response carries no usage block: one 1K image. */
  perImage1K: 0.0336,
};

/** Aspect ratios the API accepts for image output. */
const RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
];

/** Closest supported aspect ratio (by log ratio, so 9:16 and 16:9 are symmetric). */
export function nearestAspect(width: number, height: number): string {
  const want = Math.log(width / height);
  let best = RATIOS[0]!;
  let bestD = Infinity;
  for (const r of RATIOS) {
    const [w, h] = r.split(":").map(Number) as [number, number];
    const d = Math.abs(Math.log(w / h) - want);
    if (d < bestD) [best, bestD] = [r, d];
  }
  return best;
}

/** 1K is about 1024 px on the long side; a full-frame 1080×1920 slot needs 2K ($0.0504) to stay sharp. */
export function imageSizeFor(width: number, height: number): "1K" | "2K" {
  return Math.max(width, height) > 1400 ? "2K" : "1K";
}

interface ModalityTokens {
  modality?: string;
  tokens?: number;
}
interface InteractionResponse {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    output_tokens_by_modality?: ModalityTokens[];
  };
  error?: { message?: string };
}

/** Cost of one interaction from its usage block (thinking is billed as text output). */
export function googleImageCost(usage: InteractionResponse["usage"], images: number): number {
  if (!usage) return images * GOOGLE_IMAGE_PRICE.perImage1K;
  const byMod = usage.output_tokens_by_modality ?? [];
  const imageTokens = byMod
    .filter((m) => m.modality?.toLowerCase() === "image")
    .reduce((a, m) => a + (m.tokens ?? 0), 0);
  const otherOut =
    Math.max(0, (usage.total_output_tokens ?? 0) - imageTokens) + (usage.total_thought_tokens ?? 0);
  const cost =
    (usage.total_input_tokens ?? 0) * GOOGLE_IMAGE_PRICE.input +
    otherOut * GOOGLE_IMAGE_PRICE.textOutput +
    imageTokens * GOOGLE_IMAGE_PRICE.imageOutput;
  return Math.round(cost * 1e6) / 1e6;
}

export interface GoogleImageOptions {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class GoogleImageProvider implements MediaGenProvider {
  readonly id = "google";
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: GoogleImageOptions) {
    this.model = opts.model ?? GOOGLE_IMAGE_MODEL;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    const body = {
      model: this.model,
      input: req.prompt,
      response_format: {
        type: "image",
        aspect_ratio: nearestAspect(req.width, req.height),
        image_size: imageSizeFor(req.width, req.height),
      },
      generation_config: { seed: req.seed },
      store: false,
    };
    let res: Response;
    try {
      res = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.opts.apiKey,
          "Api-Revision": API_REVISION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new MediaGenError(timeout ? "timeout" : "http", timeout ? "image request timed out" : String(e));
    }
    const json = (await res.json().catch(() => ({}))) as InteractionResponse;
    // Never echo the request (it carries the key); the provider message is enough to debug.
    if (!res.ok)
      throw new MediaGenError("http", `image request failed (${res.status}): ${json.error?.message ?? ""}`);
    if (json.status && json.status !== "completed")
      throw new MediaGenError("blocked", `status ${json.status}`);
    const images = (json.steps ?? [])
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === "image" && c.data);
    const last = images.at(-1);
    if (!last?.data) throw new MediaGenError("no_image", "the response had no image");
    return {
      image: Buffer.from(last.data, "base64"),
      mime: last.mime_type ?? "image/png",
      costUsd: googleImageCost(json.usage, 1),
    };
  }
}
