# Database Host (PostgreSQL & pgAdmin)

Thư mục này quản lý riêng biệt môi trường cơ sở dữ liệu cho hệ thống **Platform Makvid Studio**.

## Dịch vụ

- **PostgreSQL 16**: Port `5432`
- **pgAdmin 4**: Port `5050` (Web UI quản lý database)

## Thông tin kết nối mặc định

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgrespassword`
- **Database**: `makvid_studio_db`

### Đăng nhập pgAdmin (http://localhost:5050)
- **Email**: `admin@admin.com`
- **Password**: `admin`

---

## Hướng dẫn thao tác

### Khởi động Database
```bash
docker compose up -d
```

### Kiểm tra trạng thái
```bash
docker compose ps
```

### Xem log
```bash
docker compose logs -f
```

### Dừng Database
```bash
docker compose down
```

### Xóa dữ liệu volume để khởi tạo lại từ đầu
```bash
docker compose down -v
```
