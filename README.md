# MakVid Studio

Tạo video ngắn tiếng Việt bằng AI: từ một ý tưởng, kịch bản, bài báo, kho GitHub, bảng số liệu hoặc file
âm thanh/video → kịch bản → phân cảnh HTML/GSAP theo 13 phong cách → giọng đọc + phụ đề khớp từng từ +
nhạc → MP4 ở 4 khung hình (9:16, 16:9, 1:1, 4:5). Sửa bằng lời trong trình duyệt, tạo hàng loạt từ CSV,
API công khai có webhook.

- Đặc tả và kế hoạch: [specs/001-ai-video-saas](specs/001-ai-video-saas/) · Quyết định: [docs/decisions](docs/decisions/)
- Báo cáo từng mốc: [docs/reports](docs/reports/) · Vận hành: [docs/ops/runbook.md](docs/ops/runbook.md)
- Hướng dẫn cho agent lập trình: [AGENTS.md](AGENTS.md)

## Cài đặt và chạy (một lệnh)

Cùng các bước trên **Windows 11** và **Linux**. Kết quả: web ở `http://localhost:3000`, cơ sở dữ liệu,
hàng đợi, kho lưu trữ, 3 loại worker và job sao lưu chạy trong Docker.

### 1. Chuẩn bị

|        | Windows 11                                                                                                                            | Linux (Ubuntu 24.04 hoặc tương tự)                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Docker | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) với WSL 2; Settings → Resources: ≥ 6 CPU, ≥ 8 GB RAM | Docker Engine + Compose plugin: `curl -fsSL https://get.docker.com \| sh` rồi `sudo usermod -aG docker $USER` (đăng nhập lại) |
| Git    | [Git for Windows](https://git-scm.com/download/win)                                                                                   | `sudo apt-get install -y git`                                                                                                 |
| Máy    | 8 CPU / 16 GB RAM khuyến nghị (1 worker render chuẩn, ADR 0003); 4 CPU / 8 GB chạy được, render chậm hơn                              | như bên trái                                                                                                                  |

### 2. Lấy mã nguồn và tạo file cấu hình

```bash
git clone <địa chỉ repo> makvid-studio
cd makvid-studio
cp .env.example .env
```

Mở `.env` và **đổi các giá trị bí mật** (mỗi giá trị là một chuỗi ngẫu nhiên dài ≥ 32 ký tự, ví dụ tạo
bằng `openssl rand -base64 32` hoặc trong PowerShell
`[Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))`):

| Biến                                               | Bắt buộc          | Ghi chú                                                                                     |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`                                | ✅                | mật khẩu cơ sở dữ liệu                                                                      |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`         | ✅                | khoá kho lưu trữ (SeaweedFS)                                                                |
| `BETTER_AUTH_SECRET`                               | ✅                | ký phiên đăng nhập                                                                          |
| `MAKVID_SECRET_KEY`                                | ✅                | mã hoá secret webhook, chống lạm dụng gói miễn phí                                          |
| `FPT_AI_API_KEY`                                   | để tạo video thật | khoá FPT AI Marketplace (AI viết kịch bản + giọng đọc)                                      |
| `MAKVID_MOCK_PROVIDERS=1`                          | tuỳ chọn          | chạy thử toàn bộ **không tốn tiền** (AI, giọng và render giả)                               |
| `APP_URL`, `BETTER_AUTH_URL`, `S3_PUBLIC_ENDPOINT` | khi có tên miền   | địa chỉ người dùng truy cập, ví dụ `https://app.example.com` và `https://files.example.com` |
| `MAKVID_PAYMENTS`, `POLAR_*`, `PAYOS_*`            | khi bán gói       | xem [ADR 0004](docs/decisions/0004-payment-gateway.md)                                      |
| `METRICS_TOKEN`                                    | tuỳ chọn          | bật `/api/metrics` cho Prometheus                                                           |

Không bao giờ commit file `.env` (đã nằm trong `.gitignore`).

### 3. Khởi động

```bash
docker compose up -d --build
```

Lần đầu mất 10–20 phút (tải image, cài thư viện, build web). Kiểm tra:

```bash
docker compose ps
```

Mọi dịch vụ phải ở trạng thái `running` / `healthy` (`migrate` chạy một lần rồi `exited (0)`). Mở
`http://localhost:3000`, đăng ký tài khoản và tạo video đầu tiên.

### 4. Việc thường làm

```bash
docker compose logs -f web worker-render          # xem nhật ký
docker compose up -d --scale worker-render=3       # thêm máy render (chia cảnh cho mọi worker)
docker compose run --rm backup /backup/backup.sh   # sao lưu ngay (mặc định mỗi ngày, giữ 14 ngày, ở ./backups)
docker compose run --rm backup /backup/restore-test.sh   # thử khôi phục bản sao lưu mới nhất
docker compose pull && docker compose up -d --build      # cập nhật sau khi git pull
docker compose down                                # dừng (dữ liệu vẫn còn trong volume)
```

Trên Windows, chạy các lệnh trên trong PowerShell. Nếu dùng Git Bash, thêm `MSYS_NO_PATHCONV=1` trước lệnh `docker compose run … /backup/...` để đường dẫn không bị đổi.

Quản trị nền tảng: đặt một tài khoản làm quản trị viên rồi mở `/admin`:

```bash
docker compose exec postgres psql -U makvid -d makvid -c "UPDATE users SET is_platform_admin = true WHERE email = 'ban@example.com'"
```

Chạy trên VPS có tên miền: đặt một reverse proxy có HTTPS (Caddy, Nginx, Traefik) trước cổng 3000 (web)
và 8333 (tải file), chi tiết ở [runbook](docs/ops/runbook.md).

## Phát triển

```bash
pnpm install                                       # Node ≥ 22.12, pnpm 12
docker compose -f docker/compose.dev.yml up -d     # postgres, valkey, seaweedfs (+ worker-align)
pnpm db:migrate
pnpm dev:mock                                      # web + 3 worker, nhà cung cấp giả (không tốn tiền)
pnpm typecheck && pnpm lint && pnpm test           # kiểm tra trước khi commit
```

Các lệnh và bộ test đầy đủ (render, golden frame, E2E, tích hợp): [AGENTS.md](AGENTS.md).

## Giấy phép thành phần

Mọi thư viện, font, nhạc, hiệu ứng dùng được cho SaaS thương mại mã nguồn đóng; kiểm tra tự động bằng
`pnpm license:check`. GSAP dùng theo giấy phép "no charge" của Webflow, đã có xác nhận bằng văn bản
([ADR 0001](docs/decisions/0001-gsap-license.md)).
