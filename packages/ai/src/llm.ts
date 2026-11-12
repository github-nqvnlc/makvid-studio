// LlmProvider: per-step model routing, JSON extraction, zod validation with one repair round-trip,
// one fallback model, usage + cost for every call (constitution VIII).
import { normalizeDeep } from "@makvid/spec";
import { anthropicAdapter, openAiCompatibleAdapter } from "./adapters";
import { costUsd } from "./pricing";
import {
  LlmOutputError,
  type ChatAdapter,
  type ChatMessage,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type LlmStep,
  type TokenUsage,
} from "./types";

export interface ModelRef {
  provider: string;
  model: string;
}

export interface LlmConfig {
  adapters: Record<string, ChatAdapter>;
  steps: Record<LlmStep, ModelRef>;
  /** Used once when the step's model fails validation after repair, or errors. */
  fallback?: ModelRef;
  onUsage?: (step: LlmStep, usage: TokenUsage) => void | Promise<void>;
  maxTokens?: number;
}

/** Defaults from ADR 0005. */
export const DEFAULT_STEPS: Record<LlmStep, ModelRef> = {
  script: { provider: "fpt", model: "gemma-4-31B-it" },
  storyboard: { provider: "fpt", model: "gemma-4-31B-it" },
  style_suggest: { provider: "fpt", model: "gemma-4-26B-A4B-it" },
  qa_fix: { provider: "fpt", model: "gemma-4-26B-A4B-it" },
  chat_edit: { provider: "fpt", model: "gemma-4-26B-A4B-it" },
};
export const DEFAULT_FALLBACK: ModelRef = { provider: "fpt", model: "DeepSeek-V4.1-Flash" };

/** Build adapters + step routing from env (LLM_<STEP>_PROVIDER / LLM_<STEP>_MODEL override defaults). */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Omit<LlmConfig, "onUsage"> {
  const adapters: Record<string, ChatAdapter> = {};
  if (env.FPT_AI_API_KEY)
    adapters.fpt = openAiCompatibleAdapter(
      "fpt",
      env.FPT_LLM_BASE_URL ?? "https://mkp-api.fptcloud.com/v1",
      env.FPT_AI_API_KEY,
    );
  if (env.OPENAI_API_KEY)
    adapters.openai = openAiCompatibleAdapter("openai", "https://api.openai.com/v1", env.OPENAI_API_KEY);
  if (env.GEMINI_API_KEY)
    adapters.gemini = openAiCompatibleAdapter(
      "gemini",
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      env.GEMINI_API_KEY,
    );
  if (env.ANTHROPIC_API_KEY) adapters.anthropic = anthropicAdapter(env.ANTHROPIC_API_KEY);
  const steps = { ...DEFAULT_STEPS };
  for (const s of Object.keys(steps) as LlmStep[]) {
    const key = s.toUpperCase();
    const provider = env[`LLM_${key}_PROVIDER`];
    const model = env[`LLM_${key}_MODEL`];
    if (provider || model)
      steps[s] = { provider: provider ?? steps[s].provider, model: model ?? steps[s].model };
  }
  const fallback =
    env.LLM_FALLBACK_MODEL === "none"
      ? undefined
      : {
          provider: env.LLM_FALLBACK_PROVIDER ?? DEFAULT_FALLBACK.provider,
          model: env.LLM_FALLBACK_MODEL ?? DEFAULT_FALLBACK.model,
        };
  return { adapters, steps, ...(fallback ? { fallback } : {}) };
}

/** Extract the first JSON value from a reply (tolerates ```json fences and prose around it). */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("reply contains no JSON");
  }
}

export function createLlm(cfg: LlmConfig): LlmProvider {
  const maxTokens = cfg.maxTokens ?? 8000;

  async function call(
    step: LlmStep,
    ref: ModelRef,
    messages: ChatMessage[],
    attempt: number,
  ): Promise<{ text: string; usage: TokenUsage }> {
    const adapter = cfg.adapters[ref.provider];
    if (!adapter) throw new Error(`no adapter configured for provider "${ref.provider}"`);
    const t0 = performance.now();
    const r = await adapter.chat(ref.model, messages, maxTokens);
    const usage: TokenUsage = {
      provider: ref.provider,
      model: ref.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      ...(r.reasoningTokens ? { reasoningTokens: r.reasoningTokens } : {}),
      costUsd: costUsd(ref.provider, ref.model, r.inputTokens, r.outputTokens),
      latencyMs: Math.round(performance.now() - t0),
      attempts: attempt,
    };
    await cfg.onUsage?.(step, usage);
    return { text: r.text.normalize("NFC"), usage };
  }

  function check<T>(
    req: LlmRequest<T>,
    text: string,
  ): { ok: true; value: T } | { ok: false; problems: string[] } {
    if (!req.schema) return { ok: true, value: text as T };
    let raw: unknown;
    try {
      raw = normalizeDeep(extractJson(text));
    } catch (e) {
      return { ok: false, problems: [(e as Error).message] };
    }
    const parsed = req.schema.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        problems: parsed.error.issues
          .slice(0, 20)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      };
    const extra = req.validate?.(parsed.data) ?? [];
    return extra.length ? { ok: false, problems: extra } : { ok: true, value: parsed.data };
  }

  return {
    async complete<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
      const usage: TokenUsage[] = [];
      const repairs: string[][] = [];
      const refs = [cfg.steps[req.step], ...(cfg.fallback ? [cfg.fallback] : [])];
      let lastProblems: string[] = [];
      let lastText = "";
      let attempt = 0;
      for (const ref of refs) {
        let messages = req.messages;
        // Each model gets the original try + one repair round-trip with the validation problems.
        for (let round = 0; round < 2; round++) {
          attempt++;
          let res: { text: string; usage: TokenUsage };
          try {
            res = await call(req.step, ref, messages, attempt);
          } catch (e) {
            lastProblems = [`${ref.provider} error: ${(e as Error).message.slice(0, 200)}`];
            break; // provider error -> go to fallback model
          }
          usage.push(res.usage);
          lastText = res.text;
          const c = check(req, res.text);
          if (c.ok) return { output: c.value, text: res.text, usage, repairs };
          lastProblems = c.problems;
          repairs.push(c.problems);
          messages = [
            ...req.messages,
            { role: "assistant", content: res.text },
            {
              role: "user",
              content: `Kết quả chưa hợp lệ. Hãy sửa đúng các lỗi sau và trả lại TOÀN BỘ JSON (chỉ JSON):\n- ${c.problems.join("\n- ")}`,
            },
          ];
        }
      }
      throw new LlmOutputError(`step "${req.step}" produced no valid output`, lastProblems, lastText);
    },
  };
}
