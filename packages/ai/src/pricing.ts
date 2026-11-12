// USD per 1M tokens. Sources: FPT catalog docs/fpt.ai/fpt-ai-list-model.json (provided 2026-11-12);
// Anthropic list prices (claude-api reference, 2026-11-03). Unknown models return null (cost not invented).
const PRICES: Record<string, { input: number; output: number }> = {
  "fpt:gemma-4-31B-it": { input: 0.15, output: 0.45 },
  "fpt:gemma-4-26B-A4B-it": { input: 0.14, output: 0.4 },
  "fpt:gemma-3-27b-it": { input: 0.11, output: 0.165 },
  "fpt:gpt-oss-120b": { input: 0.143, output: 0.605 },
  "fpt:Qwen3.6-27B": { input: 0.3, output: 3.25 },
  "fpt:Qwen3.8-27B": { input: 0.45, output: 3.2 },
  "fpt:DeepSeek-V4-Flash": { input: 0.14, output: 0.28 },
  "fpt:DeepSeek-V4.1-Flash": { input: 0.28, output: 1.2 },
  "fpt:GLM-5.2": { input: 1.4, output: 4.4 },
  "fpt:Saola-Small-32B": { input: 0.132, output: 0.154 },
  "anthropic:claude-opus-5-5": { input: 4, output: 20 },
  "anthropic:claude-sonnet-5-5": { input: 2, output: 10 },
  "anthropic:claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const p = PRICES[`${provider}:${model}`];
  if (!p) return null;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1e6) * 1e6) / 1e6;
}
