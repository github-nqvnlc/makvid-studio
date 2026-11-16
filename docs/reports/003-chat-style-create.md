# Báo cáo — Spec 003: tạo video dạng khung chat + log tiến trình trực tiếp

Ngày: 2026-11-16 · Nhánh: `003-chat-style-create` · Trạng thái: chưa commit, chờ chủ sản phẩm duyệt.

## Đã làm

- **Khung nhập một ô** (`/projects/new`): popover chọn kiểu nội dung (6), popover khung hình (4, mặc định 9:16),
  ô số giây (chỉ nhận số nguyên 30–180, báo lỗi ngay), nút giọng đọc mở dialog nghe thử (một giọng phát một lúc,
  hủy thì giữ giọng cũ), công tắc "Duyệt từng bước", tóm tắt chi tiết cập nhật tức thì và nút **Bắt đầu tạo video**.
  Body của `POST /api/projects` không đổi; bấm đúp chỉ tạo một video; lỗi giữ nguyên dữ liệu đã nhập.
- **Log tiến trình**: bảng `project_events` (migration 0008, RLS như các bảng khác), ghi từ các hook của worker;
  `GET /api/projects/{id}/log`; SSE gửi thêm `log` và `stages`; panel tiến trình (danh sách bước + log, lọc theo bước,
  tự cuộn và nút "Xuống mới nhất", "Đang kết nối lại…") đặt trong trang dự án với mọi trạng thái trừ `ready`.
  Chờ duyệt và lỗi hiển thị rõ; tải lại vẫn thấy toàn bộ lịch sử. Văn bản log chỉ lấy từ danh sách khóa cho phép,
  không bao giờ có tên kỹ thuật.
- ADR 0014, cập nhật `AGENTS.md`, `docs/PROGRESS.md`, spec/plan/tasks (đã phân tích và sửa F1–F8).

## Cách chạy thử

```bash
docker compose -f docker/compose.dev.yml up -d
pnpm db:migrate
pnpm dev:mock          # cổng 3000; nếu bị chiếm, đặt PORT và BETTER_AUTH_URL/APP_URL cùng cổng
pnpm --filter @makvid/web test:e2e -- composer progress
```

## Kết quả kiểm tra

| Hạng mục | Kết quả |
| --- | --- |
| `pnpm typecheck` (web, worker-render chạy riêng vì hết bộ nhớ) | đạt |
| `pnpm lint`, `pnpm license:check` | đạt |
| Unit: web 104, pipeline 15 (có `events.test.ts`), validation 5 | đạt |
| Infra: RLS + ghi log idempotent (db 11), CRUD dự án (5) | đạt |
| E2E `composer.spec.ts` (8), `progress.spec.ts` (3), axe composer/popover/dialog/tiến trình | đạt (một lần đầu bị chậm do khởi động lạnh, chạy lại đạt) |

## Chưa kiểm chứng / còn thiếu (xem cuối `tasks.md`)

- Máy này không có FFmpeg và chrome-headless-shell nên chưa render ra MP4 và chưa chạy các e2e phụ thuộc render
  (`create-and-edit`, `sources`, `m5`, `brand`). Các lần chạy dừng ở bước âm thanh/kiểm tra, nên đường lỗi của log
  đã được thấy thật, còn đường hoàn tất thì chưa. Cần chạy `scripts/verify-render.sh` hoặc e2e trên máy đủ công cụ.
- Chưa có e2e cho: hết quota, lỗi máy chủ giữ dữ liệu, ngắt mạng rồi nối lại log, log dài 5.000 dòng, ảnh chụp
  desktop/dark/360 px.
- Hành động khi lỗi chỉ là liên kết "Tạo lại"; chưa có thử lại theo từng bước.

## Cần chủ sản phẩm quyết định

1. Màu `destructive` trên nền sáng và hiệu ứng hover của `Button` outline (chữ trắng trên nền vàng accent) không đạt
   tương phản 4.5:1 (axe phát hiện). Mình đã tránh trong phần mới; sửa ở theme là thay đổi giao diện toàn app.
2. Có muốn thêm thử lại theo từng bước khi lỗi không (cần API mới)?
