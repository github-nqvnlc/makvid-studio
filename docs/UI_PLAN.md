# UI_PLAN — Nâng cấp giao diện MakVid Studio

Bản tóm tắt cho chủ sản phẩm, theo yêu cầu ở mục 3 của [UI_PROMPT.md](UI_PROMPT.md). Plan đầy đủ:
[specs/002-saas-ui-revamp/plan.md](../specs/002-saas-ui-revamp/plan.md). Trạng thái: **chờ duyệt (UI-G0)**.

## 1. Route hiện có và route sẽ thêm

| URL | Bố cục | Thay đổi |
| --- | --- | --- |
| `/` khi chưa đăng nhập | Công khai | **Mới**: landing 9 khối, có video mẫu thật ở hero |
| `/` khi đã đăng nhập | Ứng dụng | Thống kê + lưới/bảng dự án, tìm không dấu, lọc đầy đủ, đổi tên, xóa một/nhiều/tất cả |
| `/pricing` | Công khai | **Mới** |
| `/docs/api` | Công khai | Chuyển sang khung mới |
| `/sign-in`, `/sign-up`, `/invite/[token]` | Xác thực | Chia đôi màn hình, form kiểm lỗi từng ô |
| `/projects/new` | Ứng dụng | 4 phần + thẻ tóm tắt quota; bộ chọn giọng có tab và bộ lọc |
| `/projects/[id]` | Ứng dụng | 3 cột co giãn (cảnh / xem trước đúng tỷ lệ / chat), thành tab trên mobile |
| `/batches`, `/batches/[id]` | Ứng dụng | Khóa kèm thẻ nâng cấp khi gói không có tính năng hàng loạt |
| `/workspace/brand`, `assets`, `members` | Ứng dụng | Ô màu + mã hex, kéo-thả file, ảnh đại diện |
| `/workspace/billing`, `/workspace/api` | Ứng dụng | Thanh tiến độ + cảnh báo 80%; khóa API theo gói |
| `/account` | Ứng dụng | **Mới**: hồ sơ, ảnh đại diện, mật khẩu, giao diện, ngôn ngữ |
| `/admin` | Ứng dụng | Chỉ quản trị nền tảng thấy mục này |
| URL sai / lỗi | — | Trang 404 và trang lỗi đúng giao diện |

## 2. Sơ đồ bố cục

```text
CÔNG KHAI   [logo] Tính năng · Phong cách · Bảng giá · Tài liệu API  [🌐 VI] [☀] Đăng nhập [Dùng thử miễn phí]
            ──────────── nội dung ────────────
            footer: sản phẩm · tài nguyên · pháp lý · ngôn ngữ · mạng xã hội

XÁC THỰC    ┌──── form ────┬──── panel thương hiệu ────┐   (mobile: chỉ form)
            └──────────────┴────────────────────────────┘

ỨNG DỤNG    ┌ sidebar ─────┬ topbar: ☰ đường dẫn … [⌘K] [+ Tạo video] [🔔] [🌐] [☀] ┐
            │ logo + ws ▾  │                                                         │
            │ Sáng tạo     │  Tiêu đề trang                       [hành động chính]  │
            │ Workspace    │  mô tả                                                  │
            │ Tài khoản    │  ─────── nội dung ───────                               │
            │ ▓▓▓░ quota   │                                                         │
            │ 👤 menu      │                                                         │
            └──────────────┴─────────────────────────────────────────────────────────┘
```

## 3. Component shadcn sẽ dùng

sidebar, breadcrumb, command, sheet, dropdown-menu, avatar, badge, button, card, table, tabs, dialog,
alert-dialog, form, input, textarea, select, slider, toggle-group, radio-group, checkbox, switch, popover,
calendar, progress, skeleton, sonner, tooltip, resizable, accordion, scroll-area, separator, label.

Component dùng chung tự viết: PageHeader, EmptyState, ErrorState, UpgradeCard, StatusBadge, UsageMeter,
ColorField, FileDropzone, ThemeToggle, LocaleSwitcher.

## 4. Thứ tự làm và cổng duyệt

| Cổng | Nội dung |
| --- | --- |
| UI-G0 | Spec + clarify + plan (**đang chờ anh/chị duyệt**) |
| UI-G1 | Tailwind, shadcn, theme poppy-1, font, sáng/tối, nút ngôn ngữ, test thiếu key |
| UI-G2 | Landing, bảng giá, đăng nhập/đăng ký, 404. Kịch bản video hero gửi anh/chị duyệt trước khi render |
| UI-G3 | Khung ứng dụng, quản lý dự án (API + UI), tạo video, trình chỉnh sửa, gói, API, brand, thư viện, thành viên, hồ sơ, admin |
| UI-G4 | Xóa CSS cũ, kiểm tra truy cập, ảnh chụp đầy đủ, Lighthouse |

Mỗi cổng kèm ảnh chụp 2 theme × 2 ngôn ngữ × desktop/mobile và kết quả test, rồi dừng chờ duyệt.

## 5. Rủi ro chính

- **Xóa vĩnh viễn** không khôi phục được. Giảm rủi ro: gõ chữ xác nhận, chỉ Biên tập trở lên được xóa, dừng job
  trước khi xóa, có test cách ly workspace.
- **Theme poppy-1** có viền đen/trắng thuần, không đạt tương phản AA. Sẽ chỉ chỉnh token và báo lại số đo.
- **Font DM Sans không có tiếng Việt**, sẽ thay bằng Be Vietnam Pro.
- **Thư viện `sharp`** kéo theo libvips (giấy phép LGPL), không dùng được. Ảnh đại diện sẽ được thu nhỏ ngay trên
  trình duyệt trước khi tải lên.
- **Trong lúc chuyển đổi**, trang cũ có thể lệch kiểu. CSS cũ chỉ bị xóa ở UI-G4.

## 6. Đề xuất cho sau (không làm lần này)

Quên mật khẩu và xác minh email · gói theo năm · thông báo đồng bộ giữa các thiết bị · trang pháp lý thật ·
quản lý dự án qua API công khai.
