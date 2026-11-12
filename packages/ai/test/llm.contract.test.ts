// T063: LlmProvider contract against a local OpenAI-compatible mock server (no network).
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createLlm,
  DEFAULT_STEPS,
  extractJson,
  LlmOutputError,
  openAiCompatibleAdapter,
  type TokenUsage,
} from "../src";

type Handler = (body: { model: string; messages: Array<{ role: string; content: string }> }) => string;
let handler: Handler = () => "ok";
const seen: Array<{ model: string; auth: string; messages: number }> = [];
let server: Server;
let baseURL = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push({
        model: body.model,
        auth: String(req.headers.authorization),
        messages: body.messages.length,
      });
      if (body.model === "broken-model") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "upstream down" } }));
        return;
      }
      const content = handler(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      );
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  const a = server.address();
  baseURL = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}/v1`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

const make = (usages: Array<[string, TokenUsage]> = [], fallbackModel?: string) =>
  createLlm({
    adapters: { fpt: openAiCompatibleAdapter("fpt", baseURL, "test-key-123") },
    steps: DEFAULT_STEPS,
    ...(fallbackModel ? { fallback: { provider: "fpt", model: fallbackModel } } : {}),
    onUsage: (step, u) => void usages.push([step, u]),
  });

const Story = z.object({
  title: z.string().min(1),
  scenes: z.array(z.object({ narration: z.string() })).min(1),
});

describe("LlmProvider contract", () => {
  it("routes each step to its configured model and captures usage + cost", async () => {
    seen.length = 0;
    handler = () => "Xin chào";
    const usages: Array<[string, TokenUsage]> = [];
    const llm = make(usages);
    const r = await llm.complete({ step: "script", messages: [{ role: "user", content: "hi" }] });
    await llm.complete({ step: "chat_edit", messages: [{ role: "user", content: "hi" }] });
    expect(r.output).toBe("Xin chào");
    expect(seen.map((s) => s.model)).toEqual(["gemma-4-31B-it", "gemma-4-26B-A4B-it"]);
    expect(seen[0]!.auth).toBe("Bearer test-key-123");
    expect(usages[0]![1]).toMatchObject({
      provider: "fpt",
      model: "gemma-4-31B-it",
      inputTokens: 100,
      outputTokens: 50,
      attempts: 1,
    });
    expect(usages[0]![1].costUsd).toBe(0.000038); // (100*0.15 + 50*0.45)/1e6 rounded to numeric(12,6)
  });

  it("validates JSON with zod and NFC-normalizes it", async () => {
    handler = () =>
      "```json\n" +
      JSON.stringify({ title: "Lãi kép".normalize("NFD"), scenes: [{ narration: "Ẩn số" }] }) +
      "\n```";
    const r = await make().complete({
      step: "storyboard",
      messages: [{ role: "user", content: "x" }],
      schema: Story,
    });
    expect(r.output.title).toBe("Lãi kép".normalize("NFC"));
  });

  it("repairs once by sending validation errors back", async () => {
    seen.length = 0;
    let n = 0;
    handler = (b) => {
      n++;
      if (n === 1) return JSON.stringify({ title: "", scenes: [] });
      expect(b.messages.at(-1)!.content).toMatch(/Kết quả chưa hợp lệ/);
      return JSON.stringify({ title: "Ổn", scenes: [{ narration: "a" }] });
    };
    const usages: Array<[string, TokenUsage]> = [];
    const r = await make(usages).complete({
      step: "storyboard",
      messages: [{ role: "user", content: "x" }],
      schema: Story,
    });
    expect(r.output.title).toBe("Ổn");
    expect(r.usage.map((u) => u.attempts)).toEqual([1, 2]);
    expect(seen[1]!.messages).toBe(3); // original + bad answer + repair request
  });

  it("applies semantic validators", async () => {
    let n = 0;
    handler = () =>
      JSON.stringify({ title: n++ === 0 ? "dài quá dài quá" : "ngắn", scenes: [{ narration: "a" }] });
    const r = await make().complete({
      step: "storyboard",
      messages: [{ role: "user", content: "x" }],
      schema: Story,
      validate: (v) => (v.title.split(" ").length > 2 ? ["title has more than 2 words"] : []),
    });
    expect(r.output.title).toBe("ngắn");
  });

  it("falls back to the fallback model after two invalid answers", async () => {
    seen.length = 0;
    handler = (b) =>
      b.model === "DeepSeek-V4.1-Flash"
        ? JSON.stringify({ title: "ok", scenes: [{ narration: "a" }] })
        : "không phải JSON";
    const r = await make([], "DeepSeek-V4.1-Flash").complete({
      step: "storyboard",
      messages: [{ role: "user", content: "x" }],
      schema: Story,
    });
    expect(r.output.title).toBe("ok");
    expect(seen.map((s) => s.model)).toEqual(["gemma-4-31B-it", "gemma-4-31B-it", "DeepSeek-V4.1-Flash"]);
  });

  it("falls back when the provider errors, and throws LlmOutputError when everything fails", async () => {
    handler = () => "not json";
    const llm = createLlm({
      adapters: { fpt: openAiCompatibleAdapter("fpt", baseURL, "k") },
      steps: { ...DEFAULT_STEPS, storyboard: { provider: "fpt", model: "broken-model" } },
      fallback: { provider: "fpt", model: "gemma-4-31B-it" },
    });
    const err = await llm
      .complete({ step: "storyboard", messages: [{ role: "user", content: "x" }], schema: Story })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LlmOutputError);
    expect((err as LlmOutputError).problems.join()).toMatch(/no JSON/);
  });

  it("extractJson tolerates prose around the object", () => {
    expect(extractJson('Đây là kết quả: {"a":1} chúc bạn vui')).toEqual({ a: 1 });
    expect(() => extractJson("không có gì")).toThrow();
  });
});

// Live smoke test against FPT (opt-in, costs < $0.001): MAKVID_LIVE_LLM=1
describe.runIf(process.env.MAKVID_LIVE_LLM === "1")("live FPT", () => {
  it("default script model answers in Vietnamese", async () => {
    const { configFromEnv } = await import("../src");
    const r = await createLlm(configFromEnv()).complete({
      step: "script",
      messages: [{ role: "user", content: "Một câu ngắn: thủ đô Việt Nam?" }],
    });
    expect(r.output).toMatch(/Hà Nội/);
    expect(r.usage[0]!.costUsd).toBeGreaterThan(0);
  }, 120_000);
});
