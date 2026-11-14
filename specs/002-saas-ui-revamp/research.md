# Research: SaaS UI revamp (002)

**Date**: 2026-11-14 · **Spec**: [spec.md](spec.md)

Every version below was read from the npm registry on 2026-11-14 (`npm view <pkg> version license`). Docs were
read from source (shadcn docs MDX on GitHub, the tweakcn registry JSON, `node_modules` type definitions of the
installed next-intl / better-auth / next). Nothing below comes from memory alone.

## R1. Styling foundation: Tailwind CSS v4 + shadcn/ui

- **Decision**: Tailwind CSS `4.3.5` via `@tailwindcss/postcss` `4.3.5` (PostCSS plugin, `@import "tailwindcss"` in
  `globals.css`, no `tailwind.config.js`). shadcn CLI `4.23.0`, run as `pnpm dlx shadcn@4.23.0 init` from
  `apps/web` ("Existing Project" path of the shadcn Next.js guide), Radix base (`radix-ui` `1.8.1`), CSS variables,
  `tw-animate-css` `1.4.0`, `class-variance-authority` `0.7.1`, `clsx` `2.1.1`, `tailwind-merge` `3.7.0`,
  icons `lucide-react` `1.72.0`. Components land in `apps/web/src/components/ui/` (alias `@/components/ui`,
  the app already maps `@/*` → `./src/*`).
- **Rationale**: The shadcn guide for an existing Next.js app is "install Tailwind first, check the `@/*` alias,
  run `shadcn init`". Components are copied source (MIT), so they can be fitted to the theme and to accessibility
  fixes without a fork.
- **Alternatives considered**: shadcn `--monorepo` layout (components in `packages/ui`): rejected. `packages/ui` is
  a non-React package (errors, i18n helpers) used by workers, and only `apps/web` renders React. Base UI as the
  primitive base: rejected because the Sidebar/Command/Resizable blocks in the docs are written for Radix.

## R2. Theme "poppy-1" from tweakcn

- **Decision**: `pnpm dlx shadcn@4.23.0 add https://tweakcn.com/r/themes/cmlmbzwyz000004l72j9s6i76`. The registry
  item (fetched 2026-11-14) is `name: "poppy-1"`, `type: registry:style`, and holds `cssVars.theme`, `.light`,
  `.dark`. Its values match Appendix A of `docs/UI_PROMPT.md`, so Appendix A remains a valid manual fallback.
- **Contrast adjustments (token-only, to be measured in phase 1)**: light `--border: oklch(0 0 0)` (pure black)
  and dark `--input: oklch(1 0 0)` (pure white) make every card, table row and input outline harsh. Plan:
  keep the "poppy" outline look for primary surfaces but compute `--border`/`--input` so that (a) input borders
  reach ≥ 3:1 against `--background`/`--card` (WCAG 1.4.11 non-text contrast) and (b) dividers are softer than
  input outlines. All changes stay in `globals.css` and are listed in the phase-1 report with before/after
  ratios. Text pairs (`--muted-foreground` on `--muted`, `--primary-foreground` on `--primary`, etc.) are
  checked to ≥ 4.5:1 by a unit test that parses the tokens (oklch → sRGB → WCAG ratio).
- **Alternatives considered**: per-component overrides: rejected by the requirement (token-only changes).

## R3. Fonts and Vietnamese support

- **Decision**: load with `next/font/google` (self-hosted at build time, no runtime CDN) using subsets
  `["latin", "vietnamese"]`:
  - sans: **Plus Jakarta Sans**, subsets include `vietnamese`. Kept.
  - mono: **Space Mono**, subsets include `vietnamese`. Kept.
  - serif slot: **DM Sans has no `vietnamese` subset** (Next 16 font data lists only `latin`, `latin-ext`).
    Replaced by **Be Vietnam Pro** (geometric sans close to DM Sans, subsets `latin`, `latin-ext`, `vietnamese`).
