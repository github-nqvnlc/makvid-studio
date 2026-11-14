# Contract: internal web API changes (002)

Session-authenticated (Better Auth cookie). They are **not** part of the public `/api/v1` API, which is unchanged.
Every handler goes through `guarded("<METHOD path>")` with the permission from `src/server/rbac.ts` `ROUTES`.
Errors are `{ error: <code> }` using the existing codes in `src/lib/api-client.ts`, and they are never shown raw:
the UI maps each one to `errors.<code>`.

## Projects

### `GET /api/projects` (extended, permission `view`)

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string ≤ 200 | — | Accent- and case-insensitive substring of the title |
| `status` | csv of statuses or groups (`processing`, `review`, `ready`, `attention`, `failed`, `draft`) | all | Groups expand per [data-model.md §1](../data-model.md) |
| `aspect` | csv of `9:16`,`16:9`,`1:1`,`4:5` | all | Matches `primary_aspect` |
| `source` | csv of `prompt`,`script`,`url`,`github`,`table`,`media` | all | |
| `mode` | `auto` \| `review` | all | |
| `createdBy` | uuid | — | Must be a member of the workspace; otherwise empty result |
| `created` / `updated` | `today` \| `7d` \| `30d` \| `custom` | — | |
| `createdFrom`,`createdTo`,`updatedFrom`,`updatedTo` | ISO date | — | Used with `custom`; inclusive days in the user's time zone (`tz` param) |
| `tz` | IANA zone | `Asia/Ho_Chi_Minh` | For date boundaries |
| `sort` | `updated` \| `created` \| `title` | `updated` | |
| `dir` | `asc` \| `desc` | `desc` (`asc` for title) | |
| `page` | int ≥ 1 | 1 | |
| `pageSize` | int 1–100 | 24 | |

Response `200`:

```json
{
  "projects": [
    {
      "id": "uuid",
      "title": "string",
      "status": "rendering",
      "statusGroup": "processing",
      "aspect": "9:16",
      "mode": "auto",
      "source": "prompt",
      "createdBy": { "id": "uuid", "name": "string" },
      "createdAt": "ISO",
      "updatedAt": "ISO",
      "thumbnailUrl": "signed url | null",
      "progress": { "messageKey": "progress.render", "params": { "done": 4, "total": 9 }, "fraction": 0.44 }
    }
  ],
  "page": 1,
  "pageSize": 24,
  "total": 137
}
```

`progress` is the latest job row of the current run (`jobs.user_message_key`, `output.params`, `progress`), the same data the editor SSE uses. It is `null` when the project is not processing; the grid refreshes processing rows every 5 s while visible. `400 invalid` is returned for bad params, which are
never silently ignored. Old callers that sent no params get the same items in the same order as before (now
paginated, 24 per page). The existing e2e callers are checked.

### `PATCH /api/projects/[id]` (new, permission `create`)

Body `{ "title": string }`, NFC, trimmed, 1–200 chars. Returns `200 { id, title, updatedAt }` ·
`400 invalid` · `404 not_found` (also for tombstoned or other-workspace ids) · `403 forbidden`.

### `DELETE /api/projects/[id]` (new, permission `create`, route key already declared in `rbac.ts`)

Tombstones the project and enqueues the purge ([data-model.md §3](../data-model.md)). Returns `200 { deleted: 1 }` ·
`404 not_found` (already deleted: the UI says "this project was already deleted") · `403 forbidden`.

### `POST /api/projects/delete` (new, permission `create`)

Body is one of:

```json
{ "ids": ["uuid", "..."] }
{ "filter": { "...same keys as GET /api/projects list query except page/pageSize/sort..." }, "confirm": "XOA" }
```

- `ids`: 1–100 items.
- `filter`: deletes **every** project matching the filter in the caller's workspace, in chunks of 100 per
  transaction. `confirm` must be `"XOA"` (vi UI) or `"DELETE"` (en UI); both are accepted server-side.

Response `200 { "deleted": 38, "failed": 2 }`. `failed` counts ids that were not found or were already deleted.
Returns `400 invalid` · `403 forbidden`.

## Account

### `PATCH /api/me` (new, any signed-in user)

Body `{ "locale": "vi" | "en" }`. It writes `users.locale` through `auth().api.updateUser`. Returns `204`.

### Better Auth endpoints (existing library, now used by the UI)

- `authClient.updateUser({ name?, image?, locale? })` → `/api/auth/update-user`
- `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })` → `/api/auth/change-password`
- `authClient.listAccounts()` → `/api/auth/list-accounts` (does a `credential` account exist?)

Their errors are mapped by the UI. A wrong current password shows under the "current password" field.

### `POST /api/me/avatar` (new) / `DELETE /api/me/avatar` (new)

- `POST` multipart `file`: PNG/JPEG/WebP by magic bytes, ≤ 2 MB. It stores the file and sets `users.image`.
  Returns `200 { image }` · `400 file_type | file_too_large | file_empty`.
- `DELETE`: removes the object and sets `users.image = null`. Returns `204`.

### `GET /api/avatars/[userId]` (new)

Returns `302` to a 5-minute signed URL when the caller shares at least one workspace with `userId` (or is that
user). Otherwise it returns `404`. Response header `Cache-Control: private, max-age=300`.

## Workspaces

### `GET /api/workspace/list` (new, any signed-in user)

Returns `200 { workspaces: [{ id, name, role, current: boolean }] }`. This feeds the sidebar workspace switcher;
switching uses the existing `POST /api/workspace/switch`.

## RBAC additions (`ROUTES` in `src/server/rbac.ts`)

```text
"PATCH /api/projects/[id]": "create"
"POST /api/projects/delete": "create"
```

Account routes are per-user, not workspace actions, and they check only the session.
