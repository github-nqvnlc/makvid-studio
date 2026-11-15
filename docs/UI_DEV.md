# Hướng dẫn chạy hotload để tự chỉnh giao diện

Tài liệu cho người tự code giao diện `apps/web`. Mỗi lần lưu file, trình duyệt cập nhật ngay (Next.js 16 + Turbopack,
không cần build lại).

## 1. Chạy lần đầu (khoảng 5 phút)

Cần: Node ≥ 22.12, pnpm 12, Docker Desktop.

```bash
pnpm install
cp .env.example .env            # lần đầu; điền các giá trị bắt buộc (xem mục 6)
docker compose -f docker/compose.dev.yml up -d postgres valkey seaweedfs
pnpm db:migrate
pnpm dev:mock                   # web + 3 worker, dùng nhà cung cấp giả, không tốn tiền
```

Mở http://localhost:3000. Đăng ký một tài khoản bất kỳ (email thật hay giả đều được) ở `/sign-up`, ví dụ
`toi@example.test`.

> `pnpm dev:mock` đọc `.env` ở thư mục gốc rồi chạy `next dev` trong `apps/web`. Đừng chạy `next dev` riêng trong
> `apps/web`: nó không đọc `.env` gốc nên thiếu `DATABASE_URL`.

Chỉ sửa giao diện thì vẫn nên để `dev:mock` chạy cả worker, vì tạo video thử cần chúng. Nếu chỉ xem trang tĩnh thì
worker không dùng đến.

### Đổi cổng

Nếu cổng 3000 đang bị chiếm (ví dụ stack Docker đầy đủ `docker/compose.yml`), chạy cổng khác. Phải đổi cả hai biến URL,
nếu không đăng nhập sẽ lỗi:

```bash
# Git Bash
PORT=3100 APP_URL=http://localhost:3100 BETTER_AUTH_URL=http://localhost:3100 pnpm dev:mock
```

```powershell
# PowerShell
$env:PORT=3100; $env:APP_URL="http://localhost:3100"; $env:BETTER_AUTH_URL="http://localhost:3100"; pnpm dev:mock
```

## 2. Sửa ở đâu

| Muốn đổi | File |
| --- | --- |
| Màu, bo góc, bóng, token theme sáng/tối | `apps/web/src/app/globals.css` (khối `:root` và `.dark`) |
| Font | `apps/web/src/app/[locale]/layout.tsx` (Plus Jakarta Sans, Be Vietnam Pro, Space Mono) và `@theme inline` trong `globals.css` |
| Trang chủ khách, bảng giá | `src/components/marketing/*`, `src/app/[locale]/(marketing)/pricing/page.tsx` |
| Đăng nhập / đăng ký | `src/components/AuthForm.tsx`, `src/app/[locale]/(auth)/layout.tsx` |
| Sidebar, thanh trên, ⌘K, chuông | `src/components/shell/*` |
| Danh sách dự án (lọc, lưới/bảng, xóa) | `src/components/projects/*` |
| Trang tạo video | `src/components/create/*`, `src/components/VoicePicker.tsx` |
| Trình chỉnh sửa video | `src/components/editor/*` |
| Hồ sơ | `src/components/account/*`, `src/app/[locale]/(app)/account/page.tsx` |
| Gói/hạn mức, API, thương hiệu, thành viên, batch, admin | `src/components/{BillingPanel,ApiSettings,BrandKitEditor,MembersPanel,BatchesPanel,BatchProgress,AdminPlans}.tsx` |
| Thành phần dùng chung (tiêu đề trang, trạng thái rỗng, thẻ nâng cấp, huy hiệu trạng thái…) | `src/components/common/*` |
| Nút, ô nhập, thẻ, hộp thoại… (shadcn) | `src/components/ui/*` |
| Chữ hiển thị (tiếng Việt và tiếng Anh) | `apps/web/messages/vi.json` và `en.json` |
| Đường dẫn trang | `src/app/[locale]/(marketing)`, `(auth)`, `(app)` |

