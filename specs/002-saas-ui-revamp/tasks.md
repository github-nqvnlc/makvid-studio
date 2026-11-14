# Tasks: Nâng cấp giao diện MakVid Studio thành web SaaS hoàn chỉnh

**Input**: Design documents from `specs/002-saas-ui-revamp/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Required by the constitution (Principle II). Each phase has its test tasks, and every existing `data-testid` and e2e spec must keep passing.

**Organization**: Grouped by user story. Phases follow the gates of plan.md: UI-G1 = Phases 1–3, UI-G2 = Phase 4, UI-G3 = Phases 5–11, UI-G4 = Phase 12. 🛑 marks a gate: write `docs/reports/UI-G<n>.md` (what was done, how to run, test results, screenshots 2 themes × 2 locales × desktop/mobile, open decisions), then stop for approval.

## Format: `- [ ] T### [P?] [US?] Description with path`

All paths are relative to the repo root. `W` = `apps/web`.

## Phase 1: Setup (UI-G1)

- [X] T001 Run the ui-consistency "finding-patterns" step: turn `contracts/ui-conventions.md` and `contracts/ui-routes.md` into one checklist per page, saved in `specs/002-saas-ui-revamp/checklists/pages.md`
- [X] T002 Add Tailwind: `pnpm --filter @makvid/web add tailwindcss@4.3.5 @tailwindcss/postcss@4.3.5`, create `W/postcss.config.mjs`, add `@import "tailwindcss"` in `W/src/app/globals.css` next to the old rules (old CSS stays until Phase 12)
- [X] T003 Run `pnpm dlx shadcn@4.23.0 init` in `W` (Radix base, CSS variables, alias `@/components/ui`, `@/lib/utils`), producing `W/components.json`, `W/src/lib/utils.ts`; add `class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 tw-animate-css@1.4.0 lucide-react@1.72.0 radix-ui@1.8.1`
- [X] T004 Install theme: `pnpm dlx shadcn@4.23.0 add https://tweakcn.com/r/themes/cmlmbzwyz000004l72j9s6i76`; if it fails paste Appendix A of `docs/UI_PROMPT.md` into `W/src/app/globals.css`
- [X] T005 Add the remaining dependencies pinned as in plan.md: next-themes@0.4.6 sonner@2.0.8 cmdk@1.1.1 react-resizable-panels@4.22.1 react-hook-form@7.92.0 @hookform/resolvers@7.0.6 react-day-picker@10.0.2 date-fns@4.4.0, dev: @axe-core/playwright@4.14.0; then run `pnpm license:check` and record results
- [X] T006 Add shadcn components in one batch from `W`: button card input textarea label select slider radio-group toggle-group checkbox switch popover calendar dialog alert-dialog sheet dropdown-menu tabs table badge avatar progress skeleton tooltip separator scroll-area accordion form breadcrumb command sidebar resizable sonner
- [X] T007 [P] Append the three OFL fonts and new dependencies to `THIRD_PARTY_LICENSES.md`

## Phase 2: Foundational (UI-G1, blocks all stories)

- [X] T008 Load fonts with `next/font/google`, subsets `latin` + `vietnamese`: Plus Jakarta Sans (sans), Space Mono (mono), Be Vietnam Pro (serif slot, replaces DM Sans which has no Vietnamese subset); wire the CSS variables in `W/src/app/[locale]/layout.tsx` and `W/src/app/globals.css`
- [X] T009 Adjust tokens in `W/src/app/globals.css` only: soften light `--border` (pure black) and dark `--input` (pure white) so input borders are ≥ 3:1 and text pairs ≥ 4.5:1 in both themes; keep a comment with before/after values
- [X] T010 [P] Test `W/test/tokens-contrast.test.ts`: parse `globals.css` oklch tokens, convert to sRGB, assert WCAG ratios for every text/background pair and input border, light and dark
- [X] T011 [P] Test `W/test/messages.test.ts`: flatten `W/messages/vi.json` and `en.json`, assert identical key sets and identical ICU placeholders per key
- [X] T012 [P] ESLint rules in `W/eslint.config.mjs`: forbid color literals in `className`/`style` and literal letter text in JSX (allow `MakVid Studio`, `VI`, `EN`)
- [X] T013 [P] Create `W/src/components/common/{PageHeader,EmptyState,ErrorState,UpgradeCard,StatusBadge,UsageMeter}.tsx` per `contracts/ui-conventions.md`
- [X] T014 [P] Create `W/src/components/common/{ColorField,FileDropzone}.tsx` (swatch + hex validated `#RRGGBB`; drag-and-drop with file type/size errors)
- [X] T015 [P] Create `W/src/lib/prefs.ts` (safe localStorage/cookie wrapper with try/catch and defaults) and `W/src/lib/project-query.ts` (filter/sort/page types shared by UI and API)
- [X] T016 Add the `Toaster` (sonner) and skip link to the root locale layout `W/src/app/[locale]/layout.tsx`
- [X] T017 Add keys for new namespaces `common`, `shell`, `landing`, `pricing`, `account`, `projectsList` (vi + en) in `W/messages/*.json` as each task below needs them, keeping T011 green

