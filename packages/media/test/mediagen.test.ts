// T124: MediaGenProvider contract, Google adapter request/response mapping (fake fetch), content-hash cache,
// ShopAIKey adapter, fallback chain, cost logging, and "off" ⇒ no provider at all. Live call: MAKVID_LIVE_MEDIAGEN=1 with GEMINI_API_KEY.
import { describe, expect, it } from "vitest";
import {
  CachedMediaGen,
  createMediaGen,
  FallbackMediaGen,
  SHOPAIKEY_DEFAULT_COST_USD,
  ShopAiKeyImageProvider,
  GOOGLE_IMAGE_MODEL,
  GoogleImageProvider,
  googleImageCost,
  imageSizeFor,
  MediaGenError,
  mediaGenCacheKey,
  MemoryMediaGenStore,
  MockMediaGen,
  nearestAspect,
  type MediaGenUsage,
} from "../src";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const REQ = { prompt: "Một tách cà phê sữa đá trên bàn gỗ", width: 1080, height: 1920, seed: 7 };

function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const OK = {
  status: "completed",
  steps: [
    { type: "thought", summary: [] },
    {
      type: "model_output",
      content: [{ type: "image", data: PNG.toString("base64"), mime_type: "image/png" }],
    },
  ],
  usage: {
    total_input_tokens: 20,
    total_output_tokens: 1120,
    total_thought_tokens: 0,
    output_tokens_by_modality: [{ modality: "image", tokens: 1120 }],
  },
};

