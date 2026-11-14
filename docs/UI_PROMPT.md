Nâng cấp UX/UI MakVid Studio thành web SaaS hoàn chỉnh

## 1. Vai trò và nhiệm vụ

Bạn là senior frontend engineer kiêm product designer, chuyên Next.js App Router, Tailwind CSS và shadcn/ui. Nhiệm vụ: nâng cấp toàn bộ giao diện của MakVid Studio (nền tảng SaaS tạo video AI từ HTML animation) thành một web SaaS hoàn chỉnh, hiện đại, nhất quán. Có giao diện sáng/tối và nút chuyển ngôn ngữ Việt/Anh.

**Chỉ thay đổi tầng giao diện.** Không sửa logic nghiệp vụ, API, schema DB, auth, pipeline render. Nếu một màn hình cần dữ liệu mà backend chưa có, làm UI với trạng thái rỗng hoặc "sắp ra mắt", không tạo dữ liệu giả trông như thật, và ghi lại vào báo cáo.

## 2. Hiện trạng (đã quan sát tại http://localhost:3000)

**Nền tảng chung**

- Next.js App Router (Turbopack). Tiếng Việt là ngôn ngữ mặc định, **không có tiền tố** (`/projects/new`). Tiếng Anh có tiền tố `/en` (`/en/projects/new`). Truy cập `/vi/...` sẽ tự chuyển về đường dẫn không tiền tố. Giữ nguyên quy ước này.
- CSS viết tay với các class như `shell`, `topbar`, `brand`, `card stack`, `btn primary`, `small`. **Chưa có Tailwind.** Chỉ có giao diện tối, không có nút đổi theme.
- Đổi ngôn ngữ hiện là một link chữ ("Tiếng Việt" / "English") nằm cạnh nút Đăng xuất.

**Khi chưa đăng nhập**

- Trang chủ chỉ có một card: tiêu đề, một dòng mô tả, nút Đăng ký / Đăng nhập.
- Trang đăng ký và đăng nhập: form trong một card hẹp, căn trái, phần còn lại của màn hình trống.

**Khi đã đăng nhập** (route có thật, tên hiển thị tiếng Anh)

| Route | Tên menu | Hiện trạng |
| --- | --- | --- |
| `/` | Projects | Trang chủ biến thành danh sách dự án: chỉ có tên và nhãn trạng thái "Ready", không thumbnail, không ngày tạo, không tìm kiếm/lọc |
| `/projects/new` | Create video | Một form dài: 6 thẻ chọn nguồn nội dung, ô ý tưởng, tỷ lệ khung hình, độ dài (giây), chế độ Tự động / Duyệt từng bước, và **21 thẻ giọng đọc** chia 3 nhóm (Standard, Pro, Ultra), mỗi thẻ có nút "▶ Listen". Không có bước chọn phong cách, nhạc hay phụ đề trên form này |
| `/projects/[id]` | — | Các card xếp dọc: Preview (thẻ `<video>` mặc định, khung 16:9 cho cả video 9:16), Scenes (nút "Scene 1…7" chỉ có chữ), Downloads (Video 9:16, Subtitles .srt, Thumbnail), Save as template, Edit by chatting (textarea + Send, Undo, Redo, Duplicate project), Version history |
| `/workspace/brand` | Brand | Brand kit: tên, 6 màu (color picker gốc của trình duyệt), logo + vị trí, upload logo, font tiêu đề và font nội dung (select + input file gốc), có khung preview chữ tiếng Việt |
| `/workspace/assets` | Library | Thư viện tài nguyên, hiện chỉ có dòng trạng thái rỗng |
| `/batches` | Batch | Tạo hàng loạt từ CSV + template; có trạng thái rỗng |
| `/workspace/members` | Members | Danh sách thành viên + vai trò, form mời (email + vai trò) |
| `/workspace/billing` | Plan & usage | Gói hiện tại, kỳ tính phí, mức dùng dạng chữ "2 / 3", "1350 / 6000", 3 thẻ gói Free / Starter / Pro, dòng "No payment method is enabled yet" |
| `/workspace/api` | API | API keys (ô tên + Create key), Webhooks (ô URL + Add webhook), link API docs, ghi chú "The API is available on paid plans" |