## Phase 3: User Story 2 — Theme and language switching (P1, UI-G1)

**Goal**: Sáng/Tối/Theo hệ thống and VI/EN anywhere, remembered, page and query preserved.
**Independent test**: on every existing page switch theme and language, reload; no flash, no hydration warning, URL and query kept.

- [X] T018 [P] [US2] Create `W/src/components/common/ThemeProvider.tsx` and `ThemeToggle.tsx` (next-themes `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`, dropdown with 3 items, icon swapped by CSS `dark:` variants); add `suppressHydrationWarning` to `<html>`
- [X] T019 [P] [US2] Create `W/src/components/common/LocaleSwitcher.tsx`: globe icon + `VI`/`EN`, items "Tiếng Việt"/"English", `router.replace({pathname, query}, {locale})` from `@/i18n/navigation`, and `PATCH /api/me {locale}` when signed in
- [X] T020 [US2] Add `PATCH /api/me` in `W/src/app/api/me/route.ts` (body `{ locale: "vi"|"en" }` → `auth().api.updateUser`, 204) and declare `user.additionalFields.locale` in `W/src/server/auth.ts`
- [X] T021 [US2] Put ThemeToggle and LocaleSwitcher in the current layout, replacing the text language link in `W/src/app/[locale]/layout.tsx`
- [X] T022 [US2] After sign-in navigate to the profile locale (FR-010 rule 1) in `W/src/components/AuthForm.tsx`
- [X] T023 [P] [US2] E2E `W/e2e/theme-locale.spec.ts`: `/en/projects/x?a=1` → Tiếng Việt gives `/projects/x?a=1`; theme persists across reload; no console hydration warning; first paint dark when OS dark
- [X] T024 [P] [US2] Test font glyphs "Ẩ Ỹ Ự ặ ở Đ đ" for the three families in `W/e2e/fonts.spec.ts`
- [X] T025 [US2] Screenshot spec `W/e2e/screens.spec.ts` (every page × light/dark × vi/en × 1280/360 → `docs/reports/ui/<phase>/`)
- [X] T026 🛑 [US2] Write `docs/reports/UI-G1.md` with screenshots, contrast numbers and font decision; run typecheck, lint, test, license:check, build, e2e; add dated entry to `docs/PROGRESS.md`

## Phase 4: User Story 7 — Public area and auth (P2, UI-G2)

**Goal**: guest landing, pricing, 404/error, split-screen sign-in/up.
**Independent test**: signed out at 360 and 1280 walk every landing block, open pricing, sign up, sign out, sign in.

- [X] T027 [US7] Restructure into route groups `W/src/app/[locale]/(marketing)`, `(auth)`, `(app)` with layouts; move pages without changing URLs (see `contracts/ui-routes.md`)
- [X] T028 [P] [US7] `W/src/components/marketing/{PublicHeader,MobileMenu,Footer}.tsx` (sticky header, Sheet menu, footer columns, "Sắp ra mắt" badges for missing legal/social pages)
- [X] T029 [P] [US7] `W/src/components/marketing/{Hero,HowItWorks,StyleGallery,Features,UseCases,Faq,FinalCta}.tsx`; style gallery reads real styles with thumbnails from `W/src/app/api/styles/[id]/thumbnail/route.ts`
- [X] T030 [P] [US7] `W/src/components/marketing/PricingTable.tsx` (plans from DB, VND for vi / USD for en, "Miễn phí", Monthly/Yearly toggle with Yearly = "Sắp ra mắt") and `W/src/app/[locale]/(marketing)/pricing/page.tsx`
- [X] T031 [US7] Landing for guests in `W/src/app/[locale]/page.tsx` (signed-in users keep the projects list)
- [X] T032 [P] [US7] Rewrite `W/src/components/AuthForm.tsx` with shadcn Form + react-hook-form + zod, split layout, password eye toggle with aria-label, pending state, field errors, Google button only if configured, cross-links
- [X] T033 [P] [US7] `W/src/app/[locale]/not-found.tsx` and `error.tsx` themed, both locales, with home/retry actions
- [ ] T034 [US7] Hero demo: write vi and en scripts (≈12 s, 9:16) in `docs/reports/assets/hero-scripts.md` and **stop for owner approval before rendering**; then render with `pnpm makvid produce` in the render container, transcode to ≤ 1.5 MB MP4 + WebP poster in `W/public/demo/`; lazy load, `preload="none"`, poster only under reduced motion — **scripts written; render pending**
- [X] T035 [P] [US7] E2E `W/e2e/landing.spec.ts` (blocks present, mobile sheet, 404, sign-up → sign-out → sign-in) and run existing auth e2e
- [ ] T036 🛑 [US7] Lighthouse on `/` (≥ 90 ×3) into `docs/reports/ui/`, write `docs/reports/UI-G2.md`

