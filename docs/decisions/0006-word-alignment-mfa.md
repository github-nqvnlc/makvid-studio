# ADR 0006 — Word timing: Montreal Forced Aligner in `worker-align`

- **Status**: Accepted (2026-11-12)
- **Context**: Captions need word onsets within 100 ms (T065, SC-013). The default TTS (FPT, ADR 0002) returns no
  timestamps. whisper.cpp (spikes/align) and an energy-dip heuristic (packages/tts/src/timing.ts) both miss the
  target. The MFA spike ([REPORT](../../spikes/align-mfa/REPORT.md)) measured 62/62 words within 100 ms
  (median 6–26 ms) on two real FPT voices.

## Decision

- `apps/worker-align` runs **Montreal Forced Aligner 3.4.3** (MIT) with the **`vietnamese_mfa` v3.0.0** acoustic
  model + dictionary and **`vietnamese_hanoi_mfa`** g2p for out-of-vocabulary words, in its own container
  (micromamba/conda-forge). It exposes an internal HTTP endpoint used by the TS `Aligner` client.
- Narration is synthesized **per script sentence** (natural prosody; ADR 0002's per-chunk idea is no longer
  needed), concatenated with fixed pauses, and aligned in one MFA run per video.
- Narration text is normalized before TTS and alignment: numbers, units, abbreviations and symbols written out
  in Vietnamese words.

## Consequences

- **Attribution required** (CC BY 4.0) for the MFA Vietnamese models: listed in `THIRD_PARTY_LICENSES.md` and
  the product's credits page (M3).
- Extra container (~1.5 GB image) and ~30 s per video of CPU alignment time; acceptable inside the audio step.
- Foreign words rely on g2p and can be less accurate; the QA caption-sync check flags outliers.
