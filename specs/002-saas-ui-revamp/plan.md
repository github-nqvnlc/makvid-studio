# Implementation Plan: Nâng cấp giao diện MakVid Studio thành web SaaS hoàn chỉnh

**Branch**: `002-saas-ui-revamp` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-saas-ui-revamp/spec.md`

**Note**: Tài liệu này là `docs/UI_PLAN.md` mà [docs/UI_PROMPT.md](../../docs/UI_PROMPT.md) yêu cầu ở Giai đoạn 0
(bản tóm tắt cho chủ sản phẩm nằm ở [docs/UI_PLAN.md](../../docs/UI_PLAN.md)). Chi tiết nghiên cứu ở
[research.md](research.md), dữ liệu ở [data-model.md](data-model.md), contract ở [contracts/](contracts/),
cách kiểm chứng ở [quickstart.md](quickstart.md). Các tài liệu kỹ thuật này viết bằng tiếng Anh.

## Summary

Thay toàn bộ giao diện của `apps/web` (CSS viết tay, chỉ có chế độ tối, menu ngang 8 link) bằng giao diện
SaaS gồm 3 khu bố cục: **công khai** (landing, bảng giá, tài liệu API), **xác thực** (chia đôi màn hình) và
**ứng dụng** (sidebar thu gọn được, topbar có command palette). Giao diện có sáng/tối và nút chuyển ngôn ngữ
giữ nguyên trang.

Nền tảng: Tailwind CSS v4 + shadcn/ui (Radix), theme tweakcn "poppy-1", font Plus Jakarta Sans / Be Vietnam Pro
/ Space Mono (DM Sans bị thay vì không có bộ chữ tiếng Việt), next-themes, next-intl hiện có.

Hai ngoại lệ phía máy chủ đã được duyệt trong spec:
- **Quản lý dự án đầy đủ**: liệt kê có lọc, tìm không dấu, sắp xếp, phân trang trên máy chủ; đổi tên; xóa
  vĩnh viễn một, nhiều, hoặc tất cả. Xóa chạy 2 bước: đánh dấu xóa ngay, rồi worker dọn dữ liệu.
- **Trang hồ sơ**: đổi tên, ảnh đại diện, mật khẩu, ngôn ngữ, dùng endpoint có sẵn của Better Auth.

API công khai `/api/v1`, VideoSpec, pipeline render và schema bảng không đổi. Chỉ thêm 1 migration (extension
và index).

## Technical Context

**Language/Version**: TypeScript strict, Node.js ≥ 22.12, React 19.2.9, Next.js 16.4.3 (App Router, Turbopack).

**Primary Dependencies**:
- **Đã có**: next-intl 4.14.9, better-auth 1.7.14, zod 4.6.7, drizzle-orm, bullmq.
- **Thêm mới**:
  - Giao diện: tailwindcss + @tailwindcss/postcss 4.3.5, shadcn CLI 4.23.0, radix-ui 1.8.1, lucide-react
    1.72.0, next-themes 0.4.6, sonner 2.0.8, cmdk 1.1.1, react-resizable-panels 4.22.1.
  - Form: react-hook-form 7.92.0, @hookform/resolvers 7.0.6.
  - Lịch: react-day-picker 10.0.2, date-fns 4.4.0.
  - Tiện ích CSS: class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, tw-animate-css 1.4.0.
  - Chỉ dùng khi phát triển: @axe-core/playwright 4.14.0.

  Tất cả đã đối chiếu trên npm ngày 2026-11-14 (research R1–R7).

**Storage**: PostgreSQL 17 (thêm extension `unaccent` + `pg_trgm` và 2 index cho bảng `projects`), object store
S3/SeaweedFS (thêm `deletePrefix`), localStorage/cookie cho lựa chọn hiển thị.

**Testing**:
- vitest: unit (truy vấn lọc, kiểm tra hợp lệ, so khớp key vi/en, tương phản token).
- vitest integration (`MAKVID_INFRA_TESTS=1`): cách ly workspace, purge, hiệu năng 1.000 dự án.
- Playwright E2E trên `dev:mock`: giữ 100% spec cũ, thêm spec mới, chụp màn hình, axe.
- Lighthouse.

**Target Platform**: Trình duyệt hiện đại (Chrome/Edge/Firefox/Safari 2 bản gần nhất), desktop và mobile ở 360 /
768 / 1280 / 1536 px. Server chạy Node trong Docker như hiện nay.

**Project Type**: Web app trong monorepo (`apps/web`), cộng thay đổi nhỏ ở `packages/pipeline`,
`packages/storage`, `packages/db`, `apps/worker-ai`.

**Performance Goals**:
- Lighthouse trên `/` ≥ 90 ở Performance, Accessibility, Best Practices (SC-010).
- Mỗi lần lọc hoặc chuyển trang danh sách dự án dưới 1 giây với 1.000 dự án (SC-013).
- Không nháy sai theme khi tải trang.

**Constraints**:
- Chỉ dùng token theme, không có chữ cứng (cả hai được kiểm bằng lint/test).
- Giữ mọi `data-testid` mà E2E đang dùng.
- Dependency phải qua `pnpm license:check`.
- Không tải tài nguyên từ CDN lúc chạy (font tự host qua `next/font`).
- Video hero ≤ 1,5 MB mỗi bản.

**Scale/Scope**:
- 17 URL (14 có sẵn + `/pricing`, `/account`, trang 404/lỗi).
- 16 component cũ cần viết lại.
- Khoảng 400 key i18n mỗi ngôn ngữ, sẽ tăng lên khoảng 900.
- 9 user story, 61 FR.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc | Đánh giá | Ghi chú |
| --- | --- | --- |
| I. Plan và milestone có cổng duyệt | ✅ | Plan này chờ duyệt trước khi viết code. 5 giai đoạn UI-G0 → UI-G4, mỗi giai đoạn có báo cáo trong `docs/reports/UI-G<n>.md` và dừng chờ duyệt |
| II. Xong nghĩa là đã chạy thật | ✅ | Mỗi giai đoạn: typecheck, lint, test, build, E2E (spec cũ + mới), ảnh chụp thật. Luồng tạo video E2E vẫn render MP4 (mock). Video hero được render thật bằng pipeline. Mọi thư viện đã đối chiếu phiên bản và tài liệu (research) |
| III. VideoSpec là nguồn sự thật, render tất định | ✅ | Không đụng VideoSpec, compiler, renderer. Xóa dự án không ảnh hưởng `render_cache` dùng chung |
| IV. Tiếng Việt và chất lượng hình ảnh | ✅ | Font được kiểm glyph Ẩ/Ỹ/Ự/ặ/ở/Đ; DM Sans bị thay vì thiếu bộ chữ tiếng Việt. Tên dự án chuẩn hóa NFC. Tìm kiếm không dấu có test |
| V. Người dùng không thấy thông tin kỹ thuật | ✅ | Mọi lỗi qua `errors.<code>`. Spec E2E `no-tech-leak` vẫn chạy và mở rộng cho trang mới |
| VI. License thương mại sạch | ✅ | Dependency mới đều MIT/ISC/Apache-2.0. `@axe-core/playwright` (MPL-2.0) chỉ là devDependency, cổng license chỉ cảnh báo. Font OFL ghi vào `THIRD_PARTY_LICENSES.md`. `sharp` bị loại vì libvips là LGPL |
| VII. Cách ly và bảo mật mặc định | ✅ | Liệt kê, đổi tên, xóa đều chạy trong `withWorkspace` (RLS) và kiểm quyền theo `rbac.ts`, có test chứng minh 0 rò rỉ giữa workspace. Ảnh đại diện kiểm magic bytes và kích thước, không nhận SVG, xem qua signed URL ngắn hạn và chỉ cho người cùng workspace. "Xóa tất cả" phải gõ chữ xác nhận |
| VIII. Trừu tượng hóa nhà cung cấp, đo chi phí | ✅ | Thêm `deletePrefix` vào interface `ObjectStore`, không gọi S3 trực tiếp từ app. `usage_records` được giữ lại khi xóa dự án để không mất sổ chi phí |

**Re-check sau Phase 1**: vẫn đạt. Thiết kế không thêm vi phạm mới; hai ngoại lệ phạm vi đã được chủ sản phẩm
duyệt (xem Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/002-saas-ui-revamp/
├── plan.md              # File này (= docs/UI_PLAN.md chi tiết)
├── research.md          # R1–R12: thư viện, theme, font, i18n, API dự án, hồ sơ, video hero, test
├── data-model.md        # Dữ liệu dùng lại, migration 0007, vòng đời xóa, lựa chọn phía trình duyệt
├── quickstart.md        # Cách kiểm chứng từng giai đoạn
├── contracts/
│   ├── internal-api.md  # GET/PATCH/DELETE dự án, xóa hàng loạt, /api/me, avatar, workspace list
│   ├── ui-routes.md     # Layout group, bảng route, sidebar, topbar, command palette
│   └── ui-conventions.md# Checklist quy ước giao diện cho mọi trang
├── checklists/requirements.md
└── tasks.md             # Do /speckit-tasks tạo
```