## Phase 5: User Story 1 — App shell and navigation (P1, UI-G3a)

**Goal**: sidebar, topbar, command palette, bell, workspace switcher, quota bar.
**Independent test**: all 8 menu items at 1280 and 360, mouse then keyboard only; active item marked; no horizontal scroll.

- [X] T037 [US1] `GET /api/workspace/list` in `W/src/app/api/workspace/list/route.ts` (id, name, role, current)
- [X] T038 [US1] `W/src/components/shell/{AppSidebar,WorkspaceSwitcher,QuotaMeter,UserMenu}.tsx`: groups Sáng tạo/Workspace/Tài khoản (+ Hồ sơ), admin item only for platform admins, collapsible="icon", cookie `sidebar_state` read in the server layout
- [X] T039 [P] [US1] `W/src/components/shell/{Topbar,Breadcrumbs}.tsx` (≤ 64 px at 360, ThemeToggle, LocaleSwitcher, "Tạo video mới")
- [X] T040 [P] [US1] `W/src/components/shell/CommandMenu.tsx` (Ctrl/Cmd+K; pages by role, projects via `GET /api/projects?q=&pageSize=8`, actions)
- [X] T041 [P] [US1] `W/src/components/shell/NotificationBell.tsx` (ready/needs_attention/failed from the projects API; seen timestamp in localStorage; refresh on focus and every 60 s)
- [X] T042 [US1] `W/src/app/[locale]/(app)/layout.tsx` using the above; `loading.tsx` skeleton and error boundary for the group; remove old topbar
- [X] T043 [P] [US1] E2E `W/e2e/shell.spec.ts`: active item, collapse persistence, ⌘K, 360 px header height, keyboard-only reach, viewer vs admin items

## Phase 6: User Story 5 — Project management (P2, UI-G3b)

**Goal**: list with search/filters/sort/pagination, rename, delete one/many/all, permanent.
**Independent test**: 0/3/500 projects; filters in URL; delete flows; viewer sees no controls; no cross-workspace effect.

