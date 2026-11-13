# ADR 0010 — Speech-to-text for uploaded audio/video: whisper.cpp for words, MFA for timing

- **Status**: Accepted (2026-11-13)
- **Context**: US4 turns an uploaded recording into a captioned video, optionally keeping the original voice.
  The FPT AI Marketplace catalogue for our key has no speech-to-text model (checked `/v1/models` on
  2026-11-13: 19 models, none STT). The M2 spike measured whisper.cpp v1.9.5 on Vietnamese TTS audio: word
  recognition 90–96 % with no hallucination, but word timings p90 300–500 ms off; MFA timings are within
  100 ms when the text is known (ADR 0006).

## Decision

- Recognition with **whisper.cpp v1.9.5** (MIT; OpenAI Whisper weights, MIT), model `small` by default
  (`WHISPER_MODEL` build arg; `medium` is more accurate and ~3× slower on CPU), inside the existing
  `worker-align` image: `POST /transcribe` returns segments with coarse times.
- Timing with **MFA per whisper segment** (short utterances align reliably), mapped back onto the displayed
  words (case, diacritics and punctuation kept for captions).
- Self-hosted: no per-call cost, audio never leaves our infrastructure. Limit 5 minutes per upload.
- "Keep the original voice": the transcript is narrated verbatim and the voice track is cut sentence by
  sentence from the source audio, so dropping a scene also drops its audio.

## Consequences

- `worker-align` image grows by the whisper binary + model (~470 MB for `small`).
- A cloud STT provider (OpenAI / Gemini, paid) can be added behind the same `transcribe()` call later if
  recognition quality on real-world recordings is not enough.