Không có trang admin (`/admin` trả 404 khi đã đăng nhập). Không có trang cài đặt hồ sơ cá nhân.

**Vấn đề UX đã thấy (phải sửa)**

1. **Điều hướng:** 8 link menu, tên người dùng, nút Đăng xuất, link ngôn ngữ dồn trên một thanh ngang. Ở màn hình 375px thanh này xuống thành 4 dòng, chiếm gần 1/3 màn hình. Không có trạng thái "đang ở trang nào". Nút Đăng xuất nổi bật hơn cả menu.
2. **Độ rộng nội dung không nhất quán:** mỗi trang một kiểu (card hẹp, card full, danh sách trần).
3. **Trình chỉnh sửa dự án:** preview video 9:16 nằm trong khung ngang, phần lớn là nền đen; video không tải được thì vẫn hiện player trống, không có thông báo lỗi hay ảnh poster. Nút cảnh chỉ có chữ, không thumbnail. Chat sửa video nằm tận cuối trang, sau phần tải về. Undo/Redo/Duplicate trộn chung với nút Send.
4. **Form tạo video:** quá dài. 21 thẻ giọng đọc chiếm nhiều màn hình, tên trùng giữa các nhóm (Banmai, Kimngan… xuất hiện 2–3 lần) mà không giải thích khác nhau thế nào (chất lượng, giá). Không có tóm tắt hay ước tính quota trước khi bấm "Create video".
5. **Mức dùng và gói:** mức dùng chỉ là chữ, không có thanh tiến độ hay cảnh báo khi gần hết (đang dùng 2/3 video). Gói Free hiển thị "0" không có đơn vị. Trang API ghi "chỉ có ở gói trả phí" nhưng vẫn cho nhập tên key và bấm tạo, đáng lẽ phải khóa và hiện nút nâng cấp.
6. **Thành phần gốc của trình duyệt:** color picker, select, input file, video player chưa được style, nhìn lệch so với phần còn lại.
7. **Trạng thái rỗng** chỉ là một dòng chữ, chưa có minh họa và nút hành động.
8. **Không có trang công khai đúng nghĩa** (landing, pricing) cho người chưa đăng nhập.

**Bạn vẫn phải tự đọc mã nguồn** để xác nhận danh sách route, component và tính năng backend trước khi lên plan. Bảng trên chỉ là những gì quan sát được từ trình duyệt.

## 3. Cách làm việc

1. **Khảo sát trước, chưa sửa code.** Đọc cấu trúc `app/`, cách i18n đang làm (thư viện nào, file messages ở đâu), auth, CSS hiện tại, các API mà UI đang gọi.
2. **Viết `docs/UI_PLAN.md`** gồm: danh sách route hiện có và route sẽ thêm, sơ đồ layout (marketing / auth / app), danh sách component shadcn sẽ dùng, thứ tự migrate, rủi ro. **Dừng lại chờ tôi duyệt.**
3. Làm theo các giai đoạn ở mục 9. Hết mỗi giai đoạn: chạy app, chụp màn hình sáng/tối × Việt/Anh × desktop/mobile, báo cáo, chờ duyệt.
4. Kiểm chứng tài liệu mới nhất của Tailwind, shadcn/ui, next-themes và thư viện i18n đang dùng trước khi cài. Không dựa vào trí nhớ về cú pháp.
5. Trao đổi với tôi bằng tiếng Việt. Code và commit viết bằng tiếng Anh.

## 4. Nền tảng: Tailwind + shadcn/ui + theme "poppy-1"

- Cài Tailwind CSS (bản mới nhất mà shadcn/ui hỗ trợ chính thức) và chạy `shadcn init` cho Next.js App Router, dùng CSS variables.
- Cài theme từ tweakcn bằng registry:

  ```
  npx shadcn@latest add https://tweakcn.com/r/themes/cmlmbzwyz000004l72j9s6i76
  ```

  Nếu lệnh không chạy được, dán thủ công bộ token ở **Phụ lục A** vào `globals.css`.
