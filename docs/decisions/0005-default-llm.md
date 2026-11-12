# ADR 0005 — Default LLMs: FPT AI Marketplace, per-step models

- **Status**: Accepted (product-owner criteria, 2026-11-12). Revisit when Claude / OpenAI / Gemini keys are
  benchmarked with the same harness.
- **Context**: `bench/llm` ran 12 FPT chat models × 10 Vietnamese topics on the real storyboard task
  ([report](../../bench/llm/report.md)). Product-owner criteria: drop models passing < 8/10 rule checks,
  rank by latency, cost is not a concern. Llama-3.3-70B was dropped (no real narration, invented numbers).
  Claude Code / Antigravity subscriptions cannot power the SaaS (terms); Claude and Gemini are usable only via
  their commercial API keys.

## Decision

- `LlmProvider` has two adapters: an OpenAI-compatible one (FPT, OpenAI, Gemini — `baseURL + apiKey + model`)
  and an Anthropic one (official `@anthropic-ai/sdk`). Every pipeline step reads its own model config
  (`LLM_<STEP>_PROVIDER` / `LLM_<STEP>_MODEL`), so switching is config only.
- Defaults (FPT, `https://mkp-api.fptcloud.com/v1`, model names exactly as `GET /v1/models` lists them):

| Step                                                 | Default model         | Why                                   |
| ---------------------------------------------------- | --------------------- | ------------------------------------- |
| `script`, `storyboard`                               | `gemma-4-31B-it`      | 10/10 valid, 14 s, natural Vietnamese |
| `style_suggest`, `qa` fix patches, chat edits        | `gemma-4-26B-A4B-it`  | fastest (2.8 s), 8/10 valid           |
| fallback when a step's output fails validation twice | `DeepSeek-V4.1-Flash` | best prose, slow (79 s)               |

- Shortlist kept for later comparison: `gpt-oss-120b`, `Qwen3.6-27B`, `DeepSeek-V4-Flash`.
- Structured output is enforced by zod validation + one automatic repair round-trip (send the validation
  errors back), not by provider-specific JSON modes, so every adapter behaves the same.

## Consequences

- Prompt v1 issues found in the benchmark (highlight phrase not inside the text, videos running ~50 s) are
  fixed in the M2 prompts and validators, not by changing models.
- FPT is a single vendor for LLM + TTS; outages affect both. Mitigation: provider is configuration, and the
  Anthropic/Gemini adapters exist.
- Cost per storyboard on the defaults is ≈ $0.0005 (catalog prices); logged per call in `usage_records`.
