# Data Model: SaaS UI revamp (002)

The feature adds **no new tables**. It adds one migration (indexes and extensions), one storage capability, and
declares an existing user column to the auth library. Everything else is client-side preference state.

## 1. Server data (existing tables, new use)

### projects (existing)

| Field | Use in this feature |
| --- | --- |
| `id`, `workspace_id` | Identity. Every query runs inside `withWorkspace` (RLS), so isolation is enforced by the database |
| `title` | Shown, searched (accent-insensitive), renamed. Rule: NFC, trimmed, 1–200 chars |
| `status` (14 values) | Filter. UI groups: **processing** = ingesting, scripting, styling, storyboarding, producing_audio, compiling, qa, rendering · **review** = awaiting_script_review, awaiting_storyboard_review · **ready** · **attention** = needs_attention · **failed** · **draft** |
| `primary_aspect`, `export_aspects` | Filter (aspect), thumbnail frame ratio, download menu |
| `mode` | Filter (auto / review) |
| `created_by` | Filter "creator" (members of the workspace) |
| `source_material_id` → `source_materials.kind` | Filter "source" (prompt, script, url, github, table, media) |
| `created_at`, `updated_at` | Date-range filters and sorting |
| `deleted_at` | **Tombstone**: set at delete time; the row is removed by the purge job (see §3). All reads already filter `deleted_at IS NULL` |
| `run_id` | Set to `NULL` at tombstone so no running step can claim the project |

Thumbnail for the grid: the head version's newest `render_outputs.thumbnail_key` for `primary_aspect`, signed
URL. It is `null` when nothing has been rendered yet, and the UI then shows a ratio-correct placeholder.

### users (existing)

| Field | Use |
| --- | --- |
| `name` | Profile: edit (1–80 chars, NFC) |
| `email` | Profile: read-only |
| `image` | Avatar URL `/api/avatars/<userId>?v=<sha8>` or `null` (initials shown) |
| `locale` | `"vi"` / `"en"`, declared as a Better Auth `additionalFields` entry; written by every locale switch while signed in, read at sign-in |

`auth_accounts.provider_id = 'credential'` tells whether the user has a password (password form shown or not).

### plans / usage (existing, read-only)

Used by the stats strip, the sidebar quota bar, billing progress bars, the create-form summary, pricing.
`limits.<x> = null` means unlimited. Price per locale: `price_vnd` (vi) / `price_usd` (en). Only `interval =
'month'` exists, so "Yearly" shows "Coming soon".

### Voices (existing catalog, read-only)

`id`, tier (`standard | pro | ultra`, from id prefix), `gender`, `region` (`north | central | south | null`),
preview clip. These feed the voice picker filters.

## 2. Migration `0007_project_search.sql`

```text
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
mkv_fold(text) → text   IMMUTABLE wrapper: lower(unaccent('unaccent', $1))
INDEX projects_title_fold_trgm  GIN (mkv_fold(title) gin_trgm_ops) WHERE deleted_at IS NULL
INDEX projects_workspace_created_idx (workspace_id, created_at DESC) WHERE deleted_at IS NULL
```

No column changes. `pnpm db:migrate` applies it and it is idempotent.

## 3. Project deletion lifecycle

```text
 live ──DELETE / bulk delete──▶ tombstoned ──purge-project job──▶ gone
        (request, 1 tx)          deleted_at=now, run_id=NULL        rows + objects + work dir removed
                                 reserved quota released             (job re-runs once after 15 min)
```

| Step | What happens | Where |
| --- | --- | --- |
| Tombstone | Lock rows `FOR UPDATE`; set `deleted_at`, `run_id = NULL`; `settle(reservation, false)` for every `reserved` reservation of the project; remove known queued BullMQ jobs of the run | web request (`packages/pipeline` service function) |
| Purge | `store.deletePrefix("ws/<ws>/projects/<id>/")`; `rm -rf workRoot/<ws>/<id>`; `DELETE FROM projects WHERE id = $1 AND deleted_at IS NOT NULL` (cascade: project_versions, jobs, render_outputs, qa_reports, chat_messages); then delete the orphan `source_materials` row | worker-ai `maintenance` queue |
| Kept on purpose | `usage_records` (billing/cost ledger, `SET NULL`), `templates` and `batch_items` (`SET NULL`, UI shows "Deleted project"), shared `render_cache` (content-addressed, shared across projects) | — |

Invariants: a tombstoned project is never listed, viewed, edited, downloaded or resumed. The purge is idempotent.
Delete across workspaces is impossible because RLS scopes the `UPDATE`, and a test proves it.

## 4. Storage

`ObjectStore.deletePrefix(prefix: string): Promise<number>` is new. It is implemented with S3 `ListObjectsV2` +
`DeleteObjects` in batches of 1 000, and `assertKey(prefix)` must pass. Avatar objects live at
`users/<userId>/avatar-<sha8>.<ext>`.

## 5. Client-side preference state

| Key | Where | Values | Owner |
| --- | --- | --- | --- |
| `theme` | localStorage | `light` / `dark` / `system` | next-themes |
| `NEXT_LOCALE` | cookie | `vi` / `en` | next-intl middleware |
| `sidebar_state` | cookie (read by server layout) | `true` / `false` | shadcn Sidebar |
| `mkv_projects_view` | localStorage | `grid` / `table` | projects page |
| `mkv_notif_seen` | localStorage | ISO timestamp | notification bell |
| `mkv_editor_layout` | localStorage | panel sizes | editor (react-resizable-panels `autoSaveId`) |

Every read is wrapped so that blocked storage (private mode) falls back to defaults for the session.

## 6. Validation rules (from spec)

| Rule | Source |
| --- | --- |
| Project title: NFC, trimmed, 1–200 chars | FR-054 |
| List `pageSize` 1–100, default 24; `page` ≥ 1 | FR-053 |
| Bulk delete by ids: 1–100 ids, all UUIDs | FR-055 |
| Delete all by filter: `confirm` must equal the localized phrase sent by the UI (`XOA` / `DELETE`) | FR-055 |
| Avatar: PNG/JPEG/WebP by magic bytes, ≤ 2 MB, not SVG | FR-050 |
| Password: ≥ 8 chars (existing `minPasswordLength`), confirmation equal | FR-050 |
| Display name: 1–80 chars, NFC | FR-050 |
| Brand colour: `#RRGGBB` | FR-041 |