- **Font:** theme dùng Plus Jakarta Sans (sans), DM Sans (serif), Space Mono (mono). Nạp bằng `next/font/google` với subset `vietnamese` + `latin`. Kiểm tra từng font có hỗ trợ đầy đủ tiếng Việt không (chữ Ẩ, Ỹ, Ự, ặ, ở…). Font nào không hỗ trợ thì thay bằng font gần giống có tiếng Việt (ví dụ Be Vietnam Pro), rồi ghi lại trong báo cáo.
- Xóa dần CSS viết tay cũ. Cuối cùng không còn class `shell`, `topbar`, `card`, `btn`… Mọi màu, bo góc, bóng đổ lấy từ token của theme, **không hard-code mã màu**.
- **Lưu ý tương phản của theme:** chế độ sáng có `--border` màu đen thuần, chế độ tối có `--input` màu trắng. Kiểm tra các ô input, card, bảng có bị viền quá gắt không. Nếu cần, chỉ chỉnh token trong `globals.css` (không chỉnh từng component), đạt chuẩn tương phản WCAG AA, và báo lại thay đổi.

## 5. Giao diện sáng/tối

- Dùng `next-themes` với `attribute="class"`. Có 3 lựa chọn: Sáng / Tối / Theo hệ thống. Mặc định theo hệ thống.
- Nút đổi theme (icon mặt trời/mặt trăng, menu 3 lựa chọn) có ở header trang công khai và topbar trong app.
- Không bị nháy sai theme khi tải trang, không có cảnh báo hydration. Lựa chọn được ghi nhớ.
- Mọi màn hình, kể cả biểu đồ, player preview, toast, dialog, email preview (nếu có), đều đẹp ở cả hai chế độ.

## 6. Đa ngôn ngữ

- Thay link chữ "Tiếng Việt" bằng **nút chuyển ngôn ngữ** (shadcn `DropdownMenu`, icon quả địa cầu + mã `VI`/`EN`, mỗi mục ghi tên ngôn ngữ bằng chính ngôn ngữ đó: "Tiếng Việt", "English").
- Đổi ngôn ngữ thì **giữ nguyên trang đang xem** (ví dụ `/en/projects/123` → `/projects/123`, vì tiếng Việt là mặc định không có tiền tố), giữ query string, và ghi nhớ lựa chọn (cookie).
- Có mặt ở header công khai, trang auth, topbar trong app và trang cài đặt tài khoản.
- Dùng tiếp thư viện i18n đang có. **Không để chữ cứng trong component.** Mọi chuỗi mới phải có ở cả file messages tiếng Việt và tiếng Anh. Thêm script hoặc test báo lỗi khi một key thiếu ở một ngôn ngữ.
- Định dạng ngày, số, tiền tệ theo locale. Kiểm tra layout không vỡ khi chữ tiếng Việt dài hơn tiếng Anh.

## 7. Layout SaaS hoàn chỉnh

### 7.1 Khu công khai (marketing)

- **Header dính trên cùng:** logo, menu (Tính năng, Phong cách, Bảng giá, Tài liệu API), bên phải là nút ngôn ngữ, nút theme, "Đăng nhập", nút chính "Dùng thử miễn phí". Trên mobile thu vào menu dạng `Sheet`.
- **Landing page** gồm các khối theo thứ tự:
    1. Hero: tiêu đề rõ giá trị, mô tả ngắn, 2 nút CTA, kèm khung video demo hoặc ảnh động mô phỏng trình chỉnh sửa.
    2. Cách hoạt động trong 3 bước: Nhập ý tưởng → AI dựng video → Xuất MP4.
    3. Thư viện phong cách: lưới các style kèm thumbnail.
    4. Tính năng nổi bật: giọng đọc tiếng Việt, phụ đề kiểu TikTok, nhiều tỷ lệ khung hình, tạo hàng loạt, API.
    5. Các trường hợp sử dụng: giáo dục, mạng xã hội, tin tức, giới thiệu repo.
    6. Bảng giá: 3 gói kèm bật/tắt tháng/năm. Lấy dữ liệu từ cấu hình nếu có, nếu chưa có thì để placeholder đánh dấu rõ.
    7. FAQ (`Accordion`).
    8. CTA cuối trang.
    9. Footer nhiều cột: sản phẩm, tài nguyên, pháp lý, ngôn ngữ, mạng xã hội.
- Trang riêng: `/pricing`. Trang 404 và trang lỗi có thiết kế đúng theme.

### 7.2 Trang xác thực