- **Verification**: a Playwright check renders "Ẩ Ỹ Ự ặ ở Đ đ" in each family and asserts
  `document.fonts.check()` for each glyph run. A screenshot goes into the phase-1 report.
- **License**: all three are SIL OFL 1.1. They are not npm dependencies, so `THIRD_PARTY_LICENSES.md` gets three
  entries by hand.

## R4. Light/dark mode

- **Decision**: `next-themes` `0.4.6` (MIT), following the shadcn "Dark mode → Next.js" guide:
  `ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`, and
  `suppressHydrationWarning` on `<html>`. The toggle is a `DropdownMenu` with Sáng / Tối / Theo hệ thống.
  next-themes injects a blocking script that sets the class before first paint (no flash) and stores the choice
  in `localStorage["theme"]`.
- **Hydration**: the toggle renders its icon from CSS (`dark:` variants), not from `useTheme()` state, so server
  and client markup match. The selected menu item comes from `useTheme()` only after mount.

## R5. Language switching with next-intl 4.14.9 (existing)

- **Current state**: `defineRouting({ locales: ["vi","en"], defaultLocale: "vi", localePrefix: "as-needed" })`,
  middleware in `src/proxy.ts`. The middleware sets the `NEXT_LOCALE` cookie by default (`localeCookie` option,
  verified in `next-intl/dist/types/routing/config.d.ts`).
- **Decision**: `LocaleSwitcher` (client) uses `usePathname()` + `useRouter()` from `@/i18n/navigation`
  (`createNavigation(routing)`), and `useSearchParams()` to keep the query:
  `router.replace({ pathname, query }, { locale })`. `/en/projects/123?tab=chat` → `/projects/123?tab=chat`.
  When signed in, it also `PATCH`es `/api/me` with `{ locale }` (spec FR-010 rule 3).
- **Profile locale on sign-in (FR-010 rule 1)**: after a successful sign-in, the auth form reads `user.locale`
  from the session response and navigates with that locale instead of the current one.
- **Missing-key check**: `pnpm --filter @makvid/web test` gains `messages.test.ts`. It flattens `vi.json` and
  `en.json`, asserts identical key sets and identical ICU placeholders per key. No hard-coded UI strings are
  enforced with an ESLint rule (`no-restricted-syntax` on JSX text literals with letters, allowlisted for brand
  names `MakVid Studio`, `VI`, `EN`).
- **Formatting**: `useFormatter()` / `getFormatter()` of next-intl for dates, numbers and currency. Price: VND
  for `vi`, USD for `en`, from `plans.price_vnd` / `plans.price_usd`.

## R6. Forms

- **Decision**: shadcn `Form` pattern = `react-hook-form` `7.92.0` + `@hookform/resolvers` `7.0.6` + the zod
  `4.6.7` already in the app. Validation messages are i18n keys, never zod default text.

## R7. App shell components

- **Decision**: shadcn blocks/components: `sidebar` (collapsible="icon", state in cookie `sidebar_state`, read in
  the server layout so the first paint is right), `breadcrumb`, `command` (`cmdk` `1.1.1`) for Ctrl/Cmd+K,
  `sheet`, `dropdown-menu`, `avatar`, `badge`, `progress`, `tabs`, `table`, `dialog`, `alert-dialog`,
  `sonner` (`2.0.8`) toasts, `skeleton`, `tooltip`, `resizable` (`react-resizable-panels` `4.22.1`),
  `accordion`, `card`, `input`, `textarea`, `select`, `slider`, `radio-group`, `toggle-group`, `checkbox`,
  `switch`, `popover`, `calendar` (`react-day-picker` `10.0.2`, `date-fns` `4.4.0`) for the custom date range,
  `scroll-area`, `separator`, `label`, `form`.
- **Licenses**: all MIT / ISC / Apache-2.0 (`class-variance-authority`). These are production dependencies, and
  every one is classed "ok" by `scripts/license-check.mjs`.
