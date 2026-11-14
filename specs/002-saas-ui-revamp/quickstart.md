# Quickstart: validating the SaaS UI revamp (002)

How to prove, at each phase gate, that the feature works. See [contracts/](contracts/) and
[data-model.md](data-model.md) for details. This guide only says what to run and what to expect.

## Prerequisites

```bash
pnpm install
docker compose -f docker/compose.dev.yml up -d
pnpm db:migrate
pnpm dev:mock
```

The last command starts web on http://localhost:3000 plus the workers with mock providers (no paid calls).

## Every phase (gate checks)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm license:check
pnpm --filter @makvid/web build
pnpm --filter @makvid/web test:e2e
```

`pnpm test` includes `messages.test.ts` (vi/en key parity) and the token contrast test. `pnpm lint` fails on
literal JSX text or color literals in components. `test:e2e` runs the existing specs plus the specs added in that
phase; every existing spec must stay green (SC-001).

Screenshots for the gate report:

```bash
pnpm --filter @makvid/web test:e2e e2e/screens.spec.ts
```

Expected: `docs/reports/ui/<phase>/<page>.<light|dark>.<vi|en>.<1280|360>.png` for every page of the phase.

## Phase 1: foundation

| Check | Expected |
| --- | --- |
| Open any existing page, switch Light → Dark → System | Colors change; reload keeps the choice; no white flash on hard reload in dark mode |
| Console during the above | No hydration warning |
| `/en/projects/<id>?x=1` → language menu → Tiếng Việt | URL becomes `/projects/<id>?x=1`; `NEXT_LOCALE=vi` cookie |
| Font check page/test | "Ẩ Ỹ Ự ặ ở Đ đ" render in sans, serif, mono without fallback glyphs |
| `pnpm test` | contrast test: every text pair ≥ 4.5:1, input border ≥ 3:1, both themes |

## Phase 2: public area and auth

| Check | Expected |
| --- | --- |
| Signed out, `/` at 1280 and 360 | All 9 landing sections; mobile menu in a sheet; hero poster then muted 9:16 demo |
| `prefers-reduced-motion: reduce` (DevTools) | Poster only, no autoplay |
| `/pricing`, toggle Yearly | Plans from DB; Free shows "Miễn phí"; Yearly shows "Sắp ra mắt" |
| `/does-not-exist` | Themed 404 in both locales |
| Sign up a new user, sign out, sign in | Works as before; field errors under fields; password eye toggle has a label |
| Without `GOOGLE_CLIENT_ID` | No Google button |
| Lighthouse on `/` | Performance, Accessibility, Best Practices ≥ 90 (report in `docs/reports/ui/`) |

```bash
pnpm --filter @makvid/web build
pnpm --filter @makvid/web start
pnpm dlx lighthouse http://localhost:3000/ --preset=desktop --output=json --output-path=docs/reports/ui/lighthouse-desktop.json
```

## Phase 3: app shell and main screens

| Check | Expected |
| --- | --- |
| Tab through the shell only with the keyboard | Skip link, sidebar items, topbar buttons reachable; visible focus ring |
| Collapse the sidebar, reload | Still collapsed (cookie `sidebar_state`) |
| Ctrl/Cmd+K, type "brand" | "Brand kit" page and matching projects; Enter opens |
| 360 px, any app page | Header row ≤ 64 px; no horizontal scroll |
| Create a 9:16 video (mock) | 4 sections + summary with quota; same POST body as before; progress shows in list and editor |
| Editor of a 9:16 ready project | Vertical player with poster; chat visible without scrolling at 1280; undo/redo in toolbar; download menu |
| Break the video URL (offline the store) | Error message + "Try again", no empty player |
| Free plan, `/workspace/api` | Form locked, upgrade card |
| Billing at 2/3 videos | 67 % bar; at > 80 % warning on page and in sidebar quota bar |
| Profile: rename, avatar, change password, sign in with new password | All work; Google-only account sees explanation instead of password form |

Project management (requires the infra tests for scale/isolation):

```bash
MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/web test
```

Expected: filter/pagination on 1 000 seeded projects < 1 s each; 0 cross-workspace reads/renames/deletes;
purge removes DB rows and every object under `ws/<ws>/projects/<id>/`; a worker step for a tombstoned project
stops with `not_found`.

Manual:

| Check | Expected |
| --- | --- |
| Filter "Failed" + "7 days" + 9:16, then reload | Same results; filters in the URL; total count shown |
| Search "dong ho" | Finds "Đồng hồ…" |
| Select 3 → Delete → confirm | "Đã xóa 3 dự án"; gone from list, palette, bell |
| Filter matching 40 → Delete all → type `XOA` | 40 deleted; others untouched |
| Delete a project while rendering | Steps stop; no file reappears after 15 min; reserved quota released |
| As viewer | No rename/delete/select controls; direct API call returns 403 |

## Phase 4: polish

| Check | Expected |
| --- | --- |
| `rg -n "className=\"(shell|topbar|card|btn|badge|stack)" apps/web/src` | No matches; old `globals.css` rules removed |
| axe on main pages (in e2e) | 0 serious/critical violations, both themes |
| Full screenshot set | 2 themes × 2 locales × desktop/mobile for every main page |
| Lighthouse | Report committed under `docs/reports/ui/` |
