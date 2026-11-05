# Platform Makvid Studio

Kiến trúc đa dịch vụ gồm 3 folder độc lập, hoạt động trên các PORT riêng biệt không xung đột, tích hợp theme **clo.nz** từ [tweakcn](https://tweakcn.com/themes/cmn3m3u33000304jv273s7eu5):

| Service | Thư mục | Port Host | Công nghệ & Theme |
|---|---|---|---|
| **Frontend** | [`frontend/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend) | **`3002`** | Next.js 16, Tailwind v4, shadcn/ui, **Font: Inter (local)**, **Theme: clo.nz** |
| **Backend** | [`backend/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/backend) | **`3001`** | NestJS v12 (TypeScript ESM, TypeORM, Swagger, Vitest) |
| **Database** | [`database/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/database) | **`5432`** | PostgreSQL 16 (Docker) |
| **DB Admin** | [`database/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/database) | **`5050`** | pgAdmin 4 (Web UI) |

---

## 🏗️ Cấu trúc Layout, Common Components & Function Utils

### 1. Layout Header & Sidebar ([`frontend/src/components/layout/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend/src/components/layout))
- **`AppLayout`**: Bọc toàn bộ ứng dụng với `SidebarProvider` và `SidebarInset`.
- **`AppSidebar`**:
  - Logo & tiêu đề Studio.
  - Menu điều hướng đa cấp (Trang chủ `/`, Thông tin hệ thống `/infor`).
  - Lối tắt công cụ ngoài (Swagger Docs, pgAdmin UI).
  - Thẻ hiển thị trạng thái real-time các Host (FE 3002, BE 3001, DB 5432).
  - User profile ở footer sidebar.
- **`AppHeader`**:
  - `SidebarTrigger` thu phóng thanh điều hướng linh hoạt (Desktop & Mobile).
  - Breadcrumb định vị vị trí trang hiện tại.
  - Ô tìm kiếm nhanh với phím tắt `⌘K`.
  - Nút chuyển đổi Dark/Light mode (`ThemeToggle`) và Menu người dùng (`DropdownMenu`).

### 2. Common Components ([`frontend/src/components/common/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend/src/components/common))
- **`PageHeader`**: Tiêu đề trang, breadcrumbs điều hướng, mô tả và vùng chứa action buttons.
- **`StatCard`**: Thẻ hiển thị chỉ số KPI, xu hướng tăng/giảm (trend up/down), icon và mô tả.
- **`StatusBadge`**: Huy hiệu trạng thái với chấm tròn nhấp nháy (pulse dot) theo các biến thể: `success`, `warning`, `error`, `info`, `neutral`.
- **`EmptyState`**: Khung hiển thị trạng thái rỗng kèm icon, thông điệp và nút hành động.
- **`LoadingSpinner` & `PageLoading`**: Hiệu ứng xoay nạp dữ liệu màu cam đất theo theme `clo.nz`.
- **`ConfirmDialog`**: Hộp thoại cảnh báo/xác nhận (Alert Dialog) có thể dùng cho tác vụ xóa hoặc cập nhật.

### 3. Function Utils ([`frontend/src/lib/`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend/src/lib))
- **[`utils.ts`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend/src/lib/utils.ts)**:
  - `cn(...)`: Hợp nhất className của Tailwind CSS.
  - `formatDate`, `formatDateTime`, `formatRelativeTime` (e.g. "Vừa xong", "5 phút trước").
  - `formatNumber`, `formatCurrency` (VND, USD, EUR), `formatCompactNumber` (1.5K, 2.3M).
  - `truncate`: Cắt ngắn văn bản dài kèm `...`.
  - `slugify`: Chuyển chuỗi tiếng Việt thành slug URL an toàn.
  - `getInitials`: Trích xuất chữ cái đại diện từ tên (e.g. "Makvid Studio" -> "MS").
  - `copyToClipboard`: Sao chép văn bản vào clipboard an toàn trên mọi trình duyệt.
  - `sleep`: Hàm delay hỗ trợ tác vụ bất đồng bộ.
- **[`api.ts`](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/frontend/src/lib/api.ts)**:
  - Client gọi API tự động gắn base URL từ `NEXT_PUBLIC_API_URL` (mặc định port 3001).
  - Hỗ trợ các phương thức tiện lợi: `api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`.
  - Xử lý lỗi tập trung qua class `ApiError`.

---

## 🎨 Theme: clo.nz (tweakcn)

Theme được trích xuất trực tiếp từ [tweakcn.com/themes/cmn3m3u33000304jv273s7eu5](https://tweakcn.com/themes/cmn3m3u33000304jv273s7eu5) với phong cách **Warm Minimal**:
- **Light Mode**:
  - Background: `#F6F1E8` (Tone be ấm áp)
  - Foreground: `#191A1E` (Đen than tinh tế)
  - Card/Popover: `#FBF7F0`
  - Secondary/Muted: `#E9DED0` / `#EEE6D9`
  - Ring/Accent: `#D97841` (Cam đất sang trọng)
  - Border/Input: `#D9D2C7`
- **Dark Mode**:
  - Background: `#191A1E`
  - Foreground: `#F6F1E8`
  - Card/Popover: `#232429`
  - Secondary/Muted: `#3A3228` / `#2D2E33`
  - Ring/Accent: `#D97841`
  - Border/Input: `#2D2E33`
- Đã cài đặt **`next-themes`** và nút chuyển đổi Sáng/Tối trực tiếp ở góc phải header.

---

## 🚀 Hướng dẫn khởi chạy từng dịch vụ

### 1. Khởi động Database Host (PostgreSQL & pgAdmin)
```bash
cd database
docker compose up -d
```
- PostgreSQL: `localhost:5432` (user: `postgres`, password: `postgrespassword`, db: `makvid_studio_db`)
- pgAdmin 4: [http://localhost:5050](http://localhost:5050) (email: `admin@admin.com`, password: `admin`)

### 2. Khởi động Backend API (NestJS - Port 3001)
Mở một terminal mới:
```bash
cd backend
npm run start:dev
```
- Server chạy tại: [http://localhost:3001](http://localhost:3001)
- **Tài liệu Swagger API**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- Endpoint test kết nối DB: [http://localhost:3001/api/status](http://localhost:3001/api/status)

### 3. Khởi động Frontend Web (NextJS - Port 3002)
Mở một terminal khác:
```bash
cd frontend
npm run dev
```
- Web Client chạy tại: [http://localhost:3002](http://localhost:3002)
- **Trang thông tin hệ thống**: [http://localhost:3002/infor](http://localhost:3002/infor)
