---
description: "Task list for MakVid Studio — AI video SaaS from HTML animation"
---

# Tasks: Nền tảng SaaS sản xuất video AI từ animation HTML

**Input**: Design documents from `/specs/001-ai-video-saas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED. Constitution principle II and spec §7.4 mandate unit, integration, E2E and visual-regression tests. Within each story, write tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. Milestone gates (M0–M6, constitution principle I) are marked as `🛑 GATE` checkpoints: stop, write the milestone report, and wait for product-owner approval.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US9 from spec.md
- Paths follow the monorepo in plan.md (`apps/*`, `packages/*`, `tests/*`, `docker/*`, `docs/*`)

## Global rules for every task

- Code, identifiers, comments and commit messages in English; reports to the product owner in Vietnamese.
- TypeScript strict; no `any` without a `// reason:` comment.
- All user text normalized NFC at the boundary (`packages/spec/src/text/nfc.ts`).
- Before using any external library/API, read its current docs or source (pinned versions from research.md). Do not invent APIs.
- "Done" = it ran for real: an MP4 is produced and opened, and tests pass.
- Update `docs/PROGRESS.md` at the end of each working session.

---

## Phase 1: Setup — M0 spike, benchmark and repo scaffolding

**Purpose**: M0 deliverables (no product code) plus the bare repository skeleton.

### M0 spikes (throwaway code under `spikes/`, never imported by product code)

- [x] T001 Create `spikes/hyperframes/` with a 10 s GSAP composition containing the Vietnamese test string "Ẩn Ỹ Ự — Tiếng Việt có dấu đầy đủ" at 1080×1920 and 1920×1080, rendered via `createRenderJob`/`executeRenderJob` from `@hyperframes/producer@0.9.34` inside a Linux container (`spikes/hyperframes/Dockerfile`)
- [x] T002 In `spikes/hyperframes/determinism.ts`, render the spike twice with per-frame SHA-256 and diff the hash lists; record result in `spikes/hyperframes/REPORT.md`
- [x] T003 In `spikes/hyperframes/chunked.ts`, render via `planV2` → 3× `renderChunkV2` → `assembleV2` and compare against the single-pass render (frame hashes + audio waveform diff); record in `spikes/hyperframes/REPORT.md`
- [x] T004 Investigate and document in `spikes/hyperframes/REPORT.md` how to disable the `@hyperframes/core` `gsap-cdn` path and serve a locally bundled GSAP, verified with network blocked (`--network none`)
- [x] T005 [P] Create minimal Next.js page `spikes/player-next/app/page.tsx` embedding `<hyperframes-player src controls>` with seek + audio; record findings in `spikes/hyperframes/REPORT.md`
- [x] T006 [P] Measure render speed (frames/s, CPU, RAM) on the proposed standard worker (8 vCPU/16 GB) for both aspects; record in `spikes/hyperframes/REPORT.md` with a stability/risk assessment of the <1.0 library API
- [x] T007 [P] Create `bench/tts/sample-vi.txt` (~600 chars, full diacritics incl. Ẩ Ỹ Ự, numbers, an English brand name) and `bench/tts/run.ts` that calls ≥4 providers from research.md R6 (Azure vi-VN, Google Cloud TTS vi-VN, ElevenLabs, FPT.AI or Viettel AI, plus one open-source model if its weight license allows commercial use) and saves `bench/tts/out/<provider>-<voice>.mp3`
- [x] T008 Write `bench/tts/report.md`: per provider — voices (gender, region), naturalness MOS from a blind test with ≥5 Vietnamese listeners, current price per 1,000 chars (quote pricing page URL + access date), word-timestamp support, commercial license terms; end with a recommendation — _closed by product-owner decision (ADR 0002): FPT.AI default, single provider, MOS not run_
- [x] T009 [P] Create `spikes/align/` evaluating whisper.cpp word timestamps + text DTW matching vs. reference timestamps on 3 TTS files; if median error ≥100 ms, evaluate WhisperX and check the Vietnamese wav2vec2 model license; record in `spikes/align/REPORT.md` — _re-run on FPT audio: whisper.cpp fails ±150 ms → per-chunk synthesis (ADR 0002)_
- [x] T010 [P] Create `spikes/queue/` running BullMQ flows, priorities and rate limiter against Valkey 8; record pass/fail in `spikes/queue/REPORT.md`
- [x] T011 [P] Evaluate license scanners for pnpm monorepos; produce `spikes/license-scan/REPORT.md` with the chosen tool and a deny-list (AGPL-_, SSPL-_, RSAL-_, CC-BY-NC-_, BUSL-*)
- [x] T012 Write the M0 report (Vietnamese) in `docs/reports/M0.md`: spike videos (links to MP4 under `docs/reports/assets/M0/`), TTS table + audio samples, alignment result, render-speed numbers, updated infra cost estimate, decisions needed (default TTS, infra budget)

**🛑 GATE M0**: Product owner approves plan.md + M0 report; spike videos 9:16 and 16:9 show Vietnamese correctly. Record chosen default TTS in `docs/decisions/0002-default-tts.md`.

### Repository scaffolding (after M0 approval)

- [x] T013 Initialize git repo, root `package.json` (pnpm workspaces, `packageManager` pinned), `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` (Node 22), `.gitignore`, `.gitattributes`, `.editorconfig`
- [x] T014 [P] Create shared configs in `packages/config/` (`tsconfig.base.json` strict, `eslint.config.mjs` with `@typescript-eslint/no-explicit-any` error, `prettier.config.mjs`)
- [x] T015 [P] Create `AGENTS.md` (conventions, build/test commands, folder map), `CLAUDE.md` pointing to `AGENTS.md`, `docs/PROGRESS.md`, `docs/decisions/README.md` (ADR template)
- [x] T016 [P] Create `THIRD_PARTY_LICENSES.md` and `scripts/license-check.mjs` using the tool chosen in T011 with the deny-list; wire into root `pnpm license:check`
- [x] T017 [P] Create `docker/compose.dev.yml` with postgres:17, valkey:8, seaweedfs (S3 gateway), plus `.env.example` documenting every variable
- [x] T018 [P] Create CI skeleton `.github/workflows/ci.yml`: install, lint, typecheck, unit test, license check
- [x] T019 Create empty package skeletons (package.json, tsconfig, `src/index.ts`, Vitest config) for `packages/{spec,compiler,style-kit,renderer,ai,tts,media,queue,db,billing,storage,ui}` and `apps/{cli,worker-ai,worker-audio,worker-render,worker-align,web}`

---

## Phase 2: Foundational — M1 core render (blocks all user stories)

**Purpose**: VideoSpec, compiler, renderer, style kit, 3 style packs, CLI, plus base DB/queue/storage used by every story.

### Tests first

- [x] T020 [P] Unit tests for VideoSpec schema and invariants in `packages/spec/test/schema.test.ts` (NFC enforced; unique `scene.id`; `scriptRefs` must exist; `meta.language` = `"vi"`; `targetDurationSec` in [30, 600]; aspects ⊆ {"16:9","9:16","1:1","4:5"})
- [x] T021 [P] Unit tests for patch apply/validate and affected-scene computation in `packages/spec/test/patch.test.ts` (RFC 6902; voice/script change ⇒ all scenes affected; transition/timing change ⇒ neighbors affected)
- [x] T022 [P] Unit tests for migrations in `packages/spec/test/migrate.test.ts`
- [x] T023 [P] Unit tests for `fitText` and grapheme splitting in `packages/style-kit/test/text.test.ts` (Vietnamese strings with Ẩ Ỹ Ự, decomposed input, 200-char title, long compound words; never break mid-word; never split a diacritic from its base via `Intl.Segmenter`)
- [x] T024 [P] Unit tests for seeded PRNG determinism in `packages/style-kit/test/rng.test.ts`
- [x] T025 [P] Shared Renderer contract test suite in `packages/renderer/test/renderer.contract.ts` run against both `HyperFramesRenderer` and `FallbackRenderer` (frame count, dimensions, per-frame hash stability across 2 runs, chunked == single-pass)
- [x] T026 [P] Style pack lint tests in `packages/style-kit/test/lint.test.ts` (rejects `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, raw `requestAnimationFrame`, absolute `http(s)://` URLs, remote `@import`, missing templates/layouts, text slots without `maxLength`)
- [x] T027 [P] DOM overflow/overlap/safe-area test harness in `tests/visual/overflow.test.ts` filling every template slot with max-length Vietnamese text in all 4 aspects

### packages/spec

- [x] T028 Implement VideoSpec zod schema per `contracts/videospec.md` in `packages/spec/src/schema.ts` (`specVersion: "0.1.0"`)
- [x] T029 [P] Implement NFC utilities and recursive normalizer in `packages/spec/src/text/nfc.ts`
- [x] T030 Implement RFC 6902 patch apply + post-validate + `affectedScenes()` in `packages/spec/src/patch.ts`
- [x] T031 [P] Implement sequential migration framework in `packages/spec/src/migrate.ts`
- [x] T032 [P] Create sample fixture `fixtures/specs/sample-vi.json` (~30 s, 8 scenes using all 8 template types, Vietnamese script with full diacritics) used by every style demo

### packages/style-kit

- [x] T033 Implement seeded PRNG `rng(seed)` (e.g. mulberry32) in `packages/style-kit/src/rng.ts`
- [x] T034 Implement `AnimationRuntime` interface + GSAP adapter (locally bundled, pinned `gsap@3.15.1`) in `packages/style-kit/src/runtime/{index,gsap}.ts` per ADR 0001
- [x] T035 [P] Implement MIT fallback runtime adapter (WAAPI or Anime.js) in `packages/style-kit/src/runtime/fallback.ts` per ADR 0001
- [x] T036 Implement `fitText` (shrink to `minFontSize`, then word-wrap) and `splitGraphemes` in `packages/style-kit/src/text.ts`
- [x] T037 [P] Implement safe-area tables per aspect in `packages/style-kit/src/safe-area.ts` (9:16 reserves TikTok/Reels/Shorts UI zones)
- [x] T038 Implement style pack loader + validator (manifest, tokens, 8 templates × 4 layouts, slot schemas, font LICENSE + Vietnamese glyph coverage via font table inspection) in `packages/style-kit/src/loader.ts`
- [x] T039 Implement style lint (AST-based) in `packages/style-kit/src/lint.ts` and CLI entry `makvid lint-style`

### packages/compiler

- [x] T040 Implement compiler: VideoSpec + style pack + brand overrides → per-scene directory (`index.html`, local assets, bundled runtime, no external URLs) in `packages/compiler/src/compile.ts`
- [x] T041 Implement deterministic scene hashing (`cacheKey = sha256(sceneHTML + assetHashes + exportConfig + engineVersion)`) in `packages/compiler/src/hash.ts`
- [x] T042 [P] Implement caption track renderer (word highlight, max 2 lines, safe area, no mid-word breaks) in `packages/compiler/src/captions.ts`
- [x] T043 [P] Implement SRT writer in `packages/compiler/src/srt.ts` with Vietnamese diacritics round-trip test

### packages/renderer

- [x] T044 Implement `Renderer` interface per `contracts/provider-interfaces.md` in `packages/renderer/src/types.ts`
- [x] T045 Implement `HyperFramesRenderer` (pinned `@hyperframes/producer@0.9.34`, chunked via `planV2`/`renderChunkV2`/`assembleV2`, request interception blocking all network) in `packages/renderer/src/hyperframes.ts`
- [x] T046 [P] Implement `FallbackRenderer` (Puppeteer, virtual-time frame stepping via the `window.__hf` seek protocol, FFmpeg encode) in `packages/renderer/src/fallback.ts`
- [x] T047 Implement `captureFrames()` with DOM metrics (bounding boxes, computed font size, overflow flags, contrast samples) in `packages/renderer/src/capture.ts`
- [x] T048 Implement scene concat + audio mux (FFmpeg concat demuxer, 1080p30 H.264 yuv420p + AAC, faststart) in `packages/renderer/src/mux.ts`

### Style packs M1 (each: manifest, tokens, fonts, 8 templates × 4 layouts, presets, captions, sfx, prompt.md)

- [x] T049 [P] Create style pack `packages/styles/minimal/` (light background, strict grid, restrained motion)
- [x] T050 [P] Create style pack `packages/styles/kinetic/` (typography-led, grapheme-safe splitting)
- [x] T051 [P] Create style pack `packages/styles/infographic/` (SVG bar/line/pie charts and counting numbers from slot data)
- [x] T052 Run the MIT fallback runtime against `packages/styles/minimal/` and make its golden tests pass (ADR 0001 exit path)

### CLI and golden frames

- [x] T053 Implement `makvid render|qa|golden|lint-style|validate` per `contracts/cli.md` in `apps/cli/src/` (exit codes 0/1/2/3, `--frame-hashes`, `--json` NDJSON)
- [x] T054 Implement golden-frame runner in `tests/visual/golden.ts` (runs only inside the Linux render container) and commit goldens to `packages/styles/<id>/golden/` — _implemented as `makvid golden` (apps/cli/src/commands/golden.ts), run via scripts/verify-render.sh_
- [x] T055 [P] Create `docker/worker-render.Dockerfile` (Node 22, chrome-headless-shell, FFmpeg, fonts) and add a `render-smoke` CI job rendering `fixtures/specs/sample-vi.json`

### Base infrastructure used by all stories

- [x] T056 [P] Implement `ObjectStore` (S3 API via AWS SDK v3; SeaweedFS/R2/S3 by config; signed URLs) in `packages/storage/src/index.ts`
- [x] T057 [P] Create Drizzle setup + base tables `users`, `workspaces`, `memberships` (role enum `owner|admin|editor|viewer`, unique(workspace_id, user_id)) and RLS helper `withWorkspace(tx, workspaceId)` in `packages/db/src/`
- [x] T058 [P] Implement queue primitives (job naming, idempotency key `(versionId, step, inputHash)`, priority classes preview > single > batch, cost hook) in `packages/queue/src/`
- [x] T059 [P] Implement `UserFacingError` (error code → i18n message key + hint; raw detail kept internal only) in `packages/ui/src/errors.ts` and `packages/ui/messages/{vi,en}.json`
- [x] T060 [P] Implement structured logging (pino) and error-tracking adapter in `packages/queue/src/observability.ts`
- [x] T061 Write M1 report in `docs/reports/M1.md`: 4-aspect MP4s from `sample-vi.json`, identical frame-hash proof of 2 renders, overflow test results, golden frames, fallback-runtime proof

**🛑 GATE M1**: MP4 1080p30 in all 4 aspects; 2 renders identical per frame; overflow tests pass; golden frames exist.

---

## Phase 3: User Story 1 — One-click automatic video from an idea (P1) 🎯 MVP — M2

**Goal**: Prompt in Vietnamese → complete MP4 with animation, Vietnamese voice, word-highlight captions, music, SFX, QA, cost log, with no stops.

**Independent Test**: 10 diverse Vietnamese prompts in `fixtures/prompts/m2-acceptance.json` in Automatic mode; ≥9/10 pass QA with no intervention; caption offset <100 ms; average cost report exists.

### Tests for User Story 1

- [x] T062 [P] [US1] Integration test of the full 8-step pipeline with mock LLM/TTS fixtures in `tests/integration/pipeline-auto.test.ts` (asserts usage_records per step, idempotent re-run skips cached steps)
- [x] T063 [P] [US1] Contract tests for `LlmProvider` (OpenAI SDK, mock server) in `packages/ai/test/llm.contract.test.ts`
- [x] T064 [P] [US1] Contract tests for `TtsProvider` and `Aligner` in `packages/tts/test/tts.contract.test.ts`
- [x] T065 [P] [US1] Caption sync test measuring word-onset error between captions and narration (<100 ms) in `tests/integration/caption-sync.test.ts`
- [x] T066 [P] [US1] Audio test asserting integrated loudness −14 LUFS ±1 and music ducking during speech in `tests/integration/audio-mix.test.ts`
- [x] T067 [P] [US1] QA checker tests with deliberately broken scenes (overflow, overlap, outside safe area, low contrast, missing glyph) in `apps/worker-render/test/qa.test.ts`

### Implementation for User Story 1

- [x] T068 [P] [US1] Create tables `projects` (mode `auto|review`, status enum per data-model.md), `source_materials`, `project_versions` (immutable, `seq`, `spec` jsonb, `patch` jsonb), `jobs` (unique(version_id, step, input_hash)), `render_cache`, `render_outputs`, `qa_reports`, `usage_records` (`cost_usd numeric(12,6)`) in `packages/db/src/schema/`
- [x] T069 [P] [US1] Implement `LlmProvider` on the `openai` SDK with per-step config (`baseURL + apiKey + model`; default Claude via OpenAI-compatible endpoint) and token usage capture in `packages/ai/src/llm.ts`
- [x] T070 [P] [US1] Implement default `TtsProvider` (chosen in ADR 0002) in `packages/tts/src/providers/<provider>.ts` returning `words[]` when available
- [x] T071 [P] [US1] Implement `Aligner` client calling `apps/worker-align` (whisper.cpp + DTW, per spikes/align) in `packages/tts/src/aligner.ts` and `apps/worker-align/src/server.ts` — _implemented with Montreal Forced Aligner instead of whisper.cpp (ADR 0006); service in Python (MFA env)_
- [x] T072 [P] [US1] Seed royalty-free music library with license/mood/BPM metadata in `packages/media/library/music/manifest.json` and `sfx/manifest.json`; add entries to `THIRD_PARTY_LICENSES.md`
- [x] T073 [US1] Implement `ingest` step for prompt source → SourceMaterial (NFC) in `apps/worker-ai/src/steps/ingest.ts`
- [x] T074 [US1] Implement `script` step (Vietnamese narration, hook within first 3 s for ≤60 s videos, duration within ±10% of target) with prompts in `packages/ai/src/prompts/script.ts` and step in `apps/worker-ai/src/steps/script.ts`
- [x] T075 [US1] Implement `style_suggest` step returning 2–3 styles with short reasons (auto mode picks #1) in `apps/worker-ai/src/steps/style-suggest.ts`
- [x] T076 [US1] Implement `storyboard` step producing a valid VideoSpec (templates preferred; `freeform` only when no template fits, target <20%) with structured output validated by zod in `apps/worker-ai/src/steps/storyboard.ts`
- [x] T077 [US1] Implement freeform-scene linter + sandbox check (no network, no external script, no real-time APIs, style tokens only) in `packages/compiler/src/freeform.ts`
- [x] T078 [US1] Implement `tts` + `align` steps updating scene timing and element cue times from word timestamps in `apps/worker-audio/src/steps/tts.ts`
- [x] T079 [US1] Implement audio mix (narration + music + SFX, `sidechaincompress` ducking, 2-pass `loudnorm` to −14 LUFS) in `apps/worker-audio/src/mix.ts`
- [x] T080 [US1] Implement `compile` step in `apps/worker-render/src/steps/compile.ts`
- [x] T081 [US1] Implement `qa` step (keyframe capture, DOM checks, optional VLM score, auto-fix loop max N=2 via LLM patch, then `needs_attention` with per-scene user message) in `apps/worker-render/src/steps/qa.ts`
- [x] T082 [US1] Implement `render_scene` (cache lookup by cacheKey, parallel scenes) and `mux` (concat + audio + SRT + auto thumbnail from best-scored frame) in `apps/worker-render/src/steps/{render-scene,mux}.ts`
- [x] T083 [US1] Implement BullMQ flow orchestration for the 8 steps, retries, intermediate artifacts and per-step cost logging in `packages/queue/src/flows/produce-video.ts`
- [x] T084 [US1] Implement progress events with friendly Vietnamese/English messages ("Đang dựng cảnh 4/9") in `packages/queue/src/progress.ts`
- [x] T085 [US1] Add CLI command `makvid produce --prompt "<text>" --aspect 9:16` in `apps/cli/src/commands/produce.ts` for headless M2 acceptance
- [x] T086 [US1] Create `fixtures/prompts/m2-acceptance.json` (10 prompts: education, news, GitHub repo, social short, data) and script `scripts/m2-acceptance.ts` producing a pass/fail + cost report
- [x] T087 [US1] Write M2 report `docs/reports/M2.md` (10 videos, QA results, caption-offset stats, average cost per video)

**🛑 GATE M2**: ≥9/10 prompts clean; caption offset <100 ms; average cost reported.

---

## Phase 4: User Story 3 — Review mode and style selection (P3) — M2/M3

**Goal**: Pipeline pauses after script and after storyboard; user picks 1 of 2–3 suggested styles with thumbnails.

**Independent Test**: Review-mode run: edit one script line, choose style #2, remove one storyboard scene; final video reflects all three.

> Placed before US2 because it reuses the same pipeline and is needed by the web flow in US2.

### Tests for User Story 3

- [x] T088 [P] [US3] Integration test for review-mode pauses and resume in `tests/integration/pipeline-review.test.ts`

### Implementation for User Story 3

- [x] T089 [US3] Add `awaiting_script_review` / `awaiting_storyboard_review` states and resume handlers to `packages/queue/src/flows/produce-video.ts` — _done as `startProduction` / `resumeProduction` + `produceSegments` in `packages/pipeline` (queue package stays generic)_
- [x] T090 [P] [US3] Generate static style thumbnails from each pack's demo into `packages/styles/<id>/demo/thumbnail.webp` via `makvid golden --thumbnails`
- [x] T091 [US3] Implement storyboard thumbnail grid generation (one keyframe per scene) in `apps/worker-render/src/steps/storyboard-preview.ts` — _done as the `preview` stage, `packages/pipeline/src/steps/preview.ts` (render queue)_

**Checkpoint**: Review mode works via CLI/API; UI added in US2 phase.

---

## Phase 5: User Story 2 — Preview and chat editing in the web app (P2) — M3

**Goal**: Web app with sign-in, workspace, create flow, realtime preview, chat edits as patches, version history, duplicate, bilingual UI.

**Independent Test**: A non-coder creates a video from a prompt and makes 3 different chat edits; only affected scenes re-render; undo/redo/restore work; no technical text appears; E2E passes.

### Tests for User Story 2

- [x] T092 [P] [US2] E2E test sign-up → create → 3 chat edits → download in `tests/e2e/create-and-edit.spec.ts`
- [x] T093 [P] [US2] E2E test scanning all user pages for technical strings (`{`, `<div`, `Error:`, stack traces, JSON) in `tests/e2e/no-tech-leak.spec.ts`
- [x] T094 [P] [US2] Unit tests for chat→patch intent parsing incl. ambiguous request ⇒ one clarifying question, out-of-range scene ⇒ explanation without change, in `packages/ai/test/chat-patch.test.ts`
- [x] T095 [P] [US2] Integration test that a single-scene edit re-renders only that scene and is ≥3× faster than full render in `tests/integration/partial-rerender.test.ts`

### Implementation for User Story 2

- [x] T096 [P] [US2] Scaffold `apps/web` (Next.js App Router, next-intl with `vi` default + `en`, shared UI from `packages/ui`)
- [x] T097 [P] [US2] Integrate Better Auth (email + Google) with Drizzle adapter and organization/workspace mapping in `apps/web/src/server/auth.ts`
- [x] T098 [P] [US2] Create table `chat_messages` (role `user|assistant`, kind `edit|clarify|info`, `target_scene_id?`) in `packages/db/src/schema/chat.ts`
- [x] T099 [US2] Implement chat→patch step (LLM produces RFC 6902 patch targeted by `scene.id`, validated by zod + compile; optimistic lock on `parent_version_id = head`) in `apps/worker-ai/src/steps/chat-patch.ts` — _runs in the web request; re-render on the workers (ADR 0008)_
- [x] T100 [US2] Implement version service (create, undo/redo by moving `head_version_id`, restore, duplicate project) in `apps/web/src/server/versions.ts`
- [x] T101 [US2] Implement SSE progress endpoint mapping job events to friendly messages in `apps/web/src/app/api/projects/[id]/events/route.ts`
- [x] T102 [US2] Build create-project page (idea input, aspect, duration, mode) in `apps/web/src/app/[locale]/projects/new/page.tsx`
- [x] T103 [US2] Build project editor page: `<hyperframes-player>` preview with audio and seek, scene thumbnail strip with selection, chat panel in `apps/web/src/app/[locale]/projects/[id]/page.tsx` — _preview plays the rendered MP4 (ADR 0008)_
- [x] T104 [P] [US2] Build review screens for US3 (script editor, style picker with thumbnails + reasons, storyboard grid) in `apps/web/src/app/[locale]/projects/[id]/review/`
- [x] T105 [P] [US2] Build version history panel (undo, redo, restore) in `apps/web/src/components/VersionHistory.tsx`
- [x] T106 [US2] Build downloads (MP4 per aspect, SRT, thumbnail via signed URLs) in `apps/web/src/components/Downloads.tsx`
- [x] T107 [US2] Add `docker/web.Dockerfile`, worker Dockerfiles and root `docker/compose.yml` running the full stack with `docker compose up -d`
- [x] T108a [US2] Voice picker: list voices (FPT VITs / pro / ultra) with gender + region and a pre-generated preview clip per voice (`packages/tts/library/voices/`), selectable per project; default `vits:banmai` (product-owner decision 2026-11-12) — _library + catalog done (21 clips, `voiceCatalog()`); picker UI with the web app_ — _library + catalog done (21 clips, `voiceCatalog()`); picker UI comes with the web app_
- [x] T108b [US2] Licensed music library: integrate the commercial music provider chosen by the product owner (ADR 0007) behind a `MusicProvider` interface; keep procedural beds as offline fallback (product-owner decision 2026-11-12)
- [x] T108 [US2] Write M3 report `docs/reports/M3.md` (non-coder walkthrough recording, E2E results, 8 style packs)

**🛑 GATE M3**: Non-coder creates and edits 3 times without seeing technical info; E2E pass; 8 style packs (Phase 12 T150–T154).

---

## Phase 6: User Story 4 — Multiple input sources (P4) — M4

**Goal**: Script, article URL, GitHub repo, CSV/JSON, audio/video inputs.

**Independent Test**: One sample video per source type in `fixtures/sources/` passes QA.

### Tests for User Story 4

- [x] T109 [P] [US4] SSRF tests (private IPs, localhost, DNS rebinding, redirects to private ranges, non-http schemes) in `packages/media/test/ssrf.test.ts`
- [x] T110 [P] [US4] Ingest tests per source with fixtures in `packages/media/test/ingest.test.ts` (written script preserved verbatim after NFC; article main content only; CSV numbers equal chart values)

### Implementation for User Story 4

- [x] T111 [P] [US4] Implement SSRF-safe fetcher (resolve + block private ranges, re-check after redirect, size/time limits) in `packages/media/src/net/safe-fetch.ts`
- [x] T112 [P] [US4] Implement written-script ingest (keep narration verbatim, only split scenes) in `packages/media/src/ingest/script.ts` and storyboard mode flag in `apps/worker-ai/src/steps/storyboard.ts` — _verbatim script in packages/pipeline (scriptFromSource), no separate storyboard mode needed_
- [x] T113 [P] [US4] Implement article ingest with `@mozilla/readability` + `linkedom`, image extraction only when license/robots allow, in `packages/media/src/ingest/article.ts`
- [x] T114 [P] [US4] Implement public GitHub ingest (README, releases, recent commits via REST API) in `packages/media/src/ingest/github.ts`
- [x] T115 [P] [US4] Implement CSV/JSON ingest with type inference and chart-ready series in `packages/media/src/ingest/table.ts`
- [x] T116 [P] [US4] Implement audio/video ingest → word-timestamped transcript via `Aligner`, option to use the source audio as narration, in `packages/media/src/ingest/media.ts`
- [x] T117 [US4] Add source pickers (script, URL, GitHub, file upload) to `apps/web/src/app/[locale]/projects/new/page.tsx`
- [x] T118 [US4] Create `fixtures/sources/` (one per type) and render acceptance videos into `docs/reports/assets/M4/sources/`

---

## Phase 7: User Story 8 — Brand kit, assets and AI media (P8) — M4

**Goal**: Workspace brand kit overrides style colors/fonts; asset library; optional AI image/video generation with cost tracking.

**Independent Test**: Enable a brand kit; every scene uses brand colors/fonts and logo in all 4 aspects; disabled MediaGen ⇒ zero media-gen cost.

### Tests for User Story 8

- [x] T119 [P] [US8] Upload validation tests (MIME allowlist + magic-byte sniff + size limits per kind) in `apps/web/test/upload.test.ts`
- [x] T120 [P] [US8] Brand override visual test across 4 aspects in `tests/visual/brand-kit.test.ts`

### Implementation for User Story 8

- [x] T121 [P] [US8] Create tables `brand_kits`, `assets` (unique(workspace_id, sha256); `kind` enum per data-model.md; license jsonb), `music_tracks`, `sfx`, `voices` in `packages/db/src/schema/assets.ts`
- [x] T122 [P] [US8] Implement upload service (validation, sha256 dedupe, font glyph check for Vietnamese) in `apps/web/src/server/uploads.ts`
- [x] T123 [US8] Implement brand-kit token override in `packages/compiler/src/brand.ts`
- [x] T124 [P] [US8] Implement `MediaGenProvider` interface + one provider adapter with content-hash cache and cost logging in `packages/media/src/gen/`
- [x] T125 [US8] Build brand kit and asset library pages in `apps/web/src/app/[locale]/workspace/brand/` and `.../assets/`

---

## Phase 8: User Story 5 — Batch from template + CSV (P5) — M5

**Goal**: Template with `{{variables}}` + CSV → one video per row, parallel, progress page, retry failed rows, ZIP download.

**Independent Test**: 100-row CSV from a 30 s template yields 100 correct videos.

### Tests for User Story 5

- [x] T126 [P] [US5] Template variable substitution + missing-column validation tests in `packages/spec/test/variables.test.ts`
- [x] T127 [P] [US5] Integration test: 10-row batch with 2 injected failures, retry-failed reprocesses only those rows, in `tests/integration/batch.test.ts`
- [x] T128 [P] [US5] Priority test: single video enqueued during a running batch starts first, in `tests/integration/priority.test.ts`

### Implementation for User Story 5

- [x] T129 [P] [US5] Create tables `templates` (variables jsonb: name, type, required, maxLength), `batches` (status enum `validating|queued|running|completed|completed_with_errors|paused_quota|cancelled`), `batch_items` in `packages/db/src/schema/batch.ts`
- [x] T130 [US5] Implement "save as template" + variable extraction in `apps/web/src/server/templates.ts`
- [x] T131 [US5] Implement batch flow (CSV validation, fan-out at batch priority, per-workspace concurrency limit, pause on quota, ZIP assembly) in `packages/queue/src/flows/batch.ts`
- [x] T132 [US5] Implement distributed render: scene/chunk fan-out across N `worker-render` containers using `planV2WithPublisher` artifacts on object storage in `apps/worker-render/src/distributed.ts`
- [x] T133 [US5] Build batch pages (upload CSV, mapping check, progress per row, retry failed, download ZIP) in `apps/web/src/app/[locale]/batches/`
- [ ] T134 [US5] Run 100-video acceptance (`fixtures/batch/100.csv`) and scaling benchmark with 1/2/4 workers; record in `docs/reports/M5.md`

---

## Phase 9: User Story 6 — Workspace roles, quota, billing, free plan (P6) — M5

**Goal**: Roles, invitations, plan limits with visible usage, blocking before cost, subscriptions/credits via `PaymentProvider`, free plan with watermark.

**Independent Test**: Two workspaces fully isolated; Viewer cannot edit; exceeding quota is blocked before any cost.

### Tests for User Story 6

- [x] T135 [P] [US6] Workspace isolation test suite (every table/API route/signed URL) in `tests/isolation/workspace-isolation.test.ts`
- [x] T136 [P] [US6] Role permission matrix tests (owner/admin/editor/viewer) in `apps/web/test/rbac.test.ts`
- [x] T137 [P] [US6] Quota reserve/commit/refund tests incl. concurrent reservations in `packages/billing/test/quota.test.ts`

### Implementation for User Story 6

- [x] T138 [P] [US6] Create tables `invitations`, `plans` (limits jsonb per data-model.md; `free`: 3 videos/month, ≤60 s, watermark, no batch/API/mediagen), `subscriptions`, `credit_ledger`, `usage_periods`, `payment_events` (unique event_id), `abuse_signals` in `packages/db/src/schema/billing.ts`; enable RLS policies on all tenant tables
- [x] T139 [US6] Implement quota service with atomic reservation before enqueue in `packages/billing/src/quota.ts` and wire into `packages/queue/src/flows/*`
- [x] T140 [US6] Implement `PaymentProvider` interface + provider chosen by product owner (ADR 0004) in `packages/billing/src/providers/`
- [x] T141 [US6] Implement watermark overlay for free plan in `packages/compiler/src/watermark.ts`, and free-plan abuse signals in `apps/web/src/server/abuse.ts`
- [x] T142 [US6] Build members/invitations, usage meters, plans/checkout pages in `apps/web/src/app/[locale]/workspace/`

---

## Phase 10: User Story 7 — Public API and webhooks (P7) — M5

**Goal**: `/api/v1` per `contracts/public-api.openapi.yaml`, API keys, rate limits, HMAC webhooks, generated docs.

**Independent Test**: Create a video with an API key, receive a signed webhook, verify it, download via expiring link.

### Tests for User Story 7

- [x] T143 [P] [US7] Contract tests validating responses against `contracts/public-api.openapi.yaml` in `apps/web/test/api-v1.contract.test.ts`
- [x] T144 [P] [US7] Webhook signature (`t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`), retry and SSRF tests in `apps/web/test/webhooks.test.ts`

### Implementation for User Story 7

- [x] T145 [P] [US7] Create tables `api_keys` (argon2id hash, prefix, scopes, revoked_at) and `webhook_endpoints` (`secret_enc`) in `packages/db/src/schema/api.ts`
- [x] T146 [US7] Implement `/api/v1` routes (videos, download, templates/{id}/videos, batches, retry-failed, styles, voices) with API-key auth, Idempotency-Key and Valkey rate limit (429 + Retry-After) in `apps/web/src/app/api/v1/`
- [x] T147 [US7] Implement webhook dispatcher with HMAC signing and backoff retries in `apps/worker-ai/src/webhooks.ts`
- [x] T148 [US7] Serve generated OpenAPI docs page at `apps/web/src/app/[locale]/docs/api/page.tsx`

---

## Phase 11: User Story 9 — Platform admin (P9) — M5

**Goal**: Manage users/plans, AI cost vs revenue per workspace, queue/worker monitoring.

**Independent Test**: After several videos across workspaces, admin sees per-step usage and totals that match `usage_records`.

- [x] T149 [US9] Build admin area (users, plans, cost vs revenue per workspace, queue depth, worker health) guarded by platform-admin role in `apps/web/src/app/[locale]/admin/`

**🛑 GATE M5**: 100-video batch clean; render speed target met and near-linear scaling; quota blocking correct.

---

## Phase 12: Style library expansion (M3 → M4, cross-cutting)

**Purpose**: Reach 8 styles by M3 and 13 by M4; each pack follows `contracts/style-pack.md`, includes a ~30 s demo from `fixtures/specs/sample-vi.json`, thumbnail and goldens for 4 aspects.

- [x] T150 [P] Create `packages/styles/flat-illustration/` with a commercially licensed SVG icon/illustration set (licenses in `THIRD_PARTY_LICENSES.md`)
- [x] T151 [P] Create `packages/styles/glass-gradient/` with measured `backdrop-filter` cost within `perfBudget.maxMsPerFrame` — _measured 172 ms/frame in the render container (ADR 0009)_
- [x] T152 [P] Create `packages/styles/news/` (lower-third, ticker, "Nóng" label, source image) — _source image deferred to US4 (T113), ADR 0009_
- [x] T153 [P] Create `packages/styles/slides/` (title + bullets revealed on narration cues)
- [x] T154 [P] Create `packages/styles/terminal/` (typing effect, syntax highlight; for repo/changelog videos)
- [x] T155 [P] Create `packages/styles/neon/` (glow, scanline, seeded glitch)
- [x] T156 [P] Create `packages/styles/retro-vhs/` (noise, chroma shift, pixel font with Vietnamese glyphs)
- [x] T157 [P] Create `packages/styles/whiteboard/` (SVG stroke-dashoffset drawing, hand-with-pen)
- [x] T158 [P] Create `packages/styles/paper-collage/` (paper texture, drop shadows, stop-motion stepping)
- [x] T159 [P] Create `packages/styles/three-lite/` (Three.js, deterministic per-frame render in headless Chromium; measure CPU/GPU on worker)
- [x] T160 Implement per-scene style mixing with transition scenes and primary-style caption font/logo in `packages/compiler/src/mix-styles.ts` and storyboard prompt support in `packages/ai/src/prompts/storyboard.ts`
- [x] T161 Write `docs/style-pack-guide.md` ("how to create a new style pack")
- [x] T162 Write M4 report `docs/reports/M4.md` (13 demos, one video per input source)

**🛑 GATE M4**: Every style has a demo; every input source has a QA-passing sample video.

---

## Phase 13: Polish & cross-cutting — M6

- [ ] T163 [P] Security review: sandbox (render containers on Docker `internal` network), SSRF, upload validation, provider-key encryption (AES-256-GCM, key from env/KMS), signed URL TTLs; record in `docs/security/review-M6.md`
- [ ] T164 [P] Complete CI in `.github/workflows/ci.yml`: lint, typecheck, unit, integration (mocks), license scan, Docker image build, render-smoke, golden frames, E2E
- [ ] T165 [P] Production `docker/compose.yml` hardening (healthchecks, resource limits, `worker-render` scalable via `--scale`)
- [ ] T166 [P] Daily PostgreSQL backup + restore test script in `docker/backup/` and retention cleanup job deleting `render_outputs` past `expires_at` in `apps/worker-ai/src/cron/retention.ts`
- [ ] T167 [P] Monitoring: queue metrics, render time per minute of video, cost per video dashboards; document in `docs/ops/monitoring.md`
- [ ] T168 [P] README with step-by-step install for Windows 11 (Docker Desktop) and Linux VPS, plus `docs/ops/runbook.md`
- [ ] T169 Cross-machine determinism check: render the same spec on Windows 11 Docker Desktop and a clean Linux VPS, compare frame hashes; record in `docs/reports/M6.md`
- [ ] T170 Confirm Webflow written GSAP confirmation is on file in `docs/legal/` or fallback-runtime migration is complete (ADR 0001 release gate)
- [ ] T171 Run all scenarios in `quickstart.md` end-to-end and write the M6 report `docs/reports/M6.md`

**🛑 GATE M6**: Fresh install from README on both environments with `docker compose up -d`; full flow works; same VideoSpec → same video.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (M0)** → gate → scaffolding (T013–T019).
- **Phase 2 (M1 foundational)** blocks every user story.
- **US1 (Phase 3, M2)** depends on Phase 2.
- **US3 (Phase 4)** depends on US1 pipeline (T083).
- **US2 (Phase 5, M3)** depends on US1 + US3 back-end; T150–T154 (styles 4–8) must finish for the M3 gate.
- **US4, US8 (Phases 6–7, M4)** depend on US2 web app; independent of each other.
- **US5, US6, US7, US9 (Phases 8–11, M5)** depend on US2; US7 batch endpoints reuse US5; US6 quota is wired into US5 flows.
- **Phase 12** styles can be built in parallel any time after Phase 2; T160 needs US1 storyboard.
- **Phase 13 (M6)** after all stories.

### Story dependency graph

```text
M0 ─► Foundational(M1) ─► US1(M2) ─► US3 ─► US2(M3) ─┬─► US4(M4)
                    │                                  ├─► US8(M4)
                    └─► Styles T150–T159 (parallel)    ├─► US5 ─► US7 (M5)
                                                       ├─► US6 (M5)
                                                       └─► US9 (M5)  ─► Polish(M6)
```

### Within each story

Tests first (must fail) → DB tables → providers/services → worker steps → UI → acceptance run → milestone report.

---

## Parallel Examples

### Phase 1 (M0)

```text
T005 player-next spike | T006 render speed | T007 TTS bench | T009 alignment | T010 Valkey | T011 license scanners
```

### Phase 2 (M1)

```text
Tests: T020–T027 together
Style packs: T049 minimal | T050 kinetic | T051 infographic
Infra: T056 storage | T057 db | T058 queue | T059 errors | T060 logging
```

### User Story 1

```text
Tests: T062–T067 together
Providers: T068 tables | T069 LLM | T070 TTS | T071 aligner | T072 music library
```

### User Story 4

```text
T111 safe-fetch | T112 script | T113 article | T114 github | T115 table | T116 media
```

---

## Implementation Strategy

### MVP first

1. Phase 1 (M0) → 🛑 approval.
2. Phase 2 (M1) → 🛑 approval: deterministic 4-aspect render from a VideoSpec.
3. Phase 3 (US1, M2) → 🛑 approval: **MVP**, one-click video via CLI/worker with ≥9/10 quality.

### Incremental delivery

4. US3 + US2 + styles 4–8 → M3 web app.
5. US4 + US8 + styles 9–13 + style mixing → M4.
6. US5 + US6 + US7 + US9 → M5 business scale.
7. Phase 13 → M6 deployment.

Each milestone ends with a Vietnamese report in `docs/reports/M<n>.md` and a stop for approval.

### Multi-agent split (Claude Code + Antigravity)

- Style packs (T049–T051, T150–T159) are independent folders and suit parallel agents.
- Ingest sources (T112–T116) and providers (T069–T071) are independent files.
- Always update `docs/PROGRESS.md` before handing off.

---

## Notes

- [P] = different files, no dependency on unfinished tasks.
- Open decisions that block specific tasks: default TTS (T070, ADR 0002 after M0), payment provider (T140, ADR 0004 before M5); default TTS and infra baseline decided in ADR 0002/0003.
- Never mark a task done without running it (render produced, tests green).
