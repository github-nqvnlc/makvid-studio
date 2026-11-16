# Data Model: Chat-style Video Creation and Live Progress

Only one new persistent entity; the rest is client state and existing tables.

## New: `project_events` (log entry)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigserial PK | global order; also exposed as `seq` for SSE/cursor |
| `workspace_id` | uuid NOT NULL → workspaces | RLS key (same policy pattern as `jobs`) |
| `project_id` | uuid NOT NULL → projects ON DELETE CASCADE | |
| `run_id` | uuid NULL | the production run (`projects.run_id`) the entry belongs to |
| `job_id` | uuid NULL → jobs ON DELETE SET NULL | source job when applicable |
| `attempt` | integer NOT NULL DEFAULT 0 | job attempt |
| `local_seq` | integer NOT NULL DEFAULT 0 | order within (job, attempt) for idempotency |
| `stage` | text NOT NULL | one of: `ingest, script, style, storyboard, preview, voice, mix, qa, render, mux, done` (maps to `pipeline_step` / stage list) |
| `kind` | text NOT NULL | `stage_start, progress, stage_done, approval_needed, approved, warning, error, retry, done` |
| `severity` | text NOT NULL DEFAULT `info` | `info, warning, error` |
| `key` | text NOT NULL | message key from `@makvid/pipeline` messages (allow-listed) |
| `params` | jsonb NOT NULL DEFAULT `{}` | numbers / short enums only (e.g. `{current:3,total:8}`) |
| `fraction` | real NULL | overall 0..1 when known |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Constraints/indexes:

- `UNIQUE (project_id, job_id, attempt, local_seq)` → idempotent inserts (`ON CONFLICT DO NOTHING`). Entries without a job use `job_id NULL`; Postgres treats NULLs as distinct, so non-job entries (approval, done) are guarded by a partial unique index on `(project_id, run_id, stage, kind, local_seq) WHERE job_id IS NULL`. Their `local_seq` is fixed per kind: `approval_needed = 1`, `approved = 2`, `done = 3` (one of each per stage per run, so the two review points `script` and `storyboard` do not collide because `stage` is part of the index). A re-run of the project gets a new `run_id`, so it starts clean.
- `INDEX (project_id, id)` for cursor paging.
- RLS: `workspace_id = current_setting('app.workspace_id')::uuid` as in migration 0002/0006; covered by the RLS test migration list (add `0008`).
- Validation: `key` must exist in the messages allow-list at write time (writer throws in dev/test, drops + counts in prod); `params` values restricted to number | short string.

Retention: follows the project; removed by cascade (no separate policy).

## Derived view model (not stored): stage state

For each stage in the fixed order: `state ∈ waiting | running | needs_approval | done | failed`, computed from the latest event of that stage in the current run (`stage_start` → running, `approval_needed` without `approved` → needs_approval, `stage_done` → done, `error` without later `retry`/`stage_done` → failed) combined with `projects.status`.

## Existing entities reused (unchanged)

- **Video request** → `projects` + `source_materials` created by `POST /api/projects` (mode `auto|review`, `primary_aspect`, duration, voice, brand flag).
- **Voice** → `VoiceOption` from `@/server/catalog` (`id, name, tier, gender, region, isDefault`), preview via `/api/voices/{id}/preview`.
- **Plan allowance** → quota response already consumed by `CreateSummary`.

## State transitions (stage)

```text
waiting → running → done
              ├→ needs_approval → (approve) → running|done      [review mode only]
              └→ failed → (retry) → running
```

## Client-only state (composer)

`kind`, per-type values `{prompt, script, link, file}`, `useSourceAudio`, `useBrand`, `aspect`, `durationSec` (string while editing, validated integer 30–180), `mode`, `voiceId`, `busy`, `error`. Not persisted (a draft in `sessionStorage` is out of scope).