- Bố cục chia đôi trên desktop: bên trái là form, bên phải là panel thương hiệu (hình minh họa hoặc video ngắn, câu trích dẫn). Mobile chỉ hiện form.
- Form dùng shadcn `Form` (react-hook-form + zod nếu dự án chưa có cách khác): lỗi hiển thị ngay dưới ô, nút hiện/ẩn mật khẩu, trạng thái đang gửi, thông báo lỗi từ server dễ hiểu. Có nút "Tiếp tục với Google" nếu backend hỗ trợ.
- Có link qua lại giữa đăng nhập và đăng ký, và link quên mật khẩu nếu backend có.

### 7.3 Khu ứng dụng (sau đăng nhập)

- **App shell** dùng shadcn `Sidebar`, thu gọn được thành icon, nhớ trạng thái thu gọn.
    - Đầu sidebar: logo + bộ chọn workspace.
    - Nhóm menu, dùng đúng các route đang có: **Sáng tạo** — Dự án (`/`), Tạo video (`/projects/new`), Tạo hàng loạt (`/batches`); **Workspace** — Brand kit (`/workspace/brand`), Thư viện (`/workspace/assets`), Thành viên (`/workspace/members`); **Tài khoản** — Gói & mức dùng (`/workspace/billing`), API & webhooks (`/workspace/api`). Đánh dấu rõ mục đang mở. Không thêm mục cho tính năng backend chưa có (Admin, Cài đặt hồ sơ…); nếu thấy cần, đề xuất trong UI_PLAN.md.
    - Cuối sidebar: thanh hiển thị quota đã dùng, menu người dùng (hồ sơ, theme, ngôn ngữ, đăng xuất).
- **Topbar:** breadcrumb, ô tìm kiếm / command palette (`Command`, phím tắt Ctrl/Cmd+K), nút chính "Tạo video mới", chuông thông báo (job render xong hoặc lỗi), nút ngôn ngữ, nút theme.
- **Các màn hình chính:**
    - **Dự án (`/`, trang chính sau đăng nhập):** đầu trang có dải thẻ thống kê ngắn (video đã tạo, phút đã dùng / quota, lấy từ dữ liệu trang Gói & mức dùng). Bên dưới là danh sách dự án, chuyển qua lại giữa dạng lưới (thumbnail, tỷ lệ, ngày tạo, trạng thái) và dạng bảng. Có tìm kiếm, lọc theo trạng thái/tỷ lệ, sắp xếp, phân trang (những gì backend hỗ trợ). Dự án đang render hiện tiến độ. Có trạng thái rỗng kèm CTA.
    - **Tạo video mới (`/projects/new`):** giữ nguyên các trường và hành vi đang có, chỉ tổ chức lại cho gọn. Chia thành các bước rõ ràng (stepper hoặc các section có tiêu đề): (1) Nguồn nội dung + nội dung nhập; (2) Tỷ lệ khung hình (thẻ có hình minh họa tỷ lệ thay cho select) và độ dài (slider + ô số); (3) Giọng đọc; (4) Chế độ Tự động / Duyệt từng bước. Cuối form có thẻ tóm tắt lựa chọn và quota sẽ dùng, kèm nút "Tạo video".
    - **Chọn giọng đọc:** thay 21 thẻ bằng bộ lọc (Tabs theo chất lượng Standard / Pro / Ultra, lọc giới tính và vùng miền) + danh sách gọn. Mỗi giọng có nút nghe thử với trạng thái đang phát. Giải thích ngắn khác biệt giữa 3 nhóm. Nếu nhóm nào không có trong gói hiện tại, khóa và hiện nhãn gói cần nâng cấp (chỉ khi backend có thông tin này).
    - **Trình chỉnh sửa dự án (`/projects/[id]`):** bố cục 3 cột co giãn được (`Resizable`). Trái: danh sách cảnh (dùng thumbnail nếu backend có, nếu không thì số cảnh + đoạn lời đọc ngắn). Giữa: player preview **đúng tỷ lệ của video** (9:16 hiển thị dọc), có poster, có trạng thái đang tải và thông báo lỗi khi không tải được video. Phải: khung chat sửa video luôn nhìn thấy, Undo/Redo đặt ở thanh công cụ phía trên. Thanh công cụ trên cùng: tên dự án, nhãn trạng thái, nút "Tải về" (menu: Video, Phụ đề .srt, Thumbnail), menu "…" (Lưu thành template, Nhân bản dự án), nút Lịch sử phiên bản (mở `Sheet`). Nếu đang render thì hiện tiến độ các bước. Trên mobile, các cột chuyển thành tab.
    - **Gói & mức dùng:** mỗi chỉ số có thanh `Progress` và cảnh báo khi dùng trên 80%. Thẻ gói ghi rõ đơn vị giá (miễn phí / tháng), đánh dấu gói hiện tại, nút nâng cấp (vô hiệu hóa kèm giải thích khi chưa có phương thức thanh toán).
    - **API & webhooks:** khi gói hiện tại không có API, khóa form và hiện thẻ nâng cấp thay vì cho nhập rồi báo lỗi.
    - **Brand kit:** thay color picker, select và input file gốc của trình duyệt bằng component đúng theme (ô màu + mã hex, khu vực kéo-thả để upload). Giữ khung preview chữ tiếng Việt, đặt bên cạnh form trên desktop.
    - **Thanh toán & mức dùng, API keys, Cài đặt (hồ sơ, workspace, thành viên), Brand kit:** dùng `Card`, `Table`, `Tabs`, `Dialog` nhất quán.