Quy ước bắt buộc (ESLint sẽ báo lỗi nếu vi phạm):

- Màu chỉ dùng token (`bg-background`, `text-muted-foreground`, `border-input`, `bg-primary`…), không viết `#fff`,
  `rgb(...)`, `bg-[#...]`.
- Không viết chữ cứng trong JSX: dùng `useTranslations()` (client) hoặc `getTranslations()` (server) và thêm khóa vào cả
  `vi.json` lẫn `en.json`. Test `messages.test.ts` kiểm tra hai file khớp khóa.
- Icon dùng `lucide-react`.

## 3. Đổi theme (màu, bo góc)

Mở `globals.css`. Mỗi token có hai giá trị: `:root` (sáng) và `.dark` (tối). Màu dùng `oklch(...)`. Có thể tạo theme mới
bằng https://tweakcn.com rồi dán phần `:root`/`.dark` vào, giữ nguyên tên biến.

Sau khi đổi màu, chạy kiểm tra độ tương phản. Nó fail nếu chữ khó đọc (cần ≥ 4,5:1, viền ô nhập ≥ 3:1):

```bash
pnpm --filter @makvid/web test tokens-contrast
```

Muốn thêm hoặc đổi thành phần shadcn:

```bash
cd apps/web
pnpm dlx shadcn@latest add <tên>      # ví dụ: switch, calendar, scroll-area
```

Các file trong `src/components/ui` là bản sao vào repo, được phép sửa trực tiếp.

## 4. Dữ liệu mẫu để nhìn giao diện đầy đủ

Trang danh sách dự án trống thì khó chỉnh. Thêm 30 dự án giả cho tài khoản của bạn (thay email):

```bash
docker exec makvid-dev-postgres-1 psql -U makvid -d makvid -c "
INSERT INTO projects (workspace_id, title, status, primary_aspect, created_by)
SELECT m.workspace_id, 'Video số ' || g,
       (ARRAY['ready','failed','rendering','draft'])[1 + g % 4],
       CASE WHEN g % 2 = 0 THEN '9:16' ELSE '16:9' END, m.user_id
FROM memberships m JOIN users u ON u.id = m.user_id, generate_series(1, 30) g
WHERE u.email = 'toi@example.test';"
```

Dự án giả không có video. Để có trang chỉnh sửa đầy đủ (player, cảnh, chat), tạo một video thật ở `/projects/new`;
với `dev:mock` mất khoảng 1 đến 2 phút và không tốn tiền.

Muốn xem các màn hình theo vai trò: mời người thứ hai ở `/workspace/members`, mở link mời bằng cửa sổ ẩn danh.
Trang `/admin` chỉ hiện với quản trị nền tảng:

```bash
docker exec makvid-dev-postgres-1 psql -U makvid -d makvid -c "UPDATE users SET is_platform_admin = true WHERE email = 'toi@example.test';"
```

## 5. Mẹo khi chỉnh

- **Sáng/tối:** nút mặt trăng/mặt trời ở thanh trên. Hoặc DevTools → Rendering → Emulate CSS `prefers-color-scheme`.
- **Ngôn ngữ:** nút VI/EN; `/en/...` là tiếng Anh, không có tiền tố là tiếng Việt. Chuỗi tiếng Việt dài hơn nên hay làm vỡ
  bố cục: luôn thử cả hai.
- **Điện thoại:** DevTools → chế độ thiết bị, chiều rộng 360 px. Không được cuộn ngang.
- **Class Tailwind:** cài tiện ích "Tailwind CSS IntelliSense" cho VS Code để gợi ý class và hiện màu token.
- **Kiểm tra nhanh trước khi commit:**

```bash
pnpm --filter @makvid/web typecheck
pnpm --filter @makvid/web lint
pnpm --filter @makvid/web test
```

