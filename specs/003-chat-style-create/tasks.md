# Tasks: Chat-style Video Creation and Live Progress

**Input**: Design documents from `/specs/003-chat-style-create/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — Constitution Principle II requires automated tests per feature.

**Organization**: Grouped by user story. Story priorities: US1 (P1), US4 (P1), US5 (P1), US2 (P2), US3 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- Paths are relative to the repo root. Web = `apps/web`.
- Rules from AGENTS.md apply: no literal UI text in JSX (add keys to both `apps/web/messages/vi.json` and `en.json`), theme tokens only, bump `PROMPT_VERSION` only if a prompt changes (not expected here).

---

## Phase 1: Setup

- [X] T001 Create feature branch `003-chat-style-create` from `main` (or from the current UI branch once merged) and check `docs/PROGRESS.md` for in-flight work touching `apps/web/src/components/create` or `packages/pipeline`
- [X] T002 [P] Add the shadcn `switch` primitive at `apps/web/src/components/ui/switch.tsx` (MIT, Radix) and run `pnpm license:check`
- [X] T003 [P] Add i18n key skeletons (empty-safe, same structure in both files) for `create.composer.*` and `progress.*` in `apps/web/messages/vi.json` and `apps/web/messages/en.json`; confirm the existing parity test still passes
- [X] T004 [P] Write ADR `docs/decisions/0014-project-activity-log.md` (persisted key+params log, SSE resume by seq, reasons from research.md R1–R3)

---

## Phase 2: Foundational (blocks US1, US2, US3, US4, US5)

**Purpose**: the persisted activity log and the shared validation used by several stories.

- [X] T005 Write migration `packages/db/migrations/0008_project_events.sql` per data-model.md: table `project_events` (id bigserial PK, workspace_id, project_id ON DELETE CASCADE, run_id, job_id ON DELETE SET NULL, attempt default 0, local_seq default 0, stage text, kind text, severity text default 'info', key text, params jsonb default '{}', fraction real, created_at); `UNIQUE (project_id, job_id, attempt, local_seq)`; partial unique index `(project_id, run_id, stage, kind, local_seq) WHERE job_id IS NULL`; index `(project_id, id)`; RLS created exactly like migration `0006_batch_billing_api.sql` (ENABLE + FORCE RLS, `<table>_tenant` policy on `app_workspace_id()`, `<table>_service` policy on `app_scope() = 'service'`, `<table>_admin` SELECT policy on `app_scope() = 'admin'`); the worker writes through the service scope
- [X] T006 Add the `project_events` Drizzle table to `packages/db/src/schema/` (new file `events.ts`, re-exported from `packages/db/src/schema.ts`) matching T005 exactly
- [X] T007 Add `0008_project_events.sql` to the migration list in `packages/db/test/rls.test.ts` and add a case proving workspace A cannot read workspace B's events (needs `MAKVID_INFRA_TESTS=1`)
- [X] T008 [P] Create `packages/pipeline/src/events.ts`: `recordEvent()` (insert with `ON CONFLICT DO NOTHING`; for entries without a job use the fixed `local_seq` per kind from data-model.md: `approval_needed=1`, `approved=2`, `done=3`; `params` values only number or short string; reject keys outside the allow-list), `listEvents(db, workspaceId, projectId, {after,before,limit})`, `stageStates()` deriving `waiting | running | needs_approval | done | failed` per data-model.md; export from `packages/pipeline/src/index.ts`
- [X] T009 [P] Add the log message keys (vi + en, no technology or provider names) to `packages/pipeline/src/messages.ts`: `log.stage.start.<stage>`, `log.stage.done.<stage>`, `log.voice.scene {current,total}`, `log.render.scene {current,total}`, `log.qa.fix {attempt}`, `log.approval.needed.<stage>`, `log.approval.done`, `log.retry {attempt}`, `log.error.<friendlyCode>`, `log.done`; export `logText(key, params, locale)` with the allow-list
- [X] T010 Wire the worker: write events from the existing `StageHooks` in `packages/pipeline/src/worker.ts` (do it in `packages/pipeline/src/sink.ts` or a new hook set merged with it): `onStageStart` → `stage_start`; the context `onProgress` hook (`hooks?.onProgress`) → `progress` with deterministic `local_seq` per job attempt; `onStageDone` → `stage_done`; `onStageFailed(err)` → `error` with severity `error`, where the `Error` is mapped to a friendly `log.error.<friendlyCode>` via `UserFacingError` and neither `err.message` nor `error_detail` is ever stored; a BullMQ retry (attempt > 0) → `retry`. Event-write failures are swallowed and logged (never fail a stage), like the other hooks; depends on T008, T009
- [X] T011 [P] Unit tests in `packages/pipeline/test/events.test.ts`: allow-list rejection, params restrictions, idempotent double insert (also for job-less kinds: a second `approval_needed` for the same stage and run is ignored, while `script` and `storyboard` approvals coexist), `stageStates` transitions (waiting→running→done, running→failed→retry), Vietnamese text keeps diacritics (NFC)
- [X] T012 [P] Create the shared client validators in `apps/web/src/components/create/validation.ts`: length integer 30–180 inclusive (reject empty, decimal, negative, NaN), idea ≥3 ≤4000, script ≥10 ≤12000, http(s) URL for url/github, file kinds for table (`.csv`,`.json`) and media (`audio/*`,`video/*`); unit tests in `apps/web/src/components/create/validation.test.ts` for 29/30/180/181/"abc"/"45.5"
- [X] T013 Run `pnpm db:migrate`, `pnpm typecheck`, `MAKVID_INFRA_TESTS=1` db + pipeline tests; fix failures before moving on

**Checkpoint**: events are persisted by the worker; validators exist.

---

## Phase 3: User Story 1 — Compose in one chat-like box (P1) 🎯 MVP

**Goal**: one composer with content-type popover (6), aspect popover (4), length input; submits the unchanged `POST /api/projects`.

**Independent Test**: pick each type, enter valid content, choose aspect and length, submit; request body equals the choices.

### Tests

- [X] T014 [P] [US1] Playwright `apps/web/e2e/composer.spec.ts`: 6 types listed; switching type changes input kind and keeps earlier text; 4 aspects with 9:16 default; length 29/181/abc blocked with range message, 30 and 180 accepted; attach file chip with remove; brand-kit checkbox (`use-brand`) shown only when the workspace has a brand kit; keyboard-only flow through type popover, aspect popover and length field, and trigger buttons have accessible names (extend `apps/web/e2e/a11y.spec.ts` with the create page); 360 px viewport has no horizontal scroll

### Implementation

- [X] T015 [P] [US1] Create `apps/web/src/components/create/ContentTypeSelect.tsx`: Popover + Command list of the 6 `SOURCES` with name and hint, check on current, `data-testid="type-trigger"`, items keep `source-<kind>` test ids
- [X] T016 [P] [US1] Create `apps/web/src/components/create/AspectSelect.tsx`: Popover list of `ASPECTS` (import from `AspectCards.tsx`) with the small frame-shape preview, `data-testid="aspect-trigger"`, items keep `aspect-<ratio>` test ids
- [X] T017 [P] [US1] Create `apps/web/src/components/create/LengthInput.tsx`: number input using T012 validator, inline `create.durationHint` message, `aria-invalid`, `data-testid="length-input"`
- [X] T018 [US1] Create `apps/web/src/components/create/CreateComposer.tsx`: one container; inner control by type (auto-growing Textarea for idea/script with counters, URL Input for url/github, attach button + file chip for table/media, `useSourceAudio` checkbox for media; `useBrand` checkbox with `data-testid="use-brand"` shown only when `hasBrand`, default on, FR-011); per-type values held in state (FR-012); controls row with T015–T017; blocking validation with existing messages (`create.tooShort`, `source.scriptTooShort`, `source.linkMissing`, `source.fileMissing`); submits the same JSON / FormData as `CreateForm.tsx` per `contracts/create-request.md`
- [X] T019 [US1] Switch `apps/web/src/app/[locale]/(app)/projects/new/page.tsx` to render `CreateComposer` (keep `voices` and `hasBrand` props); keep `CreateForm.tsx` until Phase 8 removal
- [X] T020 [US1] Fill the `create.composer.*` strings used by T015–T018 in `apps/web/messages/vi.json` and `en.json`; run the parity test

**Checkpoint**: a valid request can be composed and submitted (voice and mode still use defaults).

---

## Phase 4: User Story 4 — Summary and Start (P1)

**Goal**: live detailed summary and the "Bắt đầu tạo video" button with quota gating, single submit, navigation to progress page.

**Independent Test**: all chosen values appear in the summary; Start creates exactly one project and navigates.

- [ ] T021 [P] [US4] Playwright `apps/web/e2e/composer-start.spec.ts`: summary shows type, content preview, aspect, length, voice, mode, brand, quota and updates live; double-click Start creates one project; quota-exhausted state disables Start with reason and upgrade link; server error keeps all inputs and allows retry
- [X] T022 [US4] Extend `apps/web/src/components/create/CreateSummary.tsx`: content preview (first ~120 chars / link / file name), brand-kit line when `hasBrand`, mode and voice names, primary button label `create.composer.start` ("Bắt đầu tạo video" / "Start creating video"), `data-testid="start-video"`, disabled reason text
- [X] T023 [US4] In `CreateComposer.tsx` pass full state to the summary, block Start on invalid content or empty voice list (FR-015), guard against double submit with the busy flag, keep inputs on failure and show `create-error` (FR-016, FR-017); navigate to `/projects/{id}` on success
- [X] T024 [US4] Add summary / start strings to `vi.json` and `en.json`

**Checkpoint**: US1 + US4 deliver the full compose-and-start flow (MVP together with US5 for visibility).

---

## Phase 5: User Story 5 — Live progress with a log per stage (P1)

**Goal**: progress page with stage list and live, persisted, friendly log.

**Independent Test**: start a mock video; stages and log lines appear live; reload keeps history and streaming resumes.

### Tests

- [ ] T025 [P] [US5] Integration test `packages/pipeline/test/events-flow.test.ts` (`MAKVID_PIPELINE_TESTS=1`): a mock pipeline run produces at least one `stage_start` and one `stage_done` per stage and a `done` entry, no duplicates after a retried job
- [ ] T026 [P] [US5] Playwright `apps/web/e2e/progress.spec.ts`: lines appear without refresh (≤2 s), stage filter, scroll-up pauses follow and shows "jump to latest", reload restores history, dropping the live connection (e.g. `context.setOffline`) shows "reconnecting" and after restore the missed lines appear exactly once (resume by `Last-Event-ID`, no duplicates, FR-027), a failed run keeps the progress page with the failing stage's log and a retry action (FR-024), 360 px layout, completed video shows play and download
- [X] T027 [P] [US5] Extend `apps/web/e2e/no-tech-leak.spec.ts` to assert no engine / provider / tool names, stack traces or ids in log lines, stage states and errors across success and failure runs
- [X] T028 [P] [US5] Extend `apps/web/e2e/a11y.spec.ts` (create-page cases are in T014) to cover the progress page (log region `aria-live="polite"` for stage changes, keyboard reach of stage list and jump button)

### Implementation

- [X] T029 [US5] Create `apps/web/src/app/api/projects/[id]/log/route.ts` per `contracts/project-events.md` (`after`, `before`, `limit` 1–200, `locale`; returns entries with localized `text`, `stages`, `status`, `nextAfter`, `hasMore`; wrapped in `guarded`; 400 with standard error key on bad params)
- [X] T030 [US5] Extend `apps/web/src/app/api/projects/[id]/events/route.ts`: keep existing `data:` frames, add `event: log` frames with `id: <seq>` and `event: stages`, replay entries after `Last-Event-ID` before live ones, keep the 1 s poll and 15 s ping
- [X] T031 [P] [US5] Create `apps/web/src/components/progress/useProjectEvents.ts`: fetch history from `/log`, open `EventSource` to `/events`, de-duplicate by `seq`, expose `entries`, `stages`, `status`, `connection` (`live | reconnecting`), `loadEarlier()`
- [X] T032 [P] [US5] Create `apps/web/src/components/progress/StageList.tsx`: ordered stages with state icon + label (waiting, running, needs approval, done, failed), clickable to filter, `data-testid="stage-<stage>"`
- [X] T033 [P] [US5] Create `apps/web/src/components/progress/ActivityLog.tsx`: timestamped lines, severity styling by theme tokens, auto-follow until user scrolls up, `log-jump-latest` control, "Load earlier", keep newest ~1000 lines in DOM, `aria-live="polite"` summary region for stage changes, `data-testid="activity-log"` / `log-entry`
- [X] T034 [US5] Create `apps/web/src/components/progress/ProgressView.tsx` composing `useProjectEvents`, `StageList`, `ActivityLog`, reconnecting indicator, failed-stage panel (shown for `failed` and `needs_attention`) with plain-language reason, the full log kept visible, and the retry action (reuse existing retry action from `/api/projects/[id]/actions`) plus an "open editor" link when an editable version exists, completion panel with video preview and download (reuse `Downloads.tsx`); `data-testid="progress-page"`
- [X] T035 [US5] Update `apps/web/src/app/[locale]/(app)/projects/[id]/page.tsx` to render `ProgressView` for every status except `ready` — including `failed` and `needs_attention`, which `EditorLayout.tsx` `SETTLED` treats as settled, so the failure log stays visible (FR-024) — and `EditorLayout` once the project is `ready`; keep the review route working; `ProgressView` needs the status first, so load it via the `/log` response or a small server-side status read
- [X] T036 [US5] Add `progress.*` strings (stage names, states, controls, reconnecting, failure help) to `vi.json` and `en.json`

**Checkpoint**: full P1 experience works end to end on `pnpm dev:mock`.

---

## Phase 6: User Story 2 — Voice dialog with preview (P2)

**Goal**: voice button opens a dialog to preview and select a voice.

**Independent Test**: play two voices (first stops), select one, button and summary update.

- [X] T037 [P] [US2] Playwright `apps/web/e2e/voice-dialog.spec.ts`: default voice shown; dialog opens; second preview stops first; failed preview shows a short message without closing; confirm updates button + summary; dismiss keeps the previous voice; keyboard-only flow
- [X] T038 [US2] Update `apps/web/src/components/VoicePicker.tsx`: show a non-technical inline message when playback fails (replace the silent catch), expose a stable `data-testid` per voice row
- [X] T039 [US2] Create `apps/web/src/components/create/VoiceDialog.tsx`: Dialog wrapping `VoicePicker`, keeps a draft selection, Confirm applies / Cancel and dismiss discard, stops audio on close; trigger button `data-testid="voice-button"` shows the chosen voice name
- [X] T040 [US2] Use `VoiceDialog` in `CreateComposer.tsx`; disable Start and show an error state when the voice list is empty or failed to load; add strings to `vi.json` / `en.json`
- [X] T041 [US2] Verify `GET /api/voices/[id]/preview` creates no usage or quota record (read the route and its test); add a test in `apps/web/src/app/api/voices/[id]/preview/` if none exists

---

## Phase 7: User Story 3 — Automatic vs step-by-step toggle (P2)

**Goal**: toggle chooses mode; step-by-step pauses on the progress page for approval.

**Independent Test**: toggle, submit, request carries `mode`; progress page pauses and continues after approval.

- [X] T042 [P] [US3] Playwright `apps/web/e2e/mode-toggle.spec.ts`: default Automatic; toggle changes summary; created project has the chosen mode; in review mode the progress page shows "waiting for you" and Approve continues the run
- [X] T043 [US3] Create `apps/web/src/components/create/ModeToggle.tsx` using `ui/switch.tsx` with a one-line explanation per mode, `data-testid="mode-toggle"`, keeping `mode-auto` / `mode-review` ids for existing e2e; use it in `CreateComposer.tsx`
- [X] T044 [US3] Implement the approval mapping (already verified in research.md R7): `awaiting_script_review` → stage `script` needs approval, `awaiting_storyboard_review` → stage `storyboard` needs approval; only these two points exist; add the mapping to `stageStates()` in `packages/pipeline/src/events.ts`
- [X] T045 [US3] Emit `approval_needed` when the run enters `awaiting_script_review` / `awaiting_storyboard_review` (from the status-change code in `packages/pipeline/src/sink.ts`) and `approved` when `POST /api/projects/[id]/review` (`apps/web/src/app/api/projects/[id]/review/route.ts`) continues the run; in `ProgressView.tsx` show a "waiting for you" panel for those two stages with a button to the existing review screen (`projects/[id]/review`, no re-implementation of the review UI)
- [X] T046 [US3] Add toggle and approval strings to `vi.json` / `en.json`

---

## Phase 8: Polish & Cross-Cutting

- [X] T047 Remove the now-unused `apps/web/src/components/create/CreateForm.tsx` and `DurationField.tsx`; update imports and the existing e2e specs (`create-and-edit.spec.ts`, `m5.spec.ts`, `fixtures.ts`, `helpers.ts`) to the new test ids
- [ ] T048 [P] Check desktop + 360 px + dark mode visually for both screens with `pnpm dev:mock` (screenshots for the report), including Vietnamese diacritics in input, selectors and log
- [ ] T049 [P] Performance check: 5,000-line synthetic log keeps scrolling smooth; history paging and "load earlier" work
- [X] T050 [P] Update `AGENTS.md` layout table (`components/progress`, activity log), `docs/PROGRESS.md` entry (who, what, next), and mark finished tasks `[X]` here
- [ ] T051 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm license:check`, `MAKVID_INFRA_TESTS=1` suites and `pnpm --filter @makvid/web test:e2e`; walk through `quickstart.md` and record results in a short report under `docs/reports/`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (blocks everything) → user stories.
- **US1 (Phase 3)** needs only T012 from Phase 2; **US5 (Phase 5)** needs T005–T010. US1/US4 and US5 can run in parallel by two developers after Phase 2.
- **US4** depends on US1 (composer exists). **US2** and **US3** depend on US1 (composer slot) and are otherwise independent; US3's approval display (T045) depends on US5 (`ProgressView`).
- Polish (Phase 8) after all desired stories.

```text
Setup ─► Foundational ─┬─► US1 ─► US4 ─┬─► US2
                       │               └─► US3 (T045 also needs US5)
                       └─► US5 ────────────┘
```

## Parallel Opportunities

- Phase 1: T002, T003, T004
- Phase 2: T008, T009, T011, T012 (after T005–T006 for DB-bound ones)
- US1: T014, T015, T016, T017
- US5: T025–T028 (tests), then T031, T032, T033
- Polish: T048, T049, T050

## Implementation Strategy

- **MVP**: Phases 1–2 + US1 + US4 + US5 (all P1): compose, start, and watch the live log. Validate with `pnpm dev:mock` and stop for owner review.
- **Increment 2**: US2 (voice dialog), then US3 (toggle + approval display).
- Finish with Polish and the milestone-style report (Constitution I).

## Summary

- Total tasks: 51 (Setup 4, Foundational 9, US1 7, US4 4, US5 12, US2 5, US3 5, Polish 5)

## Status notes (2026-11-16)

Not done / partly done (left unchecked on purpose):

- **T021** (summary + start e2e): live summary and one-request-on-double-click are covered in `composer.spec.ts`; the quota-exhausted state and "server error keeps inputs" are not covered by an e2e.
- **T025** (mock-pipeline integration test of event completeness) not written; start/progress/done lines are verified live by `progress.spec.ts` and in the database during the run.
- **T026** (progress e2e): live lines, reload, stage filter, jump-to-latest and review pause are covered; going offline and catching up without duplicates is **not** tested, and the failed-run view was checked by hand only (this machine cannot render, so runs fail at the audio / quality step).
- **T048** (screenshots, dark mode, 360 px visual check) and **T049** (5,000-line log performance) not done; 360 px only checks "no horizontal scroll".
- **T051**: typecheck, lint, license check, unit and infra tests pass; the full old e2e suite (render-dependent specs `create-and-edit`, `sources`, `m5`, `brand`) was **not** run here (no FFmpeg / chrome-headless-shell on this machine), nor the old signed-in axe sweep (crashed on memory).

Deviations from the plan, with reasons:

- The progress UI is a panel inside `EditorLayout` (`components/progress/ProgressPanel.tsx`), not a separate page: the review cards already live in the editor, and this keeps the log visible for failed runs (F1). T035 became "render the panel for every status except `ready`".
- Stages shown are the pipeline's real ones: script, style, storyboard (includes the preview step), audio, qa, render. The worker writes `stage` from the same names; `ingest`, `mix`, `mux` are progress lines inside a stage, not stages.
- Failure action is a "Start again" link to the create screen; there is no per-stage retry and no "open editor" link yet (T034 partial).
- Start button keeps the existing test id `create-submit` (used by the older e2e) instead of `start-video`.
- Content/aspect selectors use a plain radio list in a popover (`OptionList`) instead of `Command`: without a search box `cmdk` receives no keyboard events, which axe and a keyboard run showed.
- Error text in the new UI uses `text-foreground` with a red border or icon: `text-destructive` on light surfaces fails 4.5:1 in the current theme (a theme issue; the outline `Button` hover colour also fails, found by axe, not changed here).

