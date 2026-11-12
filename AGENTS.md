# AGENTS.md — MakVid Studio

Shared instructions for every coding agent (Claude Code, Antigravity, others). Read this first.

## Source of truth

- Spec / plan / tasks: `specs/001-ai-video-saas/` (`spec.md`, `plan.md`, `tasks.md`, `contracts/`).
- Constitution (non-negotiable rules): `.specify/memory/constitution.md`.
- Decisions: `docs/decisions/NNNN-*.md` (ADR). Progress log: `docs/PROGRESS.md`. Milestone reports: `docs/reports/`.

## Working rules

1. Work milestone by milestone (M0–M6). At each 🛑 GATE in `tasks.md`: write the report, stop, wait for approval.
2. "Done" = it really ran: tests pass, MP4 rendered. Never claim untested work is done.
3. Verify every external library/API against current docs or real calls; never invent APIs.
4. Record non-trivial decisions as ADRs. Ask the product owner only about cost, legal/license or UX.
5. Code, comments, commits: **English**. Talk to the product owner: **Vietnamese**.
6. Secrets live only in a local `.env` (git-ignored). Never print, log or commit keys. Document vars in `.env.example`.
7. No AGPL/SSPL/BUSL/CC-BY-NC dependencies; no Remotion (`pnpm license:check`).
8. Mark finished tasks `[X]` in `tasks.md` and append a dated entry to `docs/PROGRESS.md` (who, what, next).
9. Before editing files another agent may be touching, check `docs/PROGRESS.md` for in-flight work.

## Commands

```bash
pnpm install          # Node >= 22.12, pnpm 12 (packageManager pinned)
pnpm typecheck        # tsc per package (turbo)
pnpm lint             # eslint flat config from @makvid/config
pnpm test             # vitest per package
pnpm license:check    # dependency license gate
pnpm makvid <cmd>     # CLI: render | qa | golden | lint-style | validate | produce
docker compose -f docker/compose.dev.yml up -d worker-align   # MFA word alignment (needed by produce)
docker compose -f docker/compose.dev.yml up -d   # postgres, valkey, seaweedfs
pnpm db:migrate        # apply SQL migrations to DATABASE_URL
pnpm dev:mock          # web (http://localhost:3000) + 3 workers with mock providers (no paid calls)
pnpm dev:stack         # same with real providers (FPT key in .env)
pnpm --filter @makvid/web test:e2e   # Playwright E2E against a running dev:mock stack
docker compose -f docker/compose.yml up -d --build   # full stack in containers (web + workers + infra)
```

Reference renders and golden frames run **only** in the Linux render container (`docker/worker-render.Dockerfile`):

```bash
scripts/verify-render.sh            # goldens compare, mkv fallback, contract + overflow tests, 2x render, demos
```

Opt-in test suites: `MAKVID_INFRA_TESTS=1` (needs compose stack), `MAKVID_PIPELINE_TESTS=1` (mock pipeline),
`MAKVID_AUDIO_TESTS=1`, `MAKVID_LIVE_LLM=1` / `MAKVID_LIVE_TTS=1` (real FPT calls), `MAKVID_PRODUCED_DIR=<dir>`
(caption sync), `MAKVID_RENDER_TESTS=1` and
`MAKVID_VISUAL_TESTS=1` (need Chrome + FFmpeg; run in the container).

## Style packs

- Slot schemas: `scripts/scaffold-schemas.mjs` (same slot names in every pack). Layout scaffolds:
  `scripts/scaffold-layouts.mjs <packDir> <variant>`; generated `layout.*.html` are then the source of truth.
- Text is fitted at compile time with the pack fonts (`{{fit ...}}`). If pack CSS changes font family,
  weight or OpenType features of fitted text, the `{{fit}}` must say so (`font=`, `features=`), or QA fails.
- Fonts: `scripts/vendor-fonts.mjs` (self-hosted woff2 + LICENSE + unicode-range).

## Layout

| Path                                                         | What                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `apps/web`                                                   | Next.js 16 app: next-intl (vi/en), Better Auth, API routes, SSE, editor + review UI (ADR 0008)   |
| `apps/cli`                                                   | `makvid` CLI                                                                                     |
| `apps/worker-*`                                              | BullMQ workers: ai, audio, render, align                                                         |
| `packages/spec`                                              | VideoSpec (zod), NFC, patches, migrations                                                        |
| `packages/compiler`                                          | VideoSpec + style pack → per-scene HTML, captions, SRT                                           |
| `packages/style-kit`                                         | Style-pack SDK: AnimationRuntime, fitText, safe areas, rng, loader, lint                         |
| `packages/styles/<id>`                                       | Style packs (templates, tokens, golden frames)                                                   |
| `packages/renderer`                                          | `Renderer` interface, HyperFrames + fallback, capture, mux                                       |
| `packages/pipeline`                                          | Production stages (script → style → storyboard → audio → QA → render), shared by CLI and workers |
| `packages/{ai,tts,media,queue,db,billing,storage,ui,config}` | Providers and shared infra                                                                       |
| `spikes/`, `bench/`                                          | M0 experiments (own npm lockfiles, not in the workspace)                                         |

## Conventions

- TypeScript strict, ESM, no `any`. Internal packages export TS source (`exports: ./src/index.ts`).
- Deterministic scenes: no `Math.random`/`Date.now`/timers in compositions; use `rng(seed)` from style-kit.
- All Vietnamese text is NFC-normalized at the boundary (`packages/spec`).
- User-facing errors never expose tech names (HyperFrames, GSAP, FFmpeg, provider names) — use `UserFacingError`.
- Bump `PROMPT_VERSION` (`packages/ai`) whenever a pipeline prompt or validator changes (it keys the step cache).
