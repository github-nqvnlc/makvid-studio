# Architecture Decision Records

One file per decision: `NNNN-short-title.md`, numbered sequentially, never renumbered.

| ADR                                    | Title                                                            | Status                      |
| -------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| [0001](0001-gsap-license.md)           | GSAP behind AnimationRuntime; ask Webflow                        | Accepted                    |
| [0002](0002-default-tts.md)            | Default TTS: FPT AI Marketplace `FPT.AI-VITs`                    | Accepted                    |
| [0003](0003-render-worker-baseline.md) | Render worker 8 vCPU / 16 GB / no GPU                            | Accepted                    |
| 0004                                   | Payment gateway (before M5)                                      | Pending                     |
| [0005](0005-default-llm.md)            | Default LLMs: FPT, per-step models                               | Accepted                    |
| [0006](0006-word-alignment-mfa.md)     | Word timing: Montreal Forced Aligner                             | Accepted                    |
| [0007](0007-licensed-music.md)         | Music: Soundstripe API, procedural fallback                      | Accepted (contract pending) |
| [0008](0008-web-app-m3.md)             | Web app: Next.js 16, Better Auth, chat edits in web, MP4 preview | Accepted                    |
| [0009](0009-style-packs-4-8.md) | Style packs 4–8, narration cues, bitmap glass background, perf budget | Accepted |

## Template

```markdown
# ADR NNNN — Title

- **Status**: Proposed | Accepted | Superseded by NNNN
- **Date**: YYYY-MM-DD
- **Context**: why a decision is needed; constraints; evidence (links, measurements).

## Decision

What we do.

## Consequences

Trade-offs, follow-ups, what would make us revisit.
```
