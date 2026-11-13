# Progress

## 2026-11-12 — M0 (Claude Code)

- Spec, constitution v1.0.0, plan, research, data model, contracts, tasks: `specs/001-ai-video-saas/`.
- ADR 0001 (GSAP behind AnimationRuntime, ask Webflow): `docs/decisions/0001-gsap-license.md`.
- M0 done: T001–T006 (HyperFrames spike, `spikes/hyperframes/`), T005 (`spikes/player-next/`),
  T010 (`spikes/queue/`), T011 (`spikes/license-scan/`), T012 (`docs/reports/M0.md`).
- GATE M0 approved 2026-11-12. TTS default = FPT AI Marketplace `FPT.AI-VITs` (ADR 0002, no word
  timestamps → per-chunk synthesis); worker baseline 8 vCPU/16 GB/no GPU (ADR 0003). T009 re-run on FPT audio:
  whisper.cpp p90 300–500 ms, not used as primary timing source.
- Key learnings: reference renders only in the Linux container; compositions must ship local GSAP,
  local @font-face fonts and the local HyperFrames runtime (`hyperframe.runtime.iife.js`).
- Next: M1 (T013–T061).

## 2026-11-12 — M1 core render (Claude Code)

- Monorepo (T013–T019): pnpm 12 + Turborepo, TS 6.0 strict, ESLint 10, Prettier, Vitest 5; CI `ci.yml`
  (check + render-smoke); `docker/compose.dev.yml` (Postgres 17.11, Valkey 8.1.11, SeaweedFS 4.48).
- Core: `packages/spec` (zod VideoSpec 0.1.0, NFC, RFC 6902 patches, migrations), `packages/style-kit`
  (rng, AnimationRuntime: GSAP adapter + MIT "mkv" runtime, fitText with real font metrics, safe areas,
  loader, AST lint), `packages/compiler` (layout language with `{{fit}}`, captions, SRT, cache keys),
  `packages/renderer` (HyperFrames + Puppeteer fallback, captureFrames + DOM metrics, QA rules, mux),
  style packs `minimal`, `kinetic`, `infographic`, CLI `makvid`.
- Infra packages: storage (S3/SeaweedFS), db (Drizzle + SQL migrations + RLS `withWorkspace`), queue
  (BullMQ idempotent jobs, priorities, cost hook, pino with redaction), ui (`UserFacingError` vi/en).
- Key learnings: text is fitted at compile time with fontkit (no font-load race); every CSS font/feature
  change must be mirrored in the measure (QA now checks rendered line width vs compiled `data-w`);
  slot limits come from the worst-case harness (`tests/visual/overflow.test.ts`), not guesses.
- Verify everything in the render container: `scripts/verify-render.sh`.

## 2026-11-12 — GATE M1 approved; M2 started (Claude Code)

- M1 approved by product owner. LLM benchmark (`bench/llm`) on 12 FPT models → ADR 0005 (gemma-4-31B-it for
  script/storyboard, gemma-4-26B-A4B-it for fast steps, DeepSeek-V4.1-Flash as repair fallback).
- New FPT key (all models incl. TTS-pro/ultra); samples in `docs/reports/assets/M0/tts/{vits,pro,ultra}`.
- M2 in progress: T062–T087.

## 2026-11-12 — M2 done, awaiting GATE M2 (Claude Code)

- US1 automatic pipeline: `packages/pipeline` (6 stages, cached), `packages/ai` (LlmProvider + prompts),
  `packages/tts` (FPT + narration + MFA client), `apps/worker-align` (MFA, ADR 0006), `packages/media`
  (procedural music/SFX, mix + loudnorm), BullMQ flow + `apps/worker-{ai,audio,render}`, DB tables (0002).
- Acceptance (`apps/cli/scripts/m2-acceptance.ts`): 10/10 clean, caption p95 ≤ 24 ms, −14 LUFS, 42.5–49.4 s,
  avg $0.0164/video. Report `docs/reports/M2.md`.
- Next: GATE M2 approval, then M3.

## 2026-11-12 — GATE M2 approved; M3 started (Claude Code)

- Product-owner decisions: music must come from a commercially licensed library (ADR 0007 pending provider
  choice); users pick the voice from a list with preview clips (default `vits:banmai`). Tasks T108a/T108b added.

## 2026-11-12 — M3 in progress: music, voices, review mode (Claude Code)

- T108b: `MusicProvider` (`packages/media/src/providers.ts`): Soundstripe API + procedural fallback; ADR 0007
  (product owner must open a Soundstripe account / trial key `SOUNDSTRIPE_API_KEY`, contract before M5).