- [X] T044 [US5] Migration `packages/db/migrations/0007_project_search.sql`: `unaccent`, `pg_trgm`, `mkv_fold(text)` immutable, GIN trigram index on `mkv_fold(title)` WHERE deleted_at IS NULL, index `(workspace_id, created_at DESC)` WHERE deleted_at IS NULL
- [X] T045 [US5] Add `deletePrefix(prefix: string): Promise<number>` to `ObjectStore` in `packages/storage/src/index.ts` (ListObjectsV2 + DeleteObjects in batches of 1000, `assertKey`)
- [X] T046 [US5] `packages/pipeline/src/projects-admin.ts`: `tombstoneProjects` (lock, set `deleted_at`, `run_id = NULL`, `settle(..., false)` for reserved reservations, remove known queued jobs) and `purgeProject` (deletePrefix `ws/<ws>/projects/<id>/`, rm work dir, delete row + orphan source_materials); export from `packages/pipeline/src/index.ts`
- [X] T047 [US5] Handle job `purge-project` (immediate + one retry after 15 min) on the `maintenance` queue in `apps/worker-ai/src/cron/retention.ts`
- [X] T048 [US5] `W/src/server/projects-list.ts`: zod-parsed filters (q, status groups, aspect, source, mode, createdBy, created/updated ranges + `tz`, sort, dir, page, pageSize 1–100 default 24) → SQL with `count(*) over ()`, thumbnail signed URL, progress from latest job
- [X] T049 [US5] Extend `GET /api/projects`, add `PATCH` (title NFC, trimmed, 1–200) and `DELETE` in `W/src/app/api/projects/[id]/route.ts`, add `POST /api/projects/delete` (ids ≤ 100, or filter + `confirm` XOA/DELETE, chunks of 100, `{deleted, failed}`) in `W/src/app/api/projects/delete/route.ts`; add `PATCH /api/projects/[id]` and `POST /api/projects/delete` to `ROUTES` in `W/src/server/rbac.ts` (`create`); add error codes to `W/src/lib/api-client.ts`; grep all callers of `GET /api/projects`
- [X] T050 [P] [US5] Unit `W/test/project-query.test.ts` (filter → params, bounds, bad input → 400) and RBAC rows in `W/test/rbac.test.ts`
- [X] T051 [P] [US5] Infra test `W/test/projects-crud.infra.test.ts` (`MAKVID_INFRA_TESTS=1`): 1 000 projects each filter < 1 s; "dong ho" finds "Đồng Hồ"; 0 cross-workspace list/rename/delete; purge removes rows and objects; tombstoned project rejected by worker step
- [X] T052 [US5] UI `W/src/components/projects/{ProjectsToolbar,ProjectGrid,ProjectTable,RenameField,DeleteDialogs,StatsStrip}.tsx`: grid/table toggle (localStorage), filters in URL, selection with select-all-in-page and action bar, delete dialogs ("cannot be undone", typed phrase for many/all, partial-failure toast), progress for processing items, empty state with CTA, skeleton
- [X] T053 [US5] Wire the projects page in `W/src/app/[locale]/page.tsx` (signed-in branch) and a `loading.tsx`
- [X] T054 [P] [US5] E2E `W/e2e/projects-crud.spec.ts` for the acceptance scenarios of US5 including viewer role

## Phase 7: User Story 4 — Create video wizard (P1, UI-G3c)

**Goal**: four titled sections, voice picker with tabs and filters, summary with quota.
**Independent test**: create one video per source; request body identical to the old form for the same inputs.

- [X] T055 [US4] Rewrite `W/src/components/CreateForm.tsx` into `W/src/components/create/{CreateForm,AspectCards,DurationField,CreateSummary}.tsx`; keep every field, default and `data-testid`; sections: source+content, aspect+duration (slider + number), voice, mode; summary reads `GET /api/workspace/usage` and disables submit with reason + upgrade link when over limit
- [X] T056 [US4] Rewrite `W/src/components/VoicePicker.tsx` (Tabs Standard/Pro/Ultra with one-line explanation, gender and region filters, compact list, preview play/stop state, one voice playing at a time)
- [X] T057 [P] [US4] E2E: update `W/e2e/create-and-edit.spec.ts` and `W/e2e/sources.spec.ts` selectors; assert request payload unchanged

## Phase 8: User Story 3 — Project editor (P1, UI-G3d)

**Goal**: 3 resizable panes (tabs on mobile), correctly proportioned player, always-visible chat, toolbar.
**Independent test**: 9:16 and 16:9 projects; send chat, undo, redo, download, open history without page scroll at 1280.

- [X] T058 [US3] Split `W/src/components/Editor.tsx` into `W/src/components/editor/{EditorLayout,SceneList,PreviewPlayer,ChatPanel,EditorToolbar,DownloadMenu,VersionSheet,ProgressSteps}.tsx` using `Resizable` (`autoSaveId`) and `Tabs` below `md`; keep `EventSource` progress and every `data-testid`
- [X] T059 [US3] PreviewPlayer: aspect-ratio frame from the project, poster, loading state, error state with retry
- [X] T060 [US3] Toolbar: inline rename (PATCH), status badge, Undo/Redo, Download menu per aspect + SRT + thumbnail, "…" menu (save as template, duplicate), history Sheet; keep review UIs (`ScriptReview`, `StoryboardReview`) visible when awaiting review
- [X] T061 [P] [US3] Update `W/src/components/{Downloads,VersionHistory,SaveTemplate}.tsx` to new components; update `W/e2e/create-and-edit.spec.ts` selectors (`.bubble.assistant` → test ids)
- [ ] T062 [P] [US3] E2E for broken video URL (error + retry), 360 px tabs, deleted-project 404