### Source Code (repository root)

```text
apps/web/
├── postcss.config.mjs                     # mới: @tailwindcss/postcss
├── components.json                        # mới: cấu hình shadcn
├── public/demo/{hero-vi,hero-en}.mp4|webp # mới: video hero + poster
├── messages/{vi,en}.json                  # thêm namespace shell, landing, pricing, account, projectsList, common
├── src/
│   ├── app/
│   │   ├── globals.css                    # viết lại: tailwind + token poppy-1 (đã chỉnh tương phản)
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                 # html/body, font, ThemeProvider, Toaster
│   │   │   ├── page.tsx                   # khách → Landing; đã đăng nhập → AppShell + Projects
│   │   │   ├── not-found.tsx, error.tsx
│   │   │   ├── (marketing)/{layout.tsx, pricing/, docs/api/}
│   │   │   ├── (auth)/{layout.tsx, sign-in/, sign-up/, invite/[token]/}
│   │   │   └── (app)/{layout.tsx, projects/, batches/, workspace/*, account/, admin/}
│   │   └── api/
│   │       ├── projects/route.ts          # GET mở rộng (lọc, phân trang)
│   │       ├── projects/[id]/route.ts     # thêm PATCH, DELETE
│   │       ├── projects/delete/route.ts   # mới: xóa nhiều / xóa tất cả
│   │       ├── me/route.ts, me/avatar/route.ts, avatars/[userId]/route.ts   # mới
│   │       └── workspace/list/route.ts    # mới
│   ├── components/
│   │   ├── ui/                            # component shadcn (do CLI tạo)
│   │   ├── shell/                         # AppSidebar, Topbar, CommandMenu, NotificationBell, WorkspaceSwitcher, QuotaMeter, UserMenu
│   │   ├── common/                        # PageHeader, EmptyState, ErrorState, UpgradeCard, StatusBadge, UsageMeter, ColorField, FileDropzone, ThemeToggle, LocaleSwitcher
│   │   ├── marketing/                     # PublicHeader, Footer, Hero, HowItWorks, StyleGallery, Features, UseCases, PricingTable, Faq, FinalCta
│   │   ├── projects/                      # ProjectsToolbar, ProjectGrid, ProjectTable, DeleteDialogs, RenameField
│   │   ├── create/                        # CreateForm (4 phần), AspectCards, DurationField, VoicePicker, CreateSummary
│   │   ├── editor/                        # EditorLayout, SceneList, PreviewPlayer, ChatPanel, EditorToolbar, DownloadMenu, VersionSheet, ProgressSteps
│   │   ├── account/                       # ProfileForm, AvatarField, PasswordForm, PreferencesCard
│   │   └── (component cũ được chuyển vào các thư mục trên rồi xóa)
│   ├── lib/{utils.ts, project-query.ts, prefs.ts}
│   └── server/{projects-list.ts, account.ts}
├── test/{messages.test.ts, tokens-contrast.test.ts, project-query.test.ts, projects-crud.infra.test.ts}
└── e2e/{shell, theme-locale, projects-crud, account, landing, screens, a11y}.spec.ts   # mới, cùng spec cũ đã cập nhật

packages/storage/src/index.ts              # thêm ObjectStore.deletePrefix
packages/pipeline/src/{projects-admin.ts}  # tombstoneProjects, purgeProject (dùng chung web + worker)
packages/db/migrations/0007_project_search.sql
apps/worker-ai/src/cron/retention.ts       # xử lý job "purge-project" trên queue maintenance
THIRD_PARTY_LICENSES.md                    # thêm 3 font OFL + dependency mới
```