- T108a (library part): 21 FPT voice preview clips + `manifest.json` in `packages/tts/library/voices`
  (`gen-voice-previews.ts`, $0.077), `voiceCatalog()` / `voicePreviewPath()`; picker UI pending (web app).
- US3 review mode (T088–T091): `mode: "review"` splits the stages into 3 segments with pauses
  `script_review` and `storyboard_review`; `startProduction` / `resumeProduction` (queue), `Reviewer`
  (in-process); `preview` stage renders the storyboard thumbnail grid; `makvid golden <id|all> --thumbnails`.
  Style suggestions now require ≥ 2 distinct styles (`PROMPT_VERSION` m3.1). Integration files run serially.
- Next: web app (T092–T107), styles 4–8 (T150–T154), M3 report.

## 2026-11-12 — M3 web app back end in progress, STOPPED mid-way (Claude Code)

- Done + tested: migration 0003 (Better Auth tables on `users`, `chat_messages`, `withUser` RLS, project
  settings/run_id; db RLS 8/8), chat→patch (`packages/ai/src/prompts/chat.ts`, `packages/pipeline/src/steps/chat.ts`,
  6/6), worker `StageHooks` + `dbSink` (status, jobs progress, usage, versions, outputs to S3), project service
  (`packages/pipeline/src/service.ts`: create, resume, chat, undo/redo, restore, duplicate; integration 6/6 on the
  compose stack), mocks moved to `@makvid/pipeline/testing` (`MAKVID_MOCK_PROVIDERS=1`). PROMPT_VERSION m3.2.
- apps/web: deps installed only (next 16.4.3, next-intl 4.14.9, better-auth 1.7.14, react 19.2.9, playwright
  1.64.1); no pages yet. Next 16 uses `proxy.ts` (middleware renamed).
- Next: Next.js scaffold + next-intl + Better Auth (T096/T097), SSE (T101), pages (T102–T106, voice picker T108a),
  Docker (T107), E2E (T092/T093), T095 timing test, styles T150–T154, M3 report. Nothing committed since 8cfc390.

## 2026-11-12 — M3 web app done (Claude Code)

- apps/web (Next.js 16.4.3, next-intl vi/en, Better Auth): create page with voice picker + preview clips,
  editor (MP4 preview, scene strip, chat, undo/redo, versions, downloads), review screens (script + style
  cards with thumbnails, storyboard grid), SSE progress, friendly error codes. ADR 0008.
- Backend: migrations 0003/0004, `withUser`, project service, `dbSink`, `runWorkerApp`, `pnpm db:migrate`,
  `scripts/dev-stack.mjs` (`pnpm dev:mock`), Docker: `docker/web.Dockerfile`, `docker/compose.yml`.
- Verified: E2E (Playwright) create → 3 chat edits → download, and no-tech-leak scan: pass on the dev stack and
  on the Docker stack; partial re-render 1 scene vs 8: 23.8 s vs 105.1 s (4.4×, T095); integration suites.
- Next: styles 4–8 (T150–T154), M3 report + walkthrough (T108), GATE M3.

## 2026-11-13 — M3 done, awaiting GATE M3 (Claude Code)

- Style packs slides, news, terminal, glass-gradient, flat-illustration (ADR 0009): narration cues
  (`findCue`), bitmap glass background, `backdrop-filter` only on small elements, fonts with "₫", Lucide icons.
- Verified in the render container: overflow harness 32/32 (8 packs × 4 aspects), goldens written for the 5 new
  packs and 3 old packs still match 32/32, render cost 125–172 ms/frame → `perfBudget` 200 for every pack.
- Frame capture: time limits + one retry with a fresh browser (stalled pages after many scenes).
- 5 real-voice demos (QA first pass, −14 LUFS, ~$0.015 each), walkthrough from E2E screenshots, style cards.
  Report `docs/reports/M3.md`.
- Next: GATE M3 approval, then M4 (source ingest, uploads).

## 2026-11-13 — GATE M3 approved (Claude Code)

- Product owner approved M3. Next: M4 — US4 source ingest (T109–T118) and US8 brand kit / assets / AI media
  (T119–T125).

## 2026-11-13 — M4 in progress: US4 sources (Claude Code)

- Done + tested: SSRF-safe fetcher (28 tests), ingest for written script (verbatim), article (Readability,
  images only when CC-licensed + robots allow), GitHub (REST), CSV/JSON (VN/EN numbers, chart = file values),
  audio/video (whisper.cpp + MFA per segment, "keep original voice", ADR 0010); pipeline wiring (3 integration
  tests), upload validation (12 tests), create-form source picker + multipart API.
- Pending: Docker was stopped — worker-align image with whisper not built yet, real-recording check, E2E of
  the source picker, acceptance videos (T118); then US8 (T120–T125).