describe("Google image adapter", () => {
  it("maps size to the nearest supported aspect ratio and image size", () => {
    expect(nearestAspect(1080, 1920)).toBe("9:16");
    expect(nearestAspect(1920, 1080)).toBe("16:9");
    expect(nearestAspect(1080, 1080)).toBe("1:1");
    expect(nearestAspect(1080, 1350)).toBe("4:5");
    expect(imageSizeFor(1080, 1920)).toBe("2K");
    expect(imageSizeFor(1024, 1024)).toBe("1K");
  });

  it("sends the documented request and decodes the last model_output image", async () => {
    const { f, calls } = fakeFetch(OK);
    const p = new GoogleImageProvider({ apiKey: "test-key", fetch: f });
    const out = await p.generateImage(REQ);
    expect(out.image.equals(PNG)).toBe(true);
    expect(out.mime).toBe("image/png");
    const c = calls[0]!;
    expect(c.url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    const h = c.init.headers as Record<string, string>;
    expect(h["x-goog-api-key"]).toBe("test-key");
    expect(h["Api-Revision"]).toBe("2026-05-20");
    const body = JSON.parse(String(c.init.body));
    expect(body).toMatchObject({
      model: GOOGLE_IMAGE_MODEL,
      input: REQ.prompt,
      response_format: { type: "image", aspect_ratio: "9:16", image_size: "2K" },
      generation_config: { seed: 7 },
      store: false,
    });
  });

  it("prices from usage: one 1K image ≈ $0.0336 plus input tokens", () => {
    expect(googleImageCost(OK.usage, 1)).toBeCloseTo(1120 * 30e-6 + 20 * 1.5e-6, 6);
    expect(googleImageCost(undefined, 1)).toBe(0.0336);
  });

  it("raises MediaGenError on HTTP errors, blocked status and missing images, without leaking the key", async () => {
    const bad = new GoogleImageProvider({
      apiKey: "secret-key",
      fetch: fakeFetch({ error: { message: "quota" } }, 429).f,
    });
    const err = await bad.generateImage(REQ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MediaGenError);
    expect((err as MediaGenError).code).toBe("http");
    expect(String((err as Error).message)).not.toContain("secret-key");

    const wrapped = new GoogleImageProvider({
      apiKey: "k",
      fetch: fakeFetch([{ error: { message: "service account disabled" } }], 401).f,
    });
    await expect(wrapped.generateImage(REQ)).rejects.toThrow("(401): service account disabled");

    const blocked = new GoogleImageProvider({
      apiKey: "k",
      fetch: fakeFetch({ status: "failed", steps: [] }).f,
    });
    await expect(blocked.generateImage(REQ)).rejects.toMatchObject({ code: "blocked" });
    const empty = new GoogleImageProvider({
      apiKey: "k",
      fetch: fakeFetch({ status: "completed", steps: [] }).f,
    });
    await expect(empty.generateImage(REQ)).rejects.toMatchObject({ code: "no_image" });
  });
});

describe("content-hash cache and cost logging", () => {
  it("same request is generated and billed once; a different seed is a new image", async () => {
    const inner = new MockMediaGen();
    const usage: MediaGenUsage[] = [];
    const gen = new CachedMediaGen(inner, new MemoryMediaGenStore(), (u) => void usage.push(u));
    const a = await gen.generateImage(REQ);
    const b = await gen.generateImage({ ...REQ, prompt: `  ${REQ.prompt.normalize("NFD")}  ` });
    expect(b.cached).toBe(true);
    expect(b.costUsd).toBe(0);
    expect(b.image.equals(a.image)).toBe(true);
    expect(inner.calls).toBe(1);
    expect(usage).toHaveLength(1);
    await gen.generateImage({ ...REQ, seed: 8 });
    expect(inner.calls).toBe(2);
  });

  it("the key covers provider, model, prompt, size and seed", () => {
    const k = mediaGenCacheKey("google", GOOGLE_IMAGE_MODEL, REQ);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(mediaGenCacheKey("google", "other", REQ)).not.toBe(k);
    expect(mediaGenCacheKey("google", GOOGLE_IMAGE_MODEL, { ...REQ, width: 1920, height: 1080 })).not.toBe(k);
  });
});

describe("configuration", () => {
  it("off by default and without a key: no provider, so zero media-gen cost", () => {
    expect(createMediaGen({})).toBeNull();
    expect(createMediaGen({ mode: "off", geminiApiKey: "k", shopAiKey: "k" })).toBeNull();
    expect(createMediaGen({ mode: "google" })).toBeNull();
    expect(createMediaGen({ mode: "google", geminiApiKey: "k" })).toBeInstanceOf(GoogleImageProvider);
    expect(createMediaGen({ mode: "shopaikey", shopAiKey: "k" })).toBeInstanceOf(ShopAiKeyImageProvider);
    expect(createMediaGen({ mode: "mock" })).toBeInstanceOf(MockMediaGen);
  });

  it("a provider order becomes a fallback chain; providers without a key are skipped", () => {
    const both = createMediaGen({ mode: "shopaikey,google", shopAiKey: "a", geminiApiKey: "b" });
    expect(both).toBeInstanceOf(FallbackMediaGen);
    expect(both?.id).toBe("shopaikey");
    expect(createMediaGen({ mode: "shopaikey,google", geminiApiKey: "b" })).toBeInstanceOf(
      GoogleImageProvider,
    );
  });
});

describe("ShopAIKey adapter", () => {
  const OKG = {
    candidates: [
      { content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG.toString("base64") } }] } },
    ],
    usageMetadata: { promptTokenCount: 93, candidatesTokenCount: 1120 },
  };
  it("calls the Gemini-compatible route with the key as a query parameter", async () => {
    const { f, calls } = fakeFetch(OKG);
    const out = await new ShopAiKeyImageProvider({ apiKey: "sk test", fetch: f }).generateImage(REQ);
    expect(out.image.equals(PNG)).toBe(true);
    expect(out.mime).toBe("image/png");
    expect(out.costUsd).toBeCloseTo(SHOPAIKEY_DEFAULT_COST_USD * 1.5, 6); // 1080x1920 -> 2K
    const c = calls[0]!;
    expect(c.url).toBe(
      "https://api.shopaikey.com/v1beta/models/gemini-nano-banana-2.1:generateContent?key=sk%20test",
    );
    expect(JSON.parse(String(c.init.body))).toEqual({
      contents: [{ parts: [{ text: REQ.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "9:16", imageSize: "2K" },
        seed: 7,
      },
    });
  });

  it("accepts both model spellings and prices 1K images at the base rate", async () => {
    expect(new ShopAiKeyImageProvider({ apiKey: "k", model: "nano-banana-2.1" }).model).toBe(
      "gemini-nano-banana-2.1",
    );
    const { f } = fakeFetch(OKG);
    const p = new ShopAiKeyImageProvider({ apiKey: "k", costPerImageUsd: 0.02, fetch: f });
    expect((await p.generateImage({ ...REQ, width: 1024, height: 1024 })).costUsd).toBe(0.02);
  });

  it("errors carry the server message but never the key; safety stops are 'blocked'", async () => {
    const bad = new ShopAiKeyImageProvider({
      apiKey: "sk-secret",
      fetch: fakeFetch({ error: { message: "Authentication failed" } }, 401).f,
    });
    const err = await bad.generateImage(REQ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "http" });
    expect(String((err as Error).message)).toContain("Authentication failed");
    expect(String((err as Error).message)).not.toContain("sk-secret");

    const down = new ShopAiKeyImageProvider({
      apiKey: "sk-secret",
      fetch: (async () => {
        throw new TypeError("fetch failed for https://api.shopaikey.com/...?key=sk-secret");
      }) as unknown as typeof fetch,
    });
    const err2 = await down.generateImage(REQ).catch((e: unknown) => e);
    expect(String((err2 as Error).message)).not.toContain("sk-secret");

    const safety = new ShopAiKeyImageProvider({
      apiKey: "k",
      fetch: fakeFetch({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] }).f,
    });
    await expect(safety.generateImage(REQ)).rejects.toMatchObject({ code: "blocked" });
    const junk = new ShopAiKeyImageProvider({
      apiKey: "k",
      fetch: fakeFetch({
        candidates: [
          { content: { parts: [{ inlineData: { data: Buffer.from("<html>").toString("base64") } }] } },
        ],
      }).f,
    });
    await expect(junk.generateImage(REQ)).rejects.toMatchObject({ code: "no_image" });
  });
});

