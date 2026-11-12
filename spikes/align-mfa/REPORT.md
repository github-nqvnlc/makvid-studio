# Spike M2 — Forced alignment with Montreal Forced Aligner (MFA) — PASS

**Date**: 2026-11-12 · **MFA** 3.4.3 (MIT, conda-forge) · **Models** `vietnamese_mfa` acoustic + dictionary
v3.0.0 and `vietnamese_hanoi_mfa` g2p (all **CC BY 4.0** — attribution required) · CPU only, `--network none`
**Files**: [Dockerfile](Dockerfile), [eval.mjs](eval.mjs), corpus builder `packages/tts/scratch/make-corpus.ts`

## Why

FPT TTS returns no word timestamps (ADR 0002). whisper.cpp DTW missed the ±150 ms target (p90 300–500 ms,
`spikes/align/REPORT.md`). Captions must highlight each word within 100 ms (T065).

## Method

Real FPT voices (`vits:banmai`, `pro:std_quanganh`), 6 Vietnamese sentences, 62 words each:

- **Ground truth corpus**: every word synthesized alone, silence-trimmed, concatenated with 60 ms gaps, so
  each word onset is known exactly. Measures MFA on the real voice timbre.
- **Natural corpus**: each sentence synthesized normally (what production uses). Compares the cheap
  energy-dip method (`packages/tts/src/timing.ts`) with MFA.

## Results

| Voice | MFA vs exact onsets | ≤ 100 ms | Energy method vs MFA (natural speech) |
| --- | --- | --- | --- |
| VITs banmai | median 26 · p90 80 · max 96 ms | **62/62** | median 96 · p90 294 ms (28/56 ≤ 100) |
| TTS-pro std_quanganh | median 6 · p90 38 · max 46 ms | **62/62** | median 120 · p90 204 ms (22/56 ≤ 100) |

One `mfa align` run over a 6-utterance corpus takes ~31 s on CPU (mostly start-up), so a whole video is
aligned in one call.

## Decision

Use MFA as the word-timing source (ADR 0006). The energy method is not accurate enough and is kept only as an
offline fallback. Numbers, abbreviations and foreign names must be written out in words in the narration
(LLM prompt + text normalizer) so the dictionary / g2p covers them.
