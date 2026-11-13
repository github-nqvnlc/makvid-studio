# ADR 0011 — AI images in scenes: Nano Banana 2.1 via ShopAIKey (fallback Google), off by default, cache

- **Status**: Accepted (2026-11-13; providers chosen by the product owner, amended the same day)
- **Context**: US8 lets a project optionally use AI-generated images instead of pure HTML/SVG/CSS visuals
  (T124). FPT AI Marketplace has no image model. Options were compared on 2026-11-13 from the official
  pricing pages: Google Nano Banana 2.1 ($0.0336 per 1K image, $0.0504 per 2K), Gemini 3.1 Flash Image
  ($0.045 at 0.5K), OpenAI gpt-image-2.6 ($30 / 1M output tokens). Google video generation is about $0.10/s.

## Decision

- **Production provider: ShopAIKey** (product-owner decision, 2026-11-13, risks below accepted), a Vietnamese
  key reseller in front of Google's image models: `POST https://api.shopaikey.com/images/google/generations`,
  `Authorization: Bearer`, model `nano-banana-2.1`, `size` (10 aspect ratios), `imageSize`, `format`,
  `response_format: "b64_json"` (docs + OpenAPI read 2026-11-13). No seed, no usage block: cost is a configured
  price per image (`SHOPAIKEY_IMAGE_COST_USD`, default $0.026 ≈ 0.21 credit at 26,000 VND / 8 per credit).
  Their default is to upload results to their public bucket and return a URL; we always request base64, and a
  URL answer is only downloaded through `safeFetch`.
- **Fallback chain**: `MAKVID_MEDIAGEN=shopaikey,google` tries providers in order; on HTTP error, timeout or an
  empty answer the next one is used and the usage record names the provider that answered. A safety block is
  final. This limits the impact of the reseller being shut down or a key being revoked.
- Official provider: **Google Gemini Interactions API**, model `gemini-nano-banana-2.1` (docs read 2026-11-13:
  `POST /v1beta/interactions`, `x-goog-api-key`, `Api-Revision: 2026-05-20`, `response_format` with
  `aspect_ratio` / `image_size`, `generation_config.seed`, `store: false` so Google does not keep the request).
  Reuses `GEMINI_API_KEY`; model overridable with `MAKVID_MEDIAGEN_MODEL`.
- **Off by default** (`MAKVID_MEDIAGEN=off`): no provider object exists, so a project's media-gen cost is zero.
  `mock` gives a free deterministic SVG for tests and `dev:mock`.
- **Content-hash cache**: sha256 of provider, model, NFC prompt (whitespace collapsed), size and seed. Hits cost
  nothing and make no call. In the app the image is stored as an `ai` / `generated_image` asset (sha256-deduped)
  and `media_gen_cache` maps the key to it, both under workspace RLS — workspaces never share cached images.
- **Cost logging**: one usage record per paid call (step `media_gen`, `images = 1`), priced from the response's
  token usage (input $1.50/1M, text + thinking $7.50/1M, image $30/1M); $0.0336 when usage is missing.
- Aspect ratio: nearest supported ratio to the slot; `2K` for full-frame 1080×1920 slots, `1K` otherwise.
- Errors (`MediaGenError`: blocked, no image, HTTP, timeout) never reach users with provider names; the caller
  falls back to the HTML/SVG scene.

## Consequences

- **Accepted risks of the reseller** (stated to the product owner before the decision): not an official Google
  channel and prices far below list, so upstream keys may be revoked at any time; their terms allow suspension
  without notice, no refunds of unused credit, liability capped at 3 months of payments, no uptime commitment.
  Customer prompts transit their servers (they state they keep only metadata) — the MakVid privacy policy must
  list them as a sub-processor (M6 legal pages). Commercial rights to images depend on the upstream account.
- Revisit when revenue justifies it: switch the order to `google,shopaikey` with a valid Google key.
- Every Google image carries a SynthID watermark (invisible); asset licence notes say "generated".
- Video generation (`generateVideo`) is not implemented yet; it stays optional in the interface.
- Not yet done: choosing which scenes get an AI image (storyboard slot + prompt) and the per-plan quota
  (`plans.limits.ai_images`, T138). The free plan has no media generation.
- Live check: `apps/cli/scripts/m4-mediagen-live.ts <shopaikey|google>`. The first Google key tried was refused
  (401, its service account was disabled).