- **Dev-only**: `@axe-core/playwright` `4.14.0` is MPL-2.0. The license gate only reports this as a warning for
  dev dependencies (never shipped). Recorded in the plan's constitution check.

## R8. Project management API (spec exception 2)

- **List**: extend `GET /api/projects` (session-authenticated, RLS via `withWorkspace`). Query params are parsed
  by zod. Filtering, sort and pagination run in SQL. Offset pagination with a total count (`count(*) over ()`)
  is enough for ≤ a few thousand projects per workspace (SC-013). The existing
  `projects_workspace_idx (workspace_id, updated_at DESC) WHERE deleted_at IS NULL` covers the default sort. A
  migration adds `(workspace_id, created_at DESC)` and a trigram index for search.
- **Search without diacritics**: migration `0007` enables `unaccent` and `pg_trgm` (both ship in
  `postgres:17.11-alpine` contrib) and adds an immutable wrapper `mkv_fold(text)` =
  `lower(unaccent('unaccent', text))`, plus `GIN (mkv_fold(title) gin_trgm_ops)`. The query uses
  `mkv_fold(title) LIKE '%' || mkv_fold($q) || '%'`. A test asserts that "đồng hồ" finds "Đồng Hồ" and
  "dong ho" (the default `unaccent` rules map Đ/đ → D/d; the test proves it).
- **Rename**: `PATCH /api/projects/[id]` `{ title }`, NFC, trimmed, 1–200 chars.
- **Delete (permanent, FR-060)**, in two steps:
  1. **Tombstone, synchronous, in the request**: inside one transaction, lock the rows, set `deleted_at = now()`,
     `run_id = NULL`, release `reserved` quota reservations (existing `settle(..., false)` path). From this
     moment the project is gone from every list, view and API (all reads already filter `deleted_at IS NULL`).
     Workers that pick up a job for it fail with `not_found` (the existing `ProjectError`), and the run's
     queued BullMQ jobs are removed by id where known.
  2. **Purge, asynchronous, on worker-ai's existing `maintenance` queue**: job `purge-project` deletes the
     object-store prefix `ws/<ws>/projects/<id>/`, the local work dir `workRoot/<ws>/<id>`, the source
     material row, then `DELETE FROM projects`. The DB cascades to versions, jobs, render outputs, QA reports and
     chat. `usage_records`, `batch_items` and `templates` are `SET NULL`. The job runs once immediately and is
     re-enqueued once with a 15-minute delay to catch files written by a step that was already running.
     Signed URLs already given out (≤ 15 min TTL) point to deleted objects, so they return 404.
- **Object store gap**: `ObjectStore` has no list/prefix delete. Add `deletePrefix(prefix)` to the interface,
  implemented with S3 `ListObjectsV2` + `DeleteObjects` (`@aws-sdk/client-s3`, already a dependency). It is
  covered by the existing infra test suite (`MAKVID_INFRA_TESTS=1`) against SeaweedFS.
- **Bulk / delete all**: `POST /api/projects/delete` with either `{ ids: uuid[] }` (≤ 100) or
  `{ filter: <same filter as list>, confirm: "<phrase>" }`. Filter deletes are chunked (100 per transaction)
  and return `{ deleted, failed }` (FR-059).
- **Permissions**: delete and rename need the existing `create` action (editor and above, matching the
  already-declared `"DELETE /api/projects/[id]": "create"` in `rbac.ts`). Viewers get 403.
- **Alternatives considered**: soft delete only (rejected by clarification Q2); deleting files synchronously in
  the request (rejected: slow for "delete all", and leaves orphans when a worker is mid-step).

## R9. Profile page (spec exception 1)

