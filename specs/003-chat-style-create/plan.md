# Implementation Plan: Chat-style Video Creation and Live Progress

**Branch**: `003-chat-style-create` (work currently on `fix/projects-breadcrumbs-ui`; create the feature branch before implementing) | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-chat-style-create/spec.md`

## Summary

Replace the multi-card create form with one chat-style composer (single input, popover selectors for content type and aspect ratio, a seconds field validated 30–180, a voice button that opens a dialog with audible preview, an auto / step-by-step toggle, a live summary and a "Bắt đầu tạo video" button). After submit, the user lands on a progress page that shows production stages and a **persisted, live, user-friendly activity log** per stage.

Technical approach (details in [research.md](research.md)):

- **Frontend only for the composer**: reuse the existing `POST /api/projects` contract, quota check (`CreateSummary`), `VoicePicker` preview endpoint and shared UI kit (Popover/Command/Dialog/Switch). No change to the request body.
- **New backend piece for the log**: a `project_events` table written from the existing worker progress hook (`onProgress`), a read API (history, cursor-based) and an extended SSE stream that pushes new entries. Entry text is stored as a message **key + params** and localized on read through the existing `@makvid/pipeline` messages, so no technical name can leak.
- **Progress page**: a new `ProgressView` shown by the project page while the project is not yet settled; settled projects keep the current editor.

## Technical Context

**Language/Version**: TypeScript strict, ESM, Node ≥ 22.12, pnpm 12

**Primary Dependencies**: Next.js 16 (App Router), next-intl, Tailwind v4, shadcn/ui (Popover, Command, Dialog already present; Switch to be added via shadcn CLI), Drizzle ORM, BullMQ, Better Auth

**Storage**: PostgreSQL (new table + migration `0008`, RLS like other workspace tables); no new object storage

**Testing**: Vitest (unit: validation, log mapping, i18n parity), `MAKVID_INFRA_TESTS=1` integration (event persistence + RLS), Playwright E2E against `pnpm dev:mock`, existing `no-tech-leak.spec.ts` extended to the log, `a11y.spec.ts` extended

**Target Platform**: Web, desktop and mobile ≥ 360 px; Windows + Linux dev

**Project Type**: Web application (monorepo: `apps/web` + `packages/*` + `apps/worker-*`)

**Performance Goals**: Log line visible ≤ 2 s after emission (SC-005); 5k-line log stays responsive (windowed/paged list); voice preview audio starts ≤ 2 s

**Constraints**: User-facing text never names engines/providers (Constitution V); workspace isolation incl. log (VII); step jobs stay idempotent — log writes must be idempotent per (job attempt, sequence) so retries do not duplicate; all strings in `vi.json` + `en.json`; theme tokens only

**Scale/Scope**: 2 screens (create, progress), ~12 new components, 1 table, 2 endpoints (1 new, 1 extended), ~40 new i18n keys

## Constitution Check

_GATE: passed before research; re-checked after design._

| Principle | Status | Notes |
| --- | --- | --- |
| I. Plan + milestone gates | PASS | Plan awaits owner approval before code; this is a UI-revamp feature like 002, reported at its own gate. |
| II. Done = really ran | PASS | Quickstart defines mock-pipeline run + E2E; tasks must include tests per story. |
| III. VideoSpec / determinism | PASS | Log is side-channel metadata; does not touch spec, renderer or scene code. |
| IV. Vietnamese + quality | PASS | All strings vi/en; diacritics test in log and selectors. |
| V. No technical info to users | PASS (key risk) | Log stores only message keys + numeric params; localization via allow-listed messages; raw job errors never stored in user-visible columns; no-tech-leak E2E covers log. |
| VI. Clean licenses | PASS | No new dependency expected; if a shadcn primitive needs a Radix package, `pnpm license:check` gates it. |
| VII. Isolation / security | PASS | `project_events` has `workspace_id` + RLS identical to `jobs`; endpoints use `guarded` + `projectId`. |
| VIII. Provider abstraction + cost | PASS | Voice preview keeps using the existing preview route; no provider call from UI. |

No violations → Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-chat-style-create/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── project-events.md      # history + SSE contract
│   └── create-request.md      # unchanged POST contract + client-side validation rules
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
apps/web/
├── messages/{vi,en}.json                          # new keys: create.composer.*, progress.*
├── src/components/create/
│   ├── CreateComposer.tsx        # replaces CreateForm (same POST body, same data-testids kept where possible)
│   ├── ContentTypeSelect.tsx     # popover list of 6 types
│   ├── AspectSelect.tsx          # popover list of 4 ratios (reuses ASPECTS)
│   ├── LengthInput.tsx           # number input 30–180 + inline error (replaces DurationField)
│   ├── VoiceDialog.tsx           # Dialog wrapping existing VoicePicker (preview already built)
│   ├── ModeToggle.tsx            # Switch auto / review
│   └── CreateSummary.tsx         # extended: content preview, brand, Start button label
├── src/components/progress/
│   ├── ProgressView.tsx          # stage list + log + approval slot + result
│   ├── StageList.tsx
│   ├── ActivityLog.tsx           # follow/pause, filter by stage, jump-to-latest, aria-live
│   └── useProjectEvents.ts       # history fetch + SSE with Last-Event-ID resume, de-dup by seq
├── src/app/[locale]/(app)/projects/[id]/page.tsx  # render ProgressView until settled, else EditorLayout
├── src/app/api/projects/[id]/events/route.ts      # extended: emits log entries (id = seq)
└── src/app/api/projects/[id]/log/route.ts         # NEW: GET history (cursor)
packages/db/
├── migrations/0008_project_events.sql
└── src/schema/…                                   # project_events table
packages/pipeline/
├── src/events.ts                                  # recordEvent(), key allow-list, localize()
├── src/messages.ts                                # new log keys (vi/en)
└── src/worker.ts                                  # onProgress → recordEvent (idempotent)
```

**Structure Decision**: Keep the existing monorepo layout. UI lives in `apps/web/src/components/{create,progress}` (matching the 002 convention of shared pieces per area); persistence and localization of log entries live in `packages/pipeline` next to the progress messages they extend; the schema lives in `packages/db`.

## Complexity Tracking

_No constitution violations._