- **Chụp ảnh nhiều trang cùng lúc** (sáng/tối × vi/en × 1280/360, tự đăng ký tài khoản):

```bash
SCREENS_AUTH=1 SCREENS_PHASE=thu SCREENS_PAGES="/,/projects/new,/account" pnpm --filter @makvid/web test:e2e e2e/screens.spec.ts
```

  Ảnh nằm ở `docs/reports/ui/thu/` (file PNG bị git bỏ qua).
- **Kiểm tra truy cập (axe):** `pnpm --filter @makvid/web test:e2e e2e/a11y.spec.ts` (cần stack đang chạy).

## 6. Biến môi trường tối thiểu cho `.env`

`pnpm dev:mock` cần những biến này (xem `.env.example` để biết giá trị mẫu):

```
DATABASE_URL=postgres://makvid:<mật khẩu>@127.0.0.1:5432/makvid
VALKEY_URL=redis://127.0.0.1:6379
S3_ENDPOINT=http://127.0.0.1:8333
S3_ACCESS_KEY_ID=...   S3_SECRET_ACCESS_KEY=...   (khớp compose.dev.yml)
BETTER_AUTH_SECRET=<chuỗi ngẫu nhiên dài>
MAKVID_SECRET_KEY=<chuỗi ngẫu nhiên dài>
```

Nên dùng `127.0.0.1` thay cho `localhost`, xem mục dưới.

## 7. Gặp lỗi thì xem

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Đăng ký/đăng nhập báo lỗi 500, log có `CONNECT_TIMEOUT localhost:5432` | Trên Windows, WSL có thể trả lời ở `localhost` (IPv6) thay cho Docker. Dùng `127.0.0.1` trong `DATABASE_URL` và `S3_ENDPOINT`. Kiểm tra: `netstat -ano \| findstr :5432` mà thấy tiến trình `wslrelay.exe` ở `[::1]` là dính lỗi này. |
| Video tạo mãi không xong, log worker nhắc Redis 6.0 | Cần Redis/Valkey từ 6.2. Dùng Valkey của `compose.dev.yml` (7.x) và trỏ `VALKEY_URL` vào đó; tắt Redis cũ trên máy. |
| Cổng 3000 đã bị dùng | Dừng stack Docker đầy đủ (`docker compose -f docker/compose.yml down`) hoặc đổi cổng như mục 1. |
| Đăng nhập xong bị đá về trang đăng nhập | `BETTER_AUTH_URL`/`APP_URL` không khớp địa chỉ bạn đang mở (cổng khác, hoặc `127.0.0.1` thay vì `localhost`). |
| Trang trắng, console báo `useEffect must not return anything…` | Trong `useEffect`, đừng viết `useEffect(() => setX(1), [])`; viết `useEffect(() => { setX(1); }, [])`. |
| Giao diện hỏng kỳ lạ sau khi đổi nhiều file | Dừng dev, xóa `apps/web/.next`, chạy lại. |
| Windows báo không đổi tên/di chuyển được thư mục `src/app/...` | Dừng `dev:mock` trước khi di chuyển thư mục trang. |
| Video không phát trong trình duyệt tự động hóa | Chrome headless của test không giải mã H.264; trình duyệt thật thì phát bình thường. |

## 8. Việc nên biết thêm

- Đang sửa thì cứ để `pnpm dev:mock` chạy; chỉ khởi động lại khi đổi `.env`, đổi `package.json` hoặc thêm migration
  (`pnpm db:migrate`).
- Không có Storybook; mỗi trang xem trực tiếp trên app. Danh sách trang và bố cục chuẩn nằm ở
  `specs/002-saas-ui-revamp/contracts/ui-routes.md` và `ui-conventions.md`.
- Báo cáo từng giai đoạn giao diện và ảnh chụp: `docs/reports/UI-G1.md` đến `UI-G4.md`.