- Trang con nào backend chưa hỗ trợ thì làm khung giao diện với trạng thái rỗng và nhãn "Sắp ra mắt", liệt kê lại trong báo cáo.

## 8. Yêu cầu chung về trải nghiệm

- **Đủ các trạng thái:** đang tải (`Skeleton`), rỗng (minh họa + CTA), lỗi (thông báo + nút thử lại), thành công. Thông báo dùng toast (`sonner`).
- **Responsive:** đẹp ở 360px, 768px, 1280px, 1536px. Không có thanh cuộn ngang.
- **Truy cập được:** điều hướng hoàn toàn bằng bàn phím, focus ring rõ ràng, label cho mọi ô nhập, `aria-label` cho nút chỉ có icon, tương phản WCAG AA ở cả hai theme, tôn trọng `prefers-reduced-motion`.
- **Chuyển động tinh tế:** hover/press trên nút và card, chuyển trang nhẹ nhàng. Không lạm dụng animation.
- **Nhất quán:** một thang khoảng cách, một kiểu tiêu đề trang (tiêu đề + mô tả + hành động bên phải), icon dùng một bộ duy nhất (lucide-react).
- **Hiệu năng:** dùng Server Components khi có thể, ảnh dùng `next/image`. Lighthouse trên trang chủ đạt từ 90 điểm trở lên ở Performance, Accessibility, Best Practices.

## 9. Các giai đoạn và tiêu chí nghiệm thu

**Giai đoạn 0 — Khảo sát và plan**
- Có `docs/UI_PLAN.md` đã được tôi duyệt.

**Giai đoạn 1 — Nền tảng**
- Tailwind + shadcn + theme poppy-1 + font + next-themes + nút ngôn ngữ chạy được.
- Nghiệm thu: đổi theme và ngôn ngữ ở mọi trang hiện có không lỗi; không nháy theme; không cảnh báo hydration; build và lint pass.

**Giai đoạn 2 — Khu công khai và trang xác thực**
- Landing, pricing, sign-in, sign-up, 404/lỗi.
- Nghiệm thu: ảnh chụp 2 theme × 2 ngôn ngữ × desktop/mobile; luồng đăng ký và đăng nhập vẫn hoạt động như cũ.

**Giai đoạn 3 — App shell và các màn hình chính**
- Sidebar, topbar, command palette, tổng quan, danh sách dự án, wizard tạo video, trình chỉnh sửa, cài đặt, thanh toán, API keys.
- Nghiệm thu: mọi luồng đang có (tạo dự án, xem tiến độ, sửa bằng chat, tải video…) vẫn chạy; mọi màn hình có đủ trạng thái tải/rỗng/lỗi.

**Giai đoạn 4 — Hoàn thiện**
- Xóa CSS cũ, kiểm tra truy cập, test thiếu key i18n, Playwright chụp màn hình các trang chính ở 2 theme × 2 ngôn ngữ, Lighthouse.
- Nghiệm thu: không còn class CSS cũ, không chữ cứng trong component, mọi test pass, có báo cáo Lighthouse.

