# Spike T009 — Forced alignment (whisper.cpp) — INCONCLUSIVE

**Date**: 2026-11-12 · **whisper.cpp** v1.9.5 (MIT), models `ggml-small`, `ggml-medium`, CPU, `-l vi --dtw <model> -ojf`
**Files**: [Dockerfile](Dockerfile), [align.mjs](align.mjs), outputs in `output/`

## Method

Ground-truth audio was built by synthesizing each word separately with `espeak-ng -v vi`, trimming
silence, and concatenating with 70 ms gaps, so each word's true onset is known exactly (57 words,
17.8 s). whisper.cpp transcribes with DTW token timestamps; recognized words are matched to reference
words (Needleman–Wunsch on normalized text) and onset errors measured.

## Result

| Model | whisper time | Words matched | Onset error (matched) | Transcript quality |
| --- | --- | --- | --- | --- |
| small | 20 s | 5 / 57 (9%) | median 120 ms, p90 282 ms | mostly wrong words |
| medium | 64 s | 0 / 57 | — | hallucinated a YouTube outro ("Hãy đăng ký kênh…") |

## Interpretation

- The test audio (espeak-ng Vietnamese, isolated words) is far less intelligible than production TTS,
  so this measures **recognition failure on robotic audio**, not alignment accuracy. The result does
  not tell us whether whisper.cpp can reach < 100 ms on real TTS voices.
- It does show a real design risk: **transcribe-then-match** depends on recognition quality and can
  hallucinate. For our case the transcript is already known (we generated it), so a true **forced
  aligner** (text given, only timing estimated) is the better design.

## Next steps (blocked on TTS API keys)

1. Re-run with natural audio: ElevenLabs `/with-timestamps` output gives native ground truth, so both
   whisper.cpp and a forced aligner can be scored against it.
2. Evaluate forced-alignment options and their **model licenses** before choosing (several popular
   Vietnamese wav2vec2/MMS alignment weights are non-commercial, e.g. CC-BY-NC — must be excluded).
3. Prefer a default TTS provider that returns word timestamps natively, which makes alignment only a
   fallback (for user-uploaded voice recordings).

---

# Re-run with real TTS (FPT AI Marketplace `FPT.AI-VITs`) — 2026-11-12 — CONCLUDED

**Files**: [gen-fpt.mjs](gen-fpt.mjs) (host, synthesizes 12 phrases), [align-real.mjs](align-real.mjs) (container,
`--network none`). Ground truth: each phrase synthesized separately, silence-trimmed, concatenated with 250 ms
gaps, so every **phrase onset** is known exactly (12 per voice, 79 words, ~21 s). whisper.cpp is prompted with
the known script; words matched by Needleman–Wunsch, unmatched words interpolated.

| Voice | Model | whisper time | Word recognition | Phrase-onset error median / p90 / max | ≤150 ms |
| --- | --- | --- | --- | --- | --- |
| banmai | small | 24 s | 71/79 (90%) | 250 / 364 / 395 ms | 6/12 |
| banmai | medium | 83 s | 75/79 (95%) | 225 / 390 / 435 ms | 3/12 |
| leminh | small | 26 s | 72/79 (91%) | 219 / 468 / 516 ms | 6/12 |
| leminh | medium | 73 s | 76/79 (96%) | 106 / 306 / 428 ms | 9/12 |

Signed errors are not a constant bias (sd 156–242 ms), so they cannot be calibrated away.

## Conclusion

- With the script as prompt, recognition is good (90–96%) and **no hallucination**.
- **Timing is not good enough**: whisper.cpp DTW word times miss the SC-013 ±150 ms target (p90 300–500 ms).
- **Decision for M2** (recorded in ADR 0002): since FPT returns no word timestamps, synthesize narration
  **per caption chunk** (≤12 words, one TTS call each) and concatenate. Chunk onsets are then exact by
  construction; words inside a chunk get times by syllable-weighted interpolation. whisper.cpp stays only as an
  optional refinement and for user-uploaded voice.
- Follow-up in M2 (T071): measure within-chunk word accuracy against hand-labelled onsets (≥50 words), and
  evaluate a true forced aligner with a commercial-OK license (e.g. Montreal Forced Aligner, MIT; check the
  Vietnamese acoustic model's license). Exclude CC-BY-NC weights (e.g. MMS).
