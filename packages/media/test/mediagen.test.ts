// T124: MediaGenProvider contract, Google adapter request/response mapping (fake fetch), content-hash cache,
// cost logging, and "off" ⇒ no provider at all. Live call: MAKVID_LIVE_MEDIAGEN=1 with GEMINI_API_KEY.
import { describe, expect, it } from "vitest";
import {
  CachedMediaGen,
  createMediaGen,
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
    expect(createMediaGen({ mode: "off", apiKey: "k" })).toBeNull();
    expect(createMediaGen({ mode: "google" })).toBeNull();
    expect(createMediaGen({ mode: "google", apiKey: "k" })).toBeInstanceOf(GoogleImageProvider);
    expect(createMediaGen({ mode: "mock" })).toBeInstanceOf(MockMediaGen);
  });
});

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