describe("fallback", () => {
  it("uses the next provider when the first is down, logs the one that answered", async () => {
    const down = new ShopAiKeyImageProvider({ apiKey: "k", fetch: fakeFetch({}, 503).f });
    const google = new GoogleImageProvider({ apiKey: "g", fetch: fakeFetch(OK).f });
    const usage: MediaGenUsage[] = [];
    const gen = new CachedMediaGen(new FallbackMediaGen([down, google]), new MemoryMediaGenStore(), (u) => {
      usage.push(u);
    });
    const out = await gen.generateImage(REQ);
    expect(out.provider).toBe("google");
    expect(usage).toEqual([
      { provider: "google", model: GOOGLE_IMAGE_MODEL, images: 1, costUsd: out.costUsd },
    ]);
  });

  it("a safety block is final", async () => {
    const blocked = new GoogleImageProvider({ apiKey: "g", fetch: fakeFetch({ status: "failed" }).f });
    const mock = new MockMediaGen();
    await expect(new FallbackMediaGen([blocked, mock]).generateImage(REQ)).rejects.toMatchObject({
      code: "blocked",
    });
    expect(mock.calls).toBe(0);
  });
});

describe.runIf(process.env.MAKVID_LIVE_MEDIAGEN === "1" && !!process.env.SHOPAIKEY_API_KEY)(
  "live ShopAIKey call",
  () => {
    it("returns a real image", { timeout: 240_000 }, async () => {
      const p = new ShopAiKeyImageProvider({ apiKey: process.env.SHOPAIKEY_API_KEY! });
      const out = await p.generateImage({ ...REQ, width: 1024, height: 1024 });
      expect(out.image.length).toBeGreaterThan(10_000);
      expect(out.mime.startsWith("image/")).toBe(true);
    });
  },
);

describe.runIf(process.env.MAKVID_LIVE_MEDIAGEN === "1" && !!process.env.GEMINI_API_KEY)(
  "live Google call",
  () => {
    it("returns a real image and a cost", { timeout: 180_000 }, async () => {
      const p = new GoogleImageProvider({ apiKey: process.env.GEMINI_API_KEY! });
      const out = await p.generateImage({ ...REQ, width: 1024, height: 1024 });
      expect(out.image.length).toBeGreaterThan(10_000);
      expect(out.mime).toMatch(/^image\//);
      expect(out.costUsd).toBeGreaterThan(0);
      expect(out.costUsd).toBeLessThan(0.1);
      console.warn(`live image: ${out.image.length} bytes, ${out.mime}, $${out.costUsd}`);
    });
  },
);
