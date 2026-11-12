# ADR 0002 — Default TTS provider: FPT AI Marketplace (`FPT.AI-VITs`)

- **Status**: Accepted (product-owner decision, 2026-11-12)
- **Context**: M0 T007–T008 planned a ≥4-provider blind MOS benchmark. The product owner chose FPT.AI as the
  default and provided one FPT AI Marketplace key; no keys for other providers.

## Decision

- Default `TtsProvider` = FPT AI Marketplace, OpenAI-compatible endpoint
  `POST https://mkp-api.fptcloud.com/v1/audio/speech` (`Authorization: Bearer sk-…`), model `FPT.AI-VITs`.
  Verified by real calls on 2026-11-12: `/v1/models` lists `FPT.AI-VITs`, `FPT.TTS-pro`, `FPT.TTS-ultra`;
  the current key is allowed only `FPT.AI-VITs` (403 for pro/ultra).
- Voices accepted by the API: banmai, giahuy, hatieumai, huyphong, kimngan, leminh, minhquan, ngoclam,
  thuminh (+ `std_` variants). Benchmark samples (9 voices, ~618 chars, 1.3–2.5 s latency) are in
  `bench/tts/out/`.
- The provider stays behind `TtsProvider` (constitution VIII); it is called with the `openai` SDK shape
  (`audio.speech.create`) so another OpenAI-compatible TTS can be swapped by config.
- **No native word timestamps** → narration is synthesized **per caption chunk** and concatenated; chunk
  onsets are exact, words inside a chunk are interpolated (see `spikes/align/REPORT.md`).

## Consequences / open items

- No blind MOS done (only one provider). Product owner should listen to the 9 samples and pick the default
  voice(s); later providers can be added and compared without code changes.
- Price: FPT catalog (docs/fpt.ai/fpt-ai-list-model.json, provided 2026-11-12) lists `FPT.AI-VITs` and
  `FPT.TTS-pro` at $16.5 per 1M characters (≈ $0.0165 per 1,000 chars) and `FPT.TTS-ultra` at $99 per 1M.
  Marketplace terms on commercial use / resale of generated audio are still **not verified** — read FPT's
  official terms and record them here before M5 (paid plans).
- Per-chunk synthesis means more API calls (≈1 per 3–5 s of speech); acceptable at FPT latency, but rate limits
  must be checked in M2.
- 2026-11-12: the new key also allows `FPT.TTS-pro` (voices fci_vietkhoa, fci_xuantoan, fci_phuongan, std_banmai,
  std_quanganh) and `FPT.TTS-ultra` (fci_phuongan, fci_xuantoan, std_banmai, std_kimngan, std_minhquang,
  std_quanganh, std_vietkhoa). Samples in `docs/reports/assets/M0/tts/{vits,pro,ultra}/`. The default model
  (VITs vs pro vs ultra) and voice are a product-owner listening decision; the provider stays FPT.
