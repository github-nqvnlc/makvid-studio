# ADR 0014 — Project activity log (spec 003)

- **Status**: Accepted (2026-11-16)
- **Context**: The create screen becomes a chat-like composer and production must show, live and in plain
  language, what the system is doing in every stage. The SSE stream only carried the latest progress sentence,
  so nothing survived a reload and no history could be shown.

## Decisions

1. **A table `project_events` (migration 0008)** holds one row per log line: stage, kind, severity, a message
   **key**, small numeric `params`, and the run (`run_id` = the version id of the production). No free text and
   no error message is stored; text is built on read from an allow-list (`PROGRESS_MESSAGES` + `LOG_MESSAGES`
   in `@makvid/pipeline`). A key outside the list is dropped at write time. This keeps Constitution V
   (no technical names reach the user) true by construction and lets each viewer read in their own language.
2. **Written from the existing stage hooks** (`dbSink` in `packages/pipeline/src/sink.ts`):
   `onStageStart`, context `onProgress`, `onStageDone`, `onStageFailed`, plus `approval_needed` when a review
   point is reached and `approved` from the review route. A failed write never fails a stage.
3. **Idempotent**: unique `(project_id, job_id, attempt, local_seq)` for job lines, and a partial unique index
   `(project_id, run_id, stage, kind, local_seq) WHERE job_id IS NULL` for job-less lines (fixed
   `local_seq`: approval_needed 1, approved 2, done 3). Inserts use `ON CONFLICT DO NOTHING`; a retry gets a
   new `attempt` and shows a "trying again" line instead of rewriting history.
4. **Transport**: the existing SSE route also sends `event: log` frames with `id: <seq>` and `event: stages`;
   the browser resumes by `Last-Event-ID` (or `?after=`), the client de-duplicates by `seq`. A REST endpoint
   `GET /api/projects/{id}/log` returns pages (newest first via `before`) so a reload restores history.
   Polling stays at 1 s (delivery well under the 2 s target) and polls never overlap.
5. **Shown stages** are the pipeline's real stages: script, style, storyboard (includes the internal preview
   step), audio, qa, render. Only two approval points exist (after style = script review, after preview =
   storyboard review).
6. **UI placement**: the progress panel is part of the project page (`EditorLayout`), visible for every status
   except `ready`, so a failed project keeps its log and the review screens stay right below it.

## Consequences

- One more tiny table per production line; rows cascade with the project (no extra retention policy).
- New log text means a new key in both languages; `events.test.ts` checks parity and that no text names a
  technology or provider.
