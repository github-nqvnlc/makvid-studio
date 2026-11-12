// LlmProvider contract (contracts/provider-interfaces.md) + shared types.
import type { ZodType } from "zod";

export const PIPELINE_LLM_STEPS = ["script", "style_suggest", "storyboard", "qa_fix", "chat_edit"] as const;
export type LlmStep = (typeof PIPELINE_LLM_STEPS)[number];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  /** null when no verified price is known for the model. */
  costUsd: number | null;
  latencyMs: number;
  /** 1 = first try; >1 when a repair or fallback call was needed. */
  attempts: number;
}

export interface LlmRequest<T> {
  step: LlmStep;
  messages: ChatMessage[];
  /** When set, the reply must be JSON that parses with this schema (validated + one repair round-trip). */
  schema?: ZodType<T>;
  /** Extra semantic checks after schema parse; return human-readable problems (sent back for repair). */
  validate?: (value: T) => string[];
  maxTokens?: number;
}

export interface LlmResult<T> {
  output: T;
  text: string;
  usage: TokenUsage[];
  /** Validation problems of each rejected attempt (empty when the first answer was valid). */
  repairs: string[][];
}

export interface LlmProvider {
  complete<T = string>(req: LlmRequest<T>): Promise<LlmResult<T>>;
}

/** Low-level chat call shared by adapters. */
export interface ChatAdapter {
  readonly provider: string;
  chat(
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  }>;
}

export class LlmOutputError extends Error {
  override name = "LlmOutputError";
  constructor(
    message: string,
    readonly problems: string[],
    readonly lastText: string,
  ) {
    super(message);
  }
}
