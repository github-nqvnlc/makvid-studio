# Research: Chat-style Video Creation and Live Progress

All Technical Context unknowns resolved from the current codebase (verified by reading the files named below).

## R1 — How to persist and stream a log

- **Finding**: The worker already emits `progressEvent({key, params, fraction})` through `hooks.onProgress` (`packages/pipeline/src/worker.ts`). The SSE route (`apps/web/src/app/api/projects/[id]/events/route.ts`) polls `latestProgress()` every second and sends only the _latest_ sentence, so history is lost.
- **Decision**: Add a `project_events` table written from `onProgress` (and from stage start/finish/failure/approval transitions). Extend the SSE route to also send new rows, with the row `seq` as the SSE `id:` so browsers resume via `Last-Event-ID`. Add a REST history endpoint with cursor.
- **Rationale**: Reuses the existing hook and 1 s polling cadence (meets ≤ 2 s); history survives reloads (FR-021); no new infrastructure.
- **Alternatives**: Redis pub/sub push (lower latency, but adds a second source of truth and loses history on restart); WebSockets (new transport for no gain); deriving the log from `jobs` rows only (too coarse: no sub-step lines like "scene 3/8").

## R2 — No technical leakage in log text

- **Decision**: Store `key` + `params` (numbers/short allow-listed strings) only; localize on read via `progressText`-style functions in `@makvid/pipeline` with an allow-list. Failure entries map internal error codes to a friendly key (`jobs.user_message_key` already exists); `error_detail` is never read by these endpoints.
- **Rationale**: Matches Constitution V and the existing messages design; locale can differ per viewer.
- **Alternatives**: Store rendered text (cannot re-localize; risk of freezing a leaky string).

## R3 — Idempotent writes under retries

- **Decision**: Unique key `(project_id, run_id, job_id, attempt, local_seq)`; insert with `ON CONFLICT DO NOTHING`. A retry gets a new `attempt` and adds a visible "retrying" entry rather than rewriting history.
- **Rationale**: Jobs are idempotent with retry (Constitution VIII); log must not duplicate.

## R4 — Content-type / aspect "popover select"

- **Decision**: Build with existing shadcn `Popover` + `Command` (list with hint text and check mark); no new dependency. Verified present in `components/ui`: `popover`, `command`, `dialog`, `toggle`. **Missing: `switch`** (needed for the auto / step-by-step toggle) — add via the shadcn CLI (MIT, Radix; run `pnpm license:check`). The log list uses a plain scroll container, so `scroll-area` is not required.
- **Rationale**: The 6 types need a name + hint each, which a plain native select cannot show; `command.tsx` and `dialog.tsx` are already in `src/components/ui`.
- **Alternatives**: Radix `Select` (no rich rows on trigger/mobile friendliness), keep card grid (contradicts the requested chat layout).

## R5 — Voice preview

- **Finding**: `VoicePicker.tsx` already plays `/api/voices/{id}/preview`, one at a time, with tier/gender/region filters.
- **Decision**: Wrap it in a `Dialog` (`VoiceDialog`) with a confirm/cancel; add an inline non-technical error for failed playback (currently silent `catch`). No new endpoint; verify preview does not touch quota (it is a read route).

## R6 — Single input for all content types

- **Decision**: One composer container; the inner control switches by type: `Textarea` (idea, script, auto-grow, per-type max 4000/12000 as today), URL `Input` (url, github), file chip + hidden file input via an attach button (table, media). Per-type values are held in component state so switching back restores them (FR-012).
- **Rationale**: Same POST bodies as `CreateForm`; no API change.

## R7 — Progress page placement

- **Decision**: `projects/[id]/page.tsx` renders `ProgressView` while status is not in `SETTLED`; when settled it renders the existing `EditorLayout`. Step-by-step approval reuses the existing review screens (`projects/[id]/review`) embedded or linked from the "needs approval" stage — no new approval API.
- **Verified**: `SETTLED` in `EditorLayout.tsx` = `ready`, `needs_attention`, `failed`. Approval waits are `awaiting_script_review` and `awaiting_storyboard_review` (project status enum, migration 0002); the actions are done on `projects/[id]/review` (`ScriptReview`, `StoryboardReview`, `POST /api/projects/[id]/review` with points `script_review` / `storyboard_review`). So there are exactly **two** approval points, mapped to stages `script` and `storyboard`.
- **Decision**: `ProgressView` stays visible for every non-`ready` status, including `failed` and `needs_attention`, so the failed stage's log and the retry action remain on screen (FR-024). Only `ready` hands over to `EditorLayout` (the page offers an "open editor" link from the failed/attention state when an editable version exists). At the two approval points `ProgressView` shows a "waiting for you" panel with a button to the existing review screen (no re-implementation of the review UI).
- **Worker hooks** (`packages/pipeline/src/worker.ts`, `StageHooks`): `onStageStart`, `onProgress` (via `onProgress` ctx hook), `onStageDone`, `onStageFailed(err)`. The log writer uses these; `onStageFailed` maps the error to a friendly `log.error.<code>` through `UserFacingError` and never stores the message.

## R8 — Large logs

- **Decision**: History endpoint returns pages of 200 (cursor = seq); UI keeps newest 1000 in DOM via simple windowing, older pages loaded on demand ("Load earlier").

## R9 — Testing approach

- Unit: length validation boundaries (29/30/180/181/NaN/decimal), per-type validation, i18n parity (existing test).
- Integration (`MAKVID_INFRA_TESTS=1`): event insert idempotency, RLS isolation across workspaces, history cursor, SSE resume.
- E2E (Playwright on `dev:mock`): compose → start → live log lines → reload keeps history → step-by-step pause; extend `no-tech-leak.spec.ts` and `a11y.spec.ts`; mobile 360 px viewport.