**Structure Decision**: Giữ cấu trúc monorepo hiện có. Mọi component React nằm trong `apps/web/src/components`
(shadcn ở `ui/`), vì `packages/ui` là package không có React, dùng chung với worker. Logic xóa dự án đặt ở
`packages/pipeline` để web (bước đánh dấu xóa) và worker-ai (bước dọn) dùng chung, giống `retention.ts`.

## Giai đoạn, thứ tự migrate và cổng duyệt

Theo mục 9 của UI_PROMPT.md. Mỗi cổng có báo cáo `docs/reports/UI-G<n>.md` gồm: đã làm gì, cách chạy thử, kết
quả test, ảnh chụp 2 theme × 2 ngôn ngữ × desktop/mobile, tiêu chí đạt/chưa, việc cần chủ sản phẩm quyết. Sau
đó dừng chờ duyệt.

| Giai đoạn | Nội dung | Thứ tự bên trong | Nghiệm thu |
| --- | --- | --- | --- |
| **UI-G0** Khảo sát và plan | spec, clarify, plan này, `docs/UI_PLAN.md` | — | Chủ sản phẩm duyệt plan |
| **UI-G1** Nền tảng | Tailwind + shadcn init, theme poppy-1, chỉnh token tương phản, font, next-themes, ThemeToggle, LocaleSwitcher (có lưu hồ sơ), component `common/`, test so khớp key i18n, rule lint (chữ cứng, mã màu) | 1) Tailwind chạy song song CSS cũ · 2) token + font · 3) theme provider · 4) locale switcher · 5) đặt 2 nút vào layout hiện tại · 6) test + lint | Đổi theme/ngôn ngữ ở **mọi trang hiện có** không lỗi, không nháy, không cảnh báo hydration; build, lint, E2E cũ đều pass |
| **UI-G2** Công khai + xác thực | Layout group (marketing)/(auth), landing 9 khối, `/pricing`, 404/lỗi, sign-in/up/invite chia đôi, form RHF+zod, nút Google có điều kiện. Kịch bản video hero gửi duyệt **trước** khi render | 1) layout + header/footer · 2) auth pages · 3) landing · 4) pricing · 5) 404/error · 6) render video hero sau khi kịch bản được duyệt | Ảnh chụp 2×2×2; đăng ký/đăng nhập như cũ; Lighthouse `/` ≥ 90 |
| **UI-G3** App shell + màn hình chính | (a) Shell: sidebar, topbar, command palette, chuông, workspace switcher, quota · (b) API + UI quản lý dự án · (c) wizard tạo video + voice picker · (d) trình chỉnh sửa · (e) billing, API, batches · (f) brand, assets, members · (g) trang hồ sơ + API avatar · (h) admin | Theo thứ tự a → h; mỗi trang là 1 task kèm checklist `ui-conventions.md`; migration 0007 + `deletePrefix` + purge làm trước (b) | Mọi luồng cũ vẫn chạy (E2E); mọi màn hình có đủ trạng thái tải/rỗng/lỗi; test cách ly + hiệu năng (infra) pass |
| **UI-G4** Hoàn thiện | Xóa `globals.css` cũ và class cũ, axe trên trang chính, ảnh chụp đầy đủ, Lighthouse, cập nhật `THIRD_PARTY_LICENSES.md`, `AGENTS.md`, `PROGRESS.md` | — | Không còn class cũ, không chữ cứng, mọi test pass, có báo cáo Lighthouse và axe |

