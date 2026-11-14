# UI-G3 — App shell, projects, create wizard, editor, billing, profile

Date: 2026-11-14. Spec: [specs/002-saas-ui-revamp](../../specs/002-saas-ui-revamp/). Status: **ready for owner review**, with
the "Not done" list below. Screenshots: [docs/reports/ui/ui-g3/](ui/ui-g3/) (home, create, billing, profile, API,
batches), as a representative WebP set (see [docs/reports/ui/README.md](ui/README.md)).

## What is in

**App shell.** Sidebar (groups Create / Workspace / Account / Admin, active item by longest route prefix, collapses to
icons and remembers it in a cookie, quota meter with a warning from 80 %, workspace switcher, user menu), topbar (path,
search ⌘/Ctrl+K, "New video", notification bell, language and theme), command palette (pages by role, projects
via the API, actions). `GET /api/workspace/list` feeds the switcher. At 360 px the topbar is one row.

**Project management (API to UI).**
- `GET /api/projects` now filters by text (accent- and case-insensitive: "dong ho" finds "Đồng Hồ"), status group, aspect,
  source, mode, creator, created/updated presets or custom day ranges (time zone aware), sort and pagination. Bad input
  returns `400 invalid`, never silently ignored.
- `PATCH /api/projects/[id]` renames. `DELETE /api/projects/[id]` and `POST /api/projects/delete` delete **permanently**:
  one, up to 100 selected, or everything matching a filter (typed `XOA`/`DELETE`).
- Deletion is two-step: the project disappears at once and its production stops and its reserved quota is released;
  a background job then removes every stored file, the work folder and the database rows (one retry after 15 min).
- Migration `0007` adds the accent-folding function and indexes. `ObjectStore.deletePrefix` was added.
- UI: stats strip, search, filters kept in the URL (survive reload), sort, grid/table, selection with "select all
  N matching", rename dialog, delete dialogs saying "cannot be undone", partial-failure message, empty/no-result/error
  states, 5-second refresh while something is processing.

**Create wizard.** Four titled sections (content, format and length, voice, mode) plus a sticky summary that reads the
quota and disables submit with a reason and an upgrade link. Aspect cards draw the real frame shape. Duration slider and
number box stay in sync. Voice picker has tabs per tier with a hint, gender and region filters, and one preview
playing at a time. The request body is unchanged.

**Editor.** Toolbar (inline rename, status, undo, redo, duplicate), three resizable panes (scenes + versions | preview +
downloads | chat) and tabs on a phone, a player in a frame with the project's real shape (vertical stays vertical),
loading state and a visible error with "Try again", chat that stays visible and scrolls inside its pane.

**Billing and locks.** Usage bars per metric with a warning at 80 % (on the page and in the sidebar), plan cards with a
"current plan" badge, API and batch pages show an upgrade card when the plan lacks them.

**Profile (`/account`).** Name, avatar (cropped to 256 px in the browser, PNG/JPEG/WebP by magic bytes, never SVG,
≤ 2 MB, served by a 5-minute signed redirect only to the user or a workspace member), change password (wrong current
password shown under its field, "sign out other devices" option, hidden for Google-only accounts), theme and language.

## Found and fixed on the way

- Legacy CSS beat Tailwind utilities (unlayered CSS wins over layered). It now sits in its own cascade layer below
  utilities, so new components render correctly inside the old pages.
- Single-expression `useEffect` callbacks crashed the editor page in the browser; all were turned into block bodies.
- A Redis 6.0.16 process on this machine hid the Docker Valkey 7.2 on `localhost:6379` and made job queues
  stall; this was the cause of the earlier flaky `m5` run. Tests now run with `VALKEY_URL` pointing at Docker.

## Checks

| Check | Result |
| --- | --- |
| typecheck / lint | pass |
| Unit tests | 99 passed (new: project query parsing, avatar validation; RBAC route table updated) |
| Infra tests (`MAKVID_INFRA_TESTS=1`) | new project CRUD test on real Postgres: accent search, filters and a deep page each under 1 s on 1 000 projects, no cross-workspace list/rename/delete, tombstone then purge; storage `deletePrefix` over 1 005 objects |
| E2E new | `projects-crud`, `account`, `landing`, `theme-locale`, `fonts` |
| E2E existing | see the result at the end of this file |

## Not done (deferred to UI-G4 or later)

- Brand kit, asset library, members, admin and batch progress pages are still the old look inside the new shell
  (they work; only restyling is left): tasks T064 (restyle of BatchProgress), T066, T067, T068.
- Editor: no separate "download" dropdown or history side sheet (downloads and versions are cards in the panes);
  pane sizes are not remembered between visits.
- E2E for a broken video URL, 360 px editor tabs and a deleted project (T062); billing 67 % bar check (T065); a viewer-role
  e2e for the project list (the rule is covered by the RBAC unit test and the cross-workspace infra test).
- Lighthouse and axe runs (UI-G4).

## E2E result of this gate

Full run (16 tests) and reruns on a clean stack:

| Spec | Result |
| --- | --- |
| `account`, `projects-crud`, `landing` (5), `theme-locale` (3), `fonts` | pass |
| `brand`, `create-and-edit`, `no-tech-leak`, `sources` | pass (the last one only after restarting the stack: it failed once while the machine was overloaded) |
| `m5` (plan upgrade, template, batch + ZIP, roles, admin) | **fails**: the batch of 3 videos ends as "Done with failed rows" (one row failed at the quality-check step), or the ZIP link does not appear |

About `m5`: it passed earlier in this session (3.0 min) before the UI-G2 changes. I did not change any batch, ZIP, quality
check or worker code, and it was the slowest, most parallel test, so it is the first to break when the machine is
overloaded. It is **not proven** to be only the environment: please rerun it on a quiet machine
(`pnpm --filter @makvid/web test:e2e m5`, with `MAKVID_PAYMENTS=mock`, `APP_URL` set to the test port).

Environment findings that explain the flaky runs (worth fixing on this machine):

- `wslrelay.exe` listens on `[::1]` for ports 5432, 6379 and 8333 (and on 127.0.0.1:6379) and forwards them to something
  in WSL; Node tries `localhost` as IPv6 first, so database, queue and storage calls randomly went there (timeouts,
  `ECONNRESET`, Redis 6.0.16). Using `127.0.0.1` for Postgres and the object store, and the machine's LAN address for
  Valkey, made the pipeline specs pass.
- After a long run, leftover headless Chrome processes slow everything down; restarting the stack fixes it.