## Phase 9: User Story 6 — Plan, usage, API locks (P2, UI-G3e)

- [X] T063 [US6] Rewrite `W/src/components/BillingPanel.tsx` with `UsageMeter` per metric (warn ≥ 80 %, "Không giới hạn"), plan cards (price unit, current badge, disabled upgrade with reason)
- [X] T064 [US6] `W/src/components/ApiSettings.tsx` and `W/src/components/BatchesPanel.tsx`: lock form + `UpgradeCard` when `api_enabled` / `batch_enabled` is false; restyle `BatchProgress.tsx`
- [ ] T065 [P] [US6] Update `W/e2e/m5.spec.ts` selectors and add checks for 67 % bar, free plan lock

## Phase 10: User Story 8 — Brand, assets, members (P3, UI-G3f)

- [X] T066 [P] [US8] Rewrite `W/src/components/BrandKitEditor.tsx` with ColorField, Select, FileDropzone; preview beside form at desktop; keep `W/e2e/brand.spec.ts` green
- [X] T067 [P] [US8] `W/src/app/[locale]/(app)/workspace/assets/page.tsx` empty state + dropzone; `W/src/components/MembersPanel.tsx` with Table, Dialog, avatars, toast on invite
- [X] T068 [P] [US8] Restyle `W/src/components/{AcceptInvite,AdminPlans}.tsx` and `W/src/app/[locale]/(app)/admin/page.tsx`, `batches/[id]/page.tsx`

## Phase 11: User Story 9 — Profile (P3, UI-G3g)

- [X] T069 [US9] `POST/DELETE /api/me/avatar` in `W/src/app/api/me/avatar/route.ts` (magic bytes PNG/JPEG/WebP via `validateUpload(bytes,"image")`, no SVG, ≤ 2 MB, key `users/<id>/avatar-<sha8>.<ext>`) and `GET /api/avatars/[userId]` (302 to 5-min signed URL if same workspace)
- [X] T070 [US9] `W/src/app/[locale]/(app)/account/page.tsx` + `W/src/components/account/{ProfileForm,AvatarField,PasswordForm,PreferencesCard}.tsx` (updateUser name 1–80 NFC; client canvas crop to 256×256 WebP; changePassword with revokeOtherSessions option; `listAccounts` hides password form for Google-only; theme + language)
- [X] T071 [P] [US9] Test avatar validation in `W/test/avatar.test.ts` and E2E `W/e2e/account.spec.ts` (rename, avatar rejected/accepted, wrong current password, new password sign-in)
- [X] T072 🛑 Run all gates for UI-G3, write `docs/reports/UI-G3.md` with screenshots and quickstart Phase 3 results

## Phase 12: Polish (UI-G4)

- [X] T073 Remove old rules from `W/src/app/globals.css`; verify `rg -n "className=\"(shell|topbar|card|btn|badge|stack)" W/src` is empty
- [X] T074 [P] `W/e2e/a11y.spec.ts` with `@axe-core/playwright` on main pages, both themes: 0 serious/critical
- [X] T075 [P] Extend `W/e2e/no-tech-leak.spec.ts` to new pages; run full screenshot set
- [ ] T076 [P] Lighthouse desktop + mobile reports into `docs/reports/ui/`
- [X] T077 Update `AGENTS.md` layout table, `THIRD_PARTY_LICENSES.md`, `docs/PROGRESS.md`; mark tasks `[X]`
- [X] T078 🛑 Write `docs/reports/UI-G4.md` (list "Sắp ra mắt" items, deviations, token changes), stop for approval

## Dependencies

- Phase 1 → 2 → 3 (G1). Phase 4 needs 2–3. Phase 5 needs 2–3. Phases 6–11 need Phase 5; Phase 8 also needs T049 (rename API). Phase 12 last.
- Within Phase 6: T044 → T045 → T046 → T047, T048 → T049 → T052 → T053.
- T034 (hero render) must wait for owner approval of scripts.

## Parallel examples

- After Phase 2: T013, T014, T015 together; T018 and T019 together.
- Phase 4: T028, T029, T030, T032, T033 together.
- Phase 6: T050 and T051 once T049 lands.

## Implementation strategy

MVP = Phases 1–3 (foundation + theme/locale, UI-G1) then Phase 5 (shell). Deliver gate by gate; the old CSS stays until Phase 12 so the app always runs. Owner asked on 2026-11-14 to continue without waiting for approval overnight; gates are still written as reports for morning review.