- **Better Auth 1.7.14** endpoints verified in `node_modules/better-auth/dist`: `/update-user`,
  `/change-password` (option `revokeOtherSessions`), `/list-accounts`. The client calls
  `authClient.updateUser({ name, image })` and `authClient.changePassword({ currentPassword, newPassword,
  revokeOtherSessions })`. The page uses `listAccounts()` to detect whether a `credential` account exists; if not,
  it shows the explanation instead of the form (FR-051).
- **Locale field**: declare `user.additionalFields.locale` (`string`, `input: true`, default `"vi"`) so
  `updateUser({ locale })` writes the existing `users.locale` column. No migration is needed.
- **Avatar**: the browser crops and scales the chosen image to 256×256 on a `<canvas>` and uploads WebP. Re-drawing
  drops EXIF data such as GPS. `POST /api/me/avatar` (multipart) re-validates by magic bytes (PNG/JPEG/WebP,
  ≤ 2 MB) with the existing `validateUpload(bytes, "image")`, rejects SVG, stores the bytes at
  `users/<userId>/avatar-<sha8>.<ext>`, and sets `users.image` to the internal path
  `/api/avatars/<userId>?v=<sha8>`. Server-side re-encoding with `sharp` was rejected: `sharp` bundles libvips
  (LGPL-3.0), which the license gate classes as "review", and the project has no allowlist entry for it. `GET /api/avatars/[userId]` redirects to a short-lived signed
  URL and is only served to users who share a workspace with that user. `DELETE /api/me/avatar` removes it.

## R10. Hero demo video (clarification Q5)

- **Decision**: produce two 12 s 9:16 clips (vi, en) with the existing CLI (`pnpm makvid produce`, real FPT TTS,
  cost ≈ a few hundred characters). Render them in the Linux render container (AGENTS.md). Transcode them to
  H.264 MP4 at ≤ 1.5 MB each (720×1280, CRF tuned) plus a WebP poster. Commit them to `apps/web/public/demo/`.
  The `<video>` uses `preload="none"`, `muted`, `playsInline`, `loop`, and starts with an `IntersectionObserver`
  after `requestIdleCallback`. It is not rendered under `prefers-reduced-motion: reduce` (poster only).
- **Gate**: the scripts (vi/en) go to the product owner before rendering, as part of the phase-2 report.

## R11. Notifications bell

- **Decision**: no new table. The bell queries `GET /api/projects?status=ready,needs_attention,failed&sort=updated
  &pageSize=10`. "Seen" is the timestamp of the newest item opened, kept in `localStorage["mkv_notif_seen"]`.
  Live updates: none in the list itself. The query is refreshed on window focus and every 60 s while visible.

## R12. Testing and evidence

- **Unit (vitest)**: list-query builder (filters → SQL), title validation, messages parity, token contrast,
  locale switch URL building.
- **Integration (`MAKVID_INFRA_TESTS=1`)**: list filters and pagination on 1 000 seeded projects (< 1 s, SC-013),
  cross-workspace isolation for list/rename/delete (0 leaks), purge removes rows and objects, tombstoned project
  rejected by worker step.
- **E2E (Playwright, existing `dev:mock` stack)**: existing specs keep passing. Keep every current
  `data-testid`; the specs use 56 `getByTestId` calls. Specs whose selectors depend on old markup (`.bubble.
  assistant`, `select`, `p.error[role=alert]`, `li`) are updated to roles/test ids in the same task as the page.
  New specs: shell navigation (keyboard), theme × locale switch keeps URL, project CRUD, profile, landing, 404.
- **Screenshots**: `e2e/screens.spec.ts` captures every main page × {light, dark} × {vi, en} × {1280, 360}
  into `docs/reports/ui/<phase>/` for each gate report (SC-011).
- **Accessibility**: `@axe-core/playwright` on the main pages, 0 serious/critical violations (SC-006).
- **Lighthouse**: `pnpm dlx lighthouse` against `next start` on `/` (desktop + mobile), JSON report in
  `docs/reports/ui/` (SC-010).
