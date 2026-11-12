// Providers under test. Only providers whose key is set in the environment run; keys are never logged.
// OpenAI-compatible endpoints (FPT, OpenAI, Gemini) share one adapter; Claude uses the official Anthropic SDK.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface Completion {
  text: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

export interface Target {
  provider: string;
  model: string;
  /** USD per 1M tokens, null when not verified from an official source. */
  price: { input: number; output: number; source: string } | null;
  complete(system: string, user: string): Promise<Completion>;
}

const env = (k: string) => process.env[k]?.trim() || undefined;
const list = (k: string, dflt: string[] = []) => (env(k)?.split(",").map((s) => s.trim()).filter(Boolean) ?? dflt);

function openAiCompatible(provider: string, baseURL: string, apiKey: string, model: string, price: Target["price"]): Target {
  const client = new OpenAI({ apiKey, baseURL, timeout: 180_000, maxRetries: 1 });
  return {
    provider,
    model,
    price,
    async complete(system, user) {
      const r = await client.chat.completions.create({
        model,
        max_tokens: 8000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const u = r.usage as (OpenAI.CompletionUsage & { completion_tokens_details?: { reasoning_tokens?: number } }) | undefined;
      return {
        text: r.choices[0]?.message?.content ?? "",
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
        ...(u?.completion_tokens_details?.reasoning_tokens ? { reasoningTokens: u.completion_tokens_details.reasoning_tokens } : {}),
      };
    },
  };
}

/** FPT catalog prices (docs/fpt.ai/fpt-ai-list-model.json, provided by the product owner). */
function fptPrice(model: string): Target["price"] {
  try {
    const cat = JSON.parse(readFileSync(new URL("../../docs/fpt.ai/fpt-ai-list-model.json", import.meta.url), "utf8")) as {
      data: { items: Array<{ code: string; name: string; pricing?: { input_price_per_1m: string; output_price_per_1m: string } }> };
    };
    const m = cat.data.items.find((x) => x.name.toLowerCase() === model.toLowerCase() || x.code.toLowerCase() === model.toLowerCase());
    if (!m?.pricing) return null;
    return { input: Number(m.pricing.input_price_per_1m), output: Number(m.pricing.output_price_per_1m), source: "docs/fpt.ai/fpt-ai-list-model.json" };
  } catch {
    return null;
  }
}

/** Anthropic first-party list prices (claude-api skill table, cached 2026-11-03). */
const CLAUDE_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

// Chat models allowed for the current FPT key (verified by real calls on 2026-11-12, key with all models).
// Shortlist (rules pass >= 8/10, ordered by latency), product-owner criteria 2026-11-12.
const FPT_DEFAULT = [
  "gemma-4-26B-A4B-it",
  "gpt-oss-120b",
  "gemma-4-31B-it",
  "Qwen3.6-27B",
  "DeepSeek-V4-Flash",
  "DeepSeek-V4.1-Flash",
];

export function targets(): Target[] {
  const out: Target[] = [];
  const fpt = env("FPT_AI_API_KEY");
  if (fpt) for (const m of list("FPT_LLM_MODELS", FPT_DEFAULT)) out.push(openAiCompatible("fpt", "https://mkp-api.fptcloud.com/v1", fpt, m, fptPrice(m)));
  const oai = env("OPENAI_API_KEY");
  if (oai) for (const m of list("OPENAI_MODELS")) out.push(openAiCompatible("openai", "https://api.openai.com/v1", oai, m, null));
  const gem = env("GEMINI_API_KEY");
  if (gem) for (const m of list("GEMINI_MODELS")) out.push(openAiCompatible("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/", gem, m, null));
  const ant = env("ANTHROPIC_API_KEY");
  if (ant) {
    const client = new Anthropic({ apiKey: ant, timeout: 600_000, maxRetries: 1 });
    for (const model of list("ANTHROPIC_MODELS", ["claude-opus-5-5"])) {
      const p = CLAUDE_PRICES[model];
      out.push({
        provider: "anthropic",
        model,
        price: p ? { ...p, source: "Anthropic list price (claude-api skill, 2026-11-03)" } : null,
        async complete(system, user) {
          const r = await client.messages.create({ model, max_tokens: 16000, system, messages: [{ role: "user", content: user }] });
          if (r.stop_reason === "refusal") throw new Error("refusal");
          const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
          return { text, inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens };
        },
      });
    }
  }
  return out;
}