## Phụ lục A — Token theme "poppy-1" (dự phòng khi lệnh registry không chạy)

Lấy từ registry của tweakcn. Tên biến theo chuẩn shadcn/ui.

```css
:root {
  --background: oklch(0.9789 0.0082 121.6272);
  --foreground: oklch(0 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.5106 0.2301 276.9656);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.7038 0.1230 182.5025);
  --secondary-foreground: oklch(1.0000 0 0);
  --muted: oklch(0.9551 0 0);
  --muted-foreground: oklch(0.3211 0 0);
  --accent: oklch(0.7686 0.1647 70.0804);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0.5555 0 0);
  --ring: oklch(0.7853 0.1041 274.7134);
  --chart-1: oklch(0.5106 0.2301 276.9656);
  --chart-2: oklch(0.7038 0.1230 182.5025);
  --chart-3: oklch(0.7686 0.1647 70.0804);
  --chart-4: oklch(0.6559 0.2118 354.3084);
  --chart-5: oklch(0.7227 0.1920 149.5793);
  --sidebar: oklch(0.9789 0.0082 121.6272);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0.5106 0.2301 276.9656);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.7686 0.1647 70.0804);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(0 0 0);
  --sidebar-ring: oklch(0.7853 0.1041 274.7134);
  --font-sans: Plus Jakarta Sans, ui-sans-serif, sans-serif, system-ui;
  --font-serif: DM Sans, sans-serif;
  --font-mono: Space Mono, monospace;
  --radius: 1rem;
  --spacing: 0.25rem;
  --tracking-normal: normal;
  --shadow-2xs: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.03);
  --shadow-xs: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.03);
  --shadow-sm: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.05), 0px 1px 2px -1px hsl(0 0% 10.1961% / 0.05);
  --shadow: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.05), 0px 1px 2px -1px hsl(0 0% 10.1961% / 0.05);
  --shadow-md: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.05), 0px 2px 4px -1px hsl(0 0% 10.1961% / 0.05);
  --shadow-lg: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.05), 0px 4px 6px -1px hsl(0 0% 10.1961% / 0.05);
  --shadow-xl: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.05), 0px 8px 10px -1px hsl(0 0% 10.1961% / 0.05);
  --shadow-2xl: 0px 0px 0px 0px hsl(0 0% 10.1961% / 0.13);
}

.dark {
  --background: oklch(0 0 0);
  --foreground: oklch(1.0000 0 0);
  --card: oklch(0.2455 0.0217 257.2823);
  --card-foreground: oklch(1.0000 0 0);
  --popover: oklch(0.2455 0.0217 257.2823);
  --popover-foreground: oklch(1.0000 0 0);
  --primary: oklch(0.6801 0.1583 276.9349);
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0.7845 0.1325 181.9120);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.3211 0 0);
  --muted-foreground: oklch(0.8452 0 0);
  --accent: oklch(0.8790 0.1534 91.6054);
  --accent-foreground: oklch(0 0 0);
  --destructive: oklch(0.7106 0.1661 22.2162);
  --destructive-foreground: oklch(0 0 0);
  --border: oklch(0.4459 0 0);
  --input: oklch(1.0000 0 0);
  --ring: oklch(0.6801 0.1583 276.9349);
  --chart-1: oklch(0.6801 0.1583 276.9349);
  --chart-2: oklch(0.7845 0.1325 181.9120);
  --chart-3: oklch(0.8790 0.1534 91.6054);
  --chart-4: oklch(0.7253 0.1752 349.7607);
  --chart-5: oklch(0.8003 0.1821 151.7110);
  --sidebar: oklch(0 0 0);
  --sidebar-foreground: oklch(1.0000 0 0);
  --sidebar-primary: oklch(0.6801 0.1583 276.9349);
  --sidebar-primary-foreground: oklch(0 0 0);
  --sidebar-accent: oklch(0.8790 0.1534 91.6054);
  --sidebar-accent-foreground: oklch(0 0 0);
  --sidebar-border: oklch(1.0000 0 0);
  --sidebar-ring: oklch(0.6801 0.1583 276.9349);
}

/* Các biến font, radius, spacing, shadow ở chế độ tối giống chế độ sáng. */

@layer base {
  body {
    letter-spacing: var(--tracking-normal);
  }
}
```
