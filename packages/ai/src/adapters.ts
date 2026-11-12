// Two adapters (ADR 0005): OpenAI-compatible (FPT, OpenAI, Gemini) and Anthropic (official SDK).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ChatAdapter, ChatMessage } from "./types";

export function openAiCompatibleAdapter(
  provider: string,
  baseURL: string,
  apiKey: string,
  timeoutMs = 240_000,
): ChatAdapter {
  const client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 2 });
  return {
    provider,
    async chat(model, messages, maxTokens) {
      const r = await client.chat.completions.create({ model, max_tokens: maxTokens, messages });
      const u = r.usage as
        (OpenAI.CompletionUsage & { completion_tokens_details?: { reasoning_tokens?: number } }) | undefined;
      const reasoning = u?.completion_tokens_details?.reasoning_tokens;
      return {
        text: r.choices[0]?.message?.content ?? "",
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
        ...(reasoning ? { reasoningTokens: reasoning } : {}),
      };
    },
  };
}

export function anthropicAdapter(apiKey: string, timeoutMs = 600_000): ChatAdapter {
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  return {
    provider: "anthropic",
    async chat(model, messages, maxTokens) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const turns = messages.filter(
        (m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system",
      );
      const r = await client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: turns.map((m) => ({ role: m.role, content: m.content })),
      });
      if (r.stop_reason === "refusal") throw new Error("model declined the request");
      return {
        text: r.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
        inputTokens: r.usage.input_tokens,
        outputTokens: r.usage.output_tokens,
      };
    },
  };
}
