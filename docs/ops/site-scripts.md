# Quản trị site bằng `./manage.sh`

Một script duy nhất, chạy từ thư mục gốc của repo (Linux, macOS, hoặc Git Bash/WSL trên Windows). Cần `git`, `docker`
(compose v2) và file `.env` đã điền. Nếu `.env` có `TUNNEL_TOKEN` thì script tự dùng `compose.tunnel.yaml`, ngược lại
dùng `compose.yaml`.

```bash
./manage.sh          # mở menu lựa chọn
./manage.sh help     # danh sách lệnh
```

## Menu

Chạy `./manage.sh` không có tham số sẽ mở menu số: xem log trực tiếp (tất cả hoặc một dịch vụ), lọc lỗi, trạng thái,
cập nhật từ git, bật/tắt/khởi động lại, sao lưu, cấp quyền quản trị, shell cơ sở dữ liệu, dọn dẹp. Trong màn hình log,
**Ctrl+C quay về menu** (không thoát script). Các lệnh nguy hiểm (tắt site, cập nhật, khởi động lại) hỏi xác nhận `y/N`.

## Việc hay dùng

| Việc                               | Lệnh                             |
| ---------------------------------- | -------------------------------- |
| Lấy code mới (nếu có) và build lại | `./manage.sh update`             |
| Bật site                           | `./manage.sh start`              |
| Tắt site (giữ dữ liệu)             | `./manage.sh stop`               |
| Khởi động lại một dịch vụ          | `./manage.sh restart worker-ai`  |
| Xem trạng thái + kiểm tra URL      | `./manage.sh status`             |
| Xem log (theo dõi liên tục)        | `./manage.sh logs worker-ai 300` |
| Chỉ các dòng lỗi gần đây           | `./manage.sh errors`             |
| Sao lưu DB ngay                    | `./manage.sh backup`             |
| Cấp quyền quản trị                 | `./manage.sh admin a@b.com`      |
| Quay về bản cũ                     | `./manage.sh rollback <commit>`  |

## `update` làm gì

1. Thử kéo code: `git fetch` + `git merge --ff-only origin/<nhánh hiện tại>`. Nếu không kéo được (có sửa đổi chưa commit, đang ở detached HEAD, mất mạng, hoặc commit cục bộ lệch với origin) thì chỉ cảnh báo và dùng code hiện có trên đĩa.
2. **Luôn build lại** và khởi động lại với code hiện tại, kể cả khi không có commit mới (Docker dùng cache nên nhanh nếu không có gì đổi).
3. Có commit mới thì in danh sách commit, cảnh báo nếu `.env.example` đổi (cần xem biến mới trong `.env`).
4. `docker compose up -d --build --remove-orphans` (migration chạy trước khi web khởi động), chờ web "healthy".
5. Nếu bản mới không healthy, script báo lệnh `rollback` về commit trước đó. Rollback **không hoàn tác migration**.

Một khóa `.site-update.lock` ngăn hai lần update chạy cùng lúc (ví dụ cron và người).

## Tự động cập nhật (tùy chọn)

Trên server Linux, mỗi 10 phút kiểm tra code mới:

```cron
*/10 * * * * cd /srv/makvid-studio && ./manage.sh update >> /var/log/makvid-update.log 2>&1
```

Chỉ nên bật khi nhánh đang theo dõi (thường là `main`) luôn qua CI xanh.

## Lưu ý

- `stop` và `down` không xóa volume (database, kho tệp). Script không có lệnh xóa dữ liệu.
- `prune` chỉ dọn image treo và cache build, không đụng đến volume.
- `psql` và `shell <dịch vụ>` mở shell tương tác trong container.
