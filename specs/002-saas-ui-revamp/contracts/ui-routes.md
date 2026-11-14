# Contract: routes, layouts and navigation (002)

The locale convention is unchanged: Vietnamese has no prefix, English uses `/en`, and `/vi/...` redirects to the
unprefixed path. Every page below exists in both locales.

## Layout groups (Next.js route groups under `src/app/[locale]/`)

```text
[locale]/layout.tsx            html/body, fonts, ThemeProvider, NextIntlClientProvider, Toaster
├── (marketing)/layout.tsx     sticky public header + footer        → landing, pricing, docs/api, legal stubs
├── (auth)/layout.tsx          split screen (form | brand panel)    → sign-in, sign-up, invite/[token]
├── (app)/layout.tsx           SidebarProvider + AppSidebar + Topbar → every signed-in page
├── not-found.tsx              themed 404 (both locales)
└── error.tsx                  themed error boundary with "Try again"
```

`/` is shared: `src/app/[locale]/page.tsx` renders `<Landing/>` for guests and `<ProjectsPage/>` inside the app
shell for signed-in users. The (app) layout cannot wrap `/` through the folder tree, so the page imports
`AppShell` directly. All other app pages move into `(app)/` without changing their URLs.

## Route map

| URL | Layout | Status | Spec |
| --- | --- | --- | --- |
| `/` (guest) | marketing | **new content** | US7, FR-013 |
| `/` (signed in) | app | redesigned + CRUD | US5, FR-026–028, FR-053–060 |
| `/pricing` | marketing | **new** | FR-015 |
| `/docs/api` | marketing | moved | FR-014 |
| `/sign-in`, `/sign-up` | auth | redesigned | FR-018–020 |
| `/invite/[token]` | auth | restyled | FR-001 |
| `/projects/new` | app | redesigned (4 sections + summary) | US4, FR-029–032 |
| `/projects/[id]` | app (full-bleed) | redesigned (3 resizable panes / tabs) | US3, FR-033–037 |
| `/batches`, `/batches/[id]` | app | restyled, plan-locked when batch is disabled | FR-040 |
| `/workspace/brand` | app | redesigned inputs | FR-041–042 |
| `/workspace/assets` | app | restyled + empty state + drop zone | US8 |
| `/workspace/members` | app | restyled + avatars | US8, FR-052 |
| `/workspace/billing` | app | progress bars, plan cards | US6, FR-038–039 |
| `/workspace/api` | app | locked card when API is disabled | FR-040 |
| `/account` | app | **new** (profile) | US9, FR-050–052 |
| `/admin` | app | restyled, platform admins only (404 otherwise) | FR-021 |
| anything else | — | themed 404 | FR-017 |

Legal links in the footer (Terms, Privacy) and social links are shown with a "Coming soon" badge, without a link
(FR-016), until real pages exist.

## Sidebar (FR-021)

```text
[logo]  [workspace switcher ▾]
SÁNG TẠO / CREATE        Dự án /  · Tạo video /projects/new · Tạo hàng loạt /batches
WORKSPACE                Brand kit · Thư viện /workspace/assets · Thành viên /workspace/members
TÀI KHOẢN / ACCOUNT      Gói & mức dùng · API & webhooks · Hồ sơ /account
QUẢN TRỊ (admins only)   Quản trị /admin
──────────────────────
[quota bar: videos used / limit, warns ≥ 80 %]
[avatar  name ▾]  → Hồ sơ · Giao diện ▸ · Ngôn ngữ ▸ · Đăng xuất
```

The active item matches the longest route prefix: `/projects/[id]` highlights "Projects", and `/batches/[id]`
highlights "Batch".

## Topbar (FR-023)

`[sidebar trigger] [breadcrumb] ……… [search ⌘K] [+ New video] [bell] [locale] [theme]`

At 360 px: `[trigger] [page title] … [search icon] [+ icon] [bell] [⋯ → locale/theme]`, one row, ≤ 64 px (SC-002).

## Command palette (Ctrl/Cmd+K)

Groups: **Pages** (every sidebar item, filtered by role) · **Projects** (`GET /api/projects?q=…&pageSize=8`,
debounced 200 ms) · **Actions** (New video, Switch theme, Switch language).

## Public header (FR-014)

`[logo] Tính năng · Phong cách · Bảng giá · Tài liệu API ……… [locale] [theme] Đăng nhập [Dùng thử miễn phí]`.
The first two are in-page anchors on `/` (`#features`, `#styles`); from `/pricing` they link to `/#features`. On
mobile, the menu is a `Sheet` holding the same items.
