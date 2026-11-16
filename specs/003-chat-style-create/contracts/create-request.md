# Contract: Create request (unchanged) and composer validation

## Server contract — unchanged

`POST /api/projects` keeps both existing shapes (see `apps/web/src/components/create/CreateForm.tsx` today):

- `kind = prompt` → JSON `{ prompt, aspect, durationSec, mode, voiceId, useBrand }`
- other kinds → `multipart/form-data` with `kind, aspect, durationSec, mode, voiceId, useBrand` plus `text` (script) | `url` (url, github) | `file` (+ `useSourceAudio` for media).

Success: `{ id }` → client navigates to `/projects/{id}` (the progress page). Failure: standard error key shown through `errors.*`.

The new composer MUST NOT change field names or enum values.

## Client validation rules (blocking, inline messages)

| Field | Rule |
| --- | --- |
| Length | integer 30–180 inclusive; empty, decimal, negative, NaN, <30, >180 → range message `create.durationHint` |
| Idea | trimmed length ≥ 3, ≤ 4000 |
| Script | trimmed length ≥ 10, ≤ 12000 |
| Article / GitHub | non-empty, parses as http(s) URL |
| Table | file `.csv` / `.json` |
| Audio/Video | file `audio/*` / `video/*` |
| Voice | a voice id must exist; empty list disables Start |
| Plan | Start disabled when the quota summary reports no videos left or length over plan max |

## Test hooks (kept for existing E2E)

`data-testid`: `source-<kind>`, `aspect-<ratio>`, `mode-auto|review`, `use-brand`, `create-error`, `voice-picker`; new: `composer`, `composer-input`, `type-trigger`, `aspect-trigger`, `length-input`, `voice-button`, `mode-toggle`, `start-video`, `progress-page`, `stage-<stage>`, `activity-log`, `log-entry`, `log-jump-latest`.