**Cách migrate an toàn**: Tailwind được thêm vào **cạnh** CSS cũ ở UI-G1 (preflight của Tailwind có thể đổi style
mặc định của trang cũ, nên kiểm bằng ảnh chụp). Mỗi trang chuyển hẳn sang component mới trong một task. CSS cũ
chỉ bị xóa ở UI-G4, khi không còn trang nào dùng. Nhờ vậy app luôn chạy được giữa các giai đoạn.

**Trước task đầu tiên đổi giao diện** (đầu UI-G1): chạy bước ui-consistency "finding-patterns" để ghi checklist
cho từng trang dựa trên [contracts/ui-conventions.md](contracts/ui-conventions.md). Sau mỗi trang, một agent
riêng kiểm theo checklist (bước "verifying").

## Rủi ro

| Rủi ro | Ảnh hưởng | Cách giảm |
| --- | --- | --- |
| Preflight của Tailwind làm vỡ trang cũ trong lúc chuyển | Giao diện tạm xấu giữa giai đoạn | Chụp ảnh trước/sau ở UI-G1; nếu vỡ nặng thì đưa CSS cũ vào `@layer` thấp hơn cho tới UI-G4 |
| E2E phụ thuộc markup cũ (`.bubble.assistant`, `select`, `p.error[role=alert]`) | Spec cũ đỏ | Giữ mọi `data-testid`; sửa selector trong cùng task với trang |
| Token poppy-1 có viền đen/trắng thuần | Giao diện gắt, không đạt AA | Chỉ chỉnh token (R2), test tương phản tự động |
| Xóa vĩnh viễn trong lúc worker đang chạy | File mồ côi, lỗi worker | Đánh dấu xóa + `run_id = NULL` trước, dọn sau, chạy lại lần 2 sau 15 phút, test bằng infra |
| "Xóa tất cả" xóa nhầm | Mất dữ liệu không khôi phục | Gõ chữ xác nhận, hộp thoại ghi rõ số lượng và bộ lọc, chỉ Editor trở lên được xóa |
| `unaccent` không có trên Postgres production | Tìm không dấu lỗi | Ảnh Postgres 17 alpine có contrib; migration dùng `IF NOT EXISTS` và test chạy trên đúng ảnh này |
| Lighthouse < 90 vì video hero | Không đạt SC-010 | `preload="none"`, poster WebP, chỉ phát sau khi trang rảnh, ≤ 1,5 MB |
| Chuỗi tiếng Việt dài làm vỡ layout | Tràn chữ, cuộn ngang | Ảnh chụp 360 px cả 2 ngôn ngữ; `truncate`/`line-clamp`; không đặt độ rộng cố định cho chữ |
| Mở rộng `GET /api/projects` (thêm phân trang) làm hỏng nơi đang gọi | Màn hình cũ thiếu dự án | Mặc định giữ đúng thứ tự cũ; rà mọi chỗ gọi (`grep`) trong cùng task |
| Agent khác đang sửa `apps/web` | Xung đột | Kiểm `docs/PROGRESS.md` trước mỗi giai đoạn (AGENTS.md quy tắc 9) |

## Đề xuất (chưa làm trong feature này)

- Quên mật khẩu và xác minh email (cần gửi email).
- Gói theo năm (đang hiện "Sắp ra mắt").
- Kho thông báo phía máy chủ, để "đã đọc" đồng bộ giữa các thiết bị.
- Trang pháp lý thật (Điều khoản, Quyền riêng tư) trước khi mở cho công chúng.
- Mở rộng quản lý dự án ra API công khai `/api/v1` (đã quyết không làm ở clarify câu 3).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Feature "chỉ sửa giao diện" có thay đổi phía máy chủ (API dự án, purge, migration 0007, `deletePrefix`, API hồ sơ/avatar) | Chủ sản phẩm duyệt ở clarify (ngoại lệ 1 và 2 trong spec) | Lọc trên trình duyệt chậm khi nhiều dự án; xóa không có API thì không làm được |
| Dev dependency MPL-2.0 (`@axe-core/playwright`) | Đo truy cập tự động (SC-006) | Kiểm tay không lặp lại được. Gói không đóng vào sản phẩm và cổng license chỉ cảnh báo |
