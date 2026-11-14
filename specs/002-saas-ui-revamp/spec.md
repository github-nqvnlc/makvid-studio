# Feature Specification: Nâng cấp giao diện MakVid Studio thành web SaaS hoàn chỉnh

**Feature Branch**: `002-saas-ui-revamp`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "@docs/UI_PROMPT.md Đây là yêu cầu cải thiện UI" — toàn bộ yêu cầu nguồn nằm ở [docs/UI_PROMPT.md](../../docs/UI_PROMPT.md).

## Clarifications

### Session 2026-11-14

- Q: Trang cài đặt tài khoản (UI_PROMPT.md vừa yêu cầu, vừa cấm thêm mục cho tính năng chưa có) làm tới mức nào? → A: Làm **hồ sơ đầy đủ**: sửa tên, ảnh đại diện, đổi mật khẩu, kèm giao diện và ngôn ngữ (FR-050–FR-052, User Story 9). Đây là **ngoại lệ có duyệt** cho nguyên tắc "chỉ sửa giao diện".
- Q: Tìm kiếm, lọc, phân trang danh sách dự án có được sửa truy vấn phía máy chủ không? → A: Làm **quản lý dự án đầy đủ từ API tới giao diện**: liệt kê (tìm, lọc đầy đủ theo trạng thái, thời gian…, sắp xếp, phân trang, tất cả do API xử lý), xem, tạo, đổi tên, xóa một, xóa nhiều, xóa tất cả (FR-027, FR-053–FR-059). Ngoại lệ có duyệt thứ hai cho nguyên tắc "chỉ sửa giao diện".
- Q: Khi xóa dự án thì có khôi phục được không? → A: **Xóa vĩnh viễn ngay**, không có thùng rác, không khôi phục (FR-055, FR-060).
- Q: Liệt kê có lọc, đổi tên, xóa dự án có mở ra API công khai `/api/v1` không? → A: **Không**, chỉ API nội bộ của ứng dụng web; `/api/v1` giữ nguyên.
- Q: Ngôn ngữ trong hồ sơ có tự áp dụng khi đăng nhập, kể cả khi trình duyệt đang chọn ngôn ngữ khác? → A: **Có**: lúc đăng nhập chuyển sang ngôn ngữ hồ sơ; sau đó đường dẫn quyết định; đổi ngôn ngữ ở bất kỳ đâu khi đã đăng nhập cập nhật cả cookie lẫn hồ sơ (FR-010).
- Q: Khung bên phải của hero trên trang giới thiệu hiển thị gì? → A: **Video mẫu ngắn thật** (10–15 giây, 9:16) render bằng chính hệ thống từ một phong cách có sẵn, đặt trong khung điện thoại; kịch bản mẫu do chủ sản phẩm duyệt (FR-013a).

## Phạm vi

Chỉ thay đổi **tầng giao diện** của ứng dụng web. Logic nghiệp vụ, API, dữ liệu, xác thực và pipeline render giữ nguyên.
**Ngoại lệ (chủ sản phẩm đã duyệt 2026-11-14):**

1. Trang hồ sơ cá nhân ở User Story 9 được phép dùng thêm chức năng có sẵn của hệ thống đăng nhập (sửa hồ sơ, đổi mật khẩu) và thêm phần lưu ảnh đại diện. Không đổi cấu trúc dữ liệu: hồ sơ người dùng đã có tên, ảnh và ngôn ngữ.
2. Quản lý dự án (User Story 5) được thêm chức năng phía máy chủ: liệt kê có tìm/lọc/sắp xếp/phân trang, đổi tên, xóa một, xóa nhiều, xóa tất cả. Xóa là vĩnh viễn (gỡ dữ liệu và file lưu trữ của dự án); mọi thao tác giữ cách ly workspace và phân quyền theo vai trò.
Màn hình nào cần dữ liệu mà hệ thống chưa có thì hiển thị trạng thái rỗng hoặc nhãn "Sắp ra mắt", không hiển thị dữ liệu giả trông như thật, và được liệt kê trong báo cáo.

**Hiện trạng đã xác nhận từ mã nguồn** (bổ sung cho bảng ở mục 2 của UI_PROMPT.md):

| Hạng mục | Hệ thống hiện có |
| --- | --- |
| Trang đã có | `/`, `/sign-in`, `/sign-up`, `/projects/new`, `/projects/[id]`, `/batches`, `/batches/[id]`, `/workspace/{brand,assets,members,billing,api}`, `/docs/api`, `/invite/[token]`, `/admin` (chỉ quản trị nền tảng, người khác nhận 404) |
| Đăng nhập | Email + mật khẩu; Google khi được cấu hình. **Không có** quên mật khẩu, không có trang hồ sơ cá nhân |
| Gói | Free / Starter (Cơ bản) / Pro, **chỉ có kỳ tháng**, có giá USD và VND. Giới hạn: số video, giây video, ký tự giọng đọc, ảnh AI, dung lượng, độ dài tối đa mỗi video, có/không tạo hàng loạt, có/không API |
| Giọng đọc | 21 giọng, mỗi giọng có nhóm chất lượng (Standard / Pro / Ultra), giới tính, vùng miền (Bắc / Trung / Nam / không rõ) và đoạn nghe thử. Gói **không** giới hạn theo nhóm giọng |
| Dự án | Có tên, trạng thái (14 trạng thái từ "nháp" tới "sẵn sàng", "cần chú ý", "lỗi"), tỷ lệ chính, ngày tạo/cập nhật; ảnh thumbnail có khi đã render xong; tiến độ theo thời gian thực |
| Workspace | Một người có thể thuộc nhiều workspace và chuyển qua lại |
| Thông báo | Không có kho thông báo riêng; chỉ có trạng thái dự án |

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Điều hướng ứng dụng gọn, rõ, mọi kích thước màn hình (Priority: P1)

Người dùng đã đăng nhập luôn biết mình đang ở trang nào, tới được mọi chức năng trong 1–2 thao tác, và trên điện thoại không bị thanh menu chiếm màn hình.
Khung ứng dụng gồm thanh bên (nhóm Sáng tạo / Workspace / Tài khoản, thu gọn được thành biểu tượng và nhớ trạng thái), thanh trên (đường dẫn trang, ô tìm kiếm nhanh mở bằng Ctrl/Cmd+K, nút "Tạo video mới", chuông thông báo, nút ngôn ngữ, nút giao diện sáng/tối), khu cuối thanh bên có thanh quota và menu người dùng.

**Why this priority**: Mọi màn hình khác nằm trong khung này; điều hướng hiện tại là vấn đề lớn nhất (4 dòng menu trên mobile, không biết đang ở đâu).

**Independent Test**: Đăng nhập, đi qua cả 8 mục menu ở 1280px và 360px, chỉ dùng chuột rồi chỉ dùng bàn phím; kiểm tra mục đang mở được đánh dấu và không có thanh cuộn ngang.

**Acceptance Scenarios**:

1. **Given** người dùng ở `/workspace/billing`, **When** nhìn thanh bên, **Then** mục "Gói & mức dùng" được đánh dấu là đang mở và đường dẫn trang ghi "Tài khoản / Gói & mức dùng".
2. **Given** màn hình 360px, **When** trang tải xong, **Then** thanh bên ẩn, mở được bằng nút menu, và phần đầu trang chiếm không quá một dòng.
3. **Given** người dùng thu gọn thanh bên, **When** tải lại trang hoặc sang trang khác, **Then** thanh bên vẫn ở trạng thái thu gọn.
4. **Given** người dùng nhấn Ctrl/Cmd+K, **When** gõ "brand", **Then** thấy mục "Brand kit" và các dự án có tên khớp, Enter để mở.
5. **Given** người dùng là quản trị nền tảng, **When** mở thanh bên, **Then** thấy thêm mục Quản trị; người dùng khác không thấy mục này.
6. **Given** người dùng thuộc 2 workspace, **When** chọn workspace khác ở đầu thanh bên, **Then** toàn bộ dữ liệu hiển thị chuyển sang workspace đó.

---

### User Story 2 - Chọn giao diện sáng/tối và ngôn ngữ ở bất kỳ đâu (Priority: P1)

Người dùng (đã hoặc chưa đăng nhập) chọn Sáng / Tối / Theo hệ thống và chọn Tiếng Việt / English từ nút có biểu tượng; lựa chọn được ghi nhớ, trang đang xem được giữ nguyên.

**Why this priority**: Là nền tảng của mọi màn hình; người dùng đã yêu cầu rõ, và mọi giai đoạn sau đều phải được nghiệm thu ở 2 giao diện × 2 ngôn ngữ.

**Independent Test**: Ở mỗi trang hiện có, đổi giao diện và ngôn ngữ, tải lại trang, kiểm tra lựa chọn được giữ, URL và tham số truy vấn giữ nguyên, không nháy sai màu khi tải.

**Acceptance Scenarios**:

1. **Given** người dùng xem `/en/projects/123?tab=chat`, **When** chọn "Tiếng Việt", **Then** chuyển tới `/projects/123?tab=chat` (tiếng Việt không có tiền tố).
2. **Given** hệ điều hành đang ở chế độ tối và người dùng chưa chọn gì, **When** mở trang, **Then** trang hiển thị tối ngay từ khung hình đầu, không có chớp trắng.
3. **Given** người dùng chọn "Sáng", **When** quay lại sau khi đóng trình duyệt, **Then** trang vẫn sáng.
4. **Given** menu ngôn ngữ mở, **When** đọc các mục, **Then** mỗi mục ghi tên ngôn ngữ bằng chính ngôn ngữ đó ("Tiếng Việt", "English") và nút hiện mã `VI`/`EN`.
5. **Given** giao diện tiếng Việt, **When** xem ngày, số và tiền, **Then** định dạng theo tiếng Việt (ví dụ "14/11/2026", "490.000 ₫"); ở tiếng Anh theo định dạng tiếng Anh.

---

### User Story 3 - Trình chỉnh sửa dự án xem đúng tỷ lệ, sửa bằng chat luôn trong tầm mắt (Priority: P1)

Người dùng mở một dự án và thấy ba khu: danh sách cảnh (trái), video xem trước đúng tỷ lệ (giữa), khung chat sửa video (phải). Thanh công cụ trên cùng có tên dự án, trạng thái, Hoàn tác / Làm lại, "Tải về" (Video, Phụ đề .srt, Thumbnail), menu "…" (Lưu thành template, Nhân bản dự án) và Lịch sử phiên bản.

**Why this priority**: Đây là nơi người dùng làm việc nhiều nhất; hiện tại video 9:16 nằm trong khung ngang và chat nằm cuối trang.

**Independent Test**: Mở một dự án 9:16 đã render và một dự án 16:9; gửi một yêu cầu chat, hoàn tác, làm lại, tải video, mở lịch sử phiên bản — tất cả không phải cuộn trang ở 1280px.

**Acceptance Scenarios**:

1. **Given** dự án 9:16 đã sẵn sàng, **When** mở trình chỉnh sửa, **Then** khung xem trước hiển thị dọc, có ảnh poster trước khi phát.
2. **Given** file video không tải được, **When** khung xem trước cố tải, **Then** hiện thông báo dễ hiểu và nút "Thử lại", không hiện trình phát trống.
3. **Given** dự án đang render, **When** mở trình chỉnh sửa, **Then** thấy các bước tiến độ bằng câu dễ hiểu (ví dụ "Đang dựng cảnh 4/9") cập nhật trực tiếp.
4. **Given** cột trái, **When** xem danh sách cảnh, **Then** mỗi cảnh có ảnh thu nhỏ nếu có, nếu không thì số cảnh + đoạn lời đọc rút gọn; bấm vào cảnh thì xem trước cảnh đó.
5. **Given** màn hình 360px, **When** mở trình chỉnh sửa, **Then** ba khu chuyển thành các tab (Cảnh / Xem trước / Chat).
6. **Given** desktop, **When** kéo vạch chia giữa các cột, **Then** độ rộng cột thay đổi theo.

---

### User Story 4 - Tạo video theo từng bước, có tóm tắt trước khi bấm (Priority: P1)

Người dùng tạo video qua các bước có tiêu đề: (1) nguồn nội dung + nội dung; (2) tỷ lệ khung hình (thẻ có hình minh họa) và độ dài (thanh trượt + ô số); (3) giọng đọc; (4) chế độ Tự động / Duyệt từng bước. Cuối cùng là thẻ tóm tắt lựa chọn và mức quota sẽ dùng, kèm nút "Tạo video". Mọi trường và hành vi của form hiện tại được giữ nguyên.

**Why this priority**: Là luồng tạo giá trị chính; form hiện tại quá dài, không biết sẽ tốn bao nhiêu quota.

**Independent Test**: Tạo một video với mỗi nguồn nội dung; so sánh dữ liệu gửi đi với form cũ cho cùng lựa chọn — phải giống hệt.

**Acceptance Scenarios**:

1. **Given** người dùng chọn 9:16 và 45 giây, **When** xem thẻ tóm tắt, **Then** thấy "1 video, 45 giây" so với phần còn lại của kỳ (ví dụ "còn 1 video, 135 giây").
2. **Given** lựa chọn vượt giới hạn của gói (ví dụ độ dài hơn độ dài tối đa hoặc hết lượt video), **When** xem tóm tắt, **Then** nút "Tạo video" bị vô hiệu kèm lý do và nút nâng cấp.
3. **Given** bước giọng đọc, **When** chọn tab "Ultra" và lọc "Nữ" + "Miền Nam", **Then** chỉ thấy giọng thỏa cả ba điều kiện, kèm một dòng giải thích khác biệt giữa 3 nhóm (độ tự nhiên, chi phí).
4. **Given** một giọng đang phát thử, **When** bấm nghe thử giọng khác, **Then** giọng trước dừng, nút của giọng mới hiện trạng thái đang phát.
5. **Given** người dùng gửi form, **When** đang tạo, **Then** nút hiện trạng thái đang gửi và không bấm lặp được; lỗi từ máy chủ hiển thị bằng câu dễ hiểu.

---

### User Story 5 - Quản lý dự án: thống kê, tìm, lọc, đổi tên, xóa (Priority: P2)

Trang chính sau đăng nhập có dải thẻ thống kê (video đã tạo trong kỳ, phút đã dùng / quota) và danh sách dự án chuyển được giữa dạng lưới (thumbnail, tỷ lệ, ngày tạo, trạng thái) và dạng bảng. Người dùng tìm theo tên, lọc theo trạng thái, khoảng thời gian, tỷ lệ, nguồn nội dung, người tạo, chế độ, sắp xếp và phân trang (máy chủ xử lý), đổi tên, xóa một dự án, chọn nhiều để xóa, hoặc xóa tất cả dự án khớp bộ lọc.

**Why this priority**: Cần cho người dùng có nhiều dự án; giá trị cao nhưng không chặn luồng tạo video.

**Independent Test**: Với một workspace có 0, 3 và 50 dự án, kiểm tra trạng thái rỗng, lọc, tìm, sắp xếp, phân trang và tiến độ dự án đang render.

**Acceptance Scenarios**:

1. **Given** workspace chưa có dự án, **When** mở trang chính, **Then** thấy minh họa, một câu giải thích và nút "Tạo video đầu tiên".
2. **Given** một dự án đang render, **When** nhìn thẻ dự án, **Then** thấy tiến độ cập nhật mà không cần tải lại trang.
3. **Given** người dùng chọn dạng bảng, **When** quay lại trang, **Then** vẫn ở dạng bảng.
4. **Given** đang tải dữ liệu, **When** trang hiển thị, **Then** thấy khung chờ (skeleton) đúng hình dạng nội dung.
5. **Given** workspace có 500 dự án, **When** lọc "Lỗi" + "7 ngày qua" + 9:16, **Then** chỉ nhận về trang kết quả đầu tiên từ máy chủ, bộ đếm ghi tổng số khớp, và URL chứa bộ lọc (chia sẻ/tải lại vẫn giữ).
6. **Given** người dùng chọn 3 dự án ở dạng bảng, **When** bấm "Xóa" và xác nhận, **Then** cả 3 biến mất khỏi danh sách, thấy thông báo nổi "Đã xóa 3 dự án".
7. **Given** bộ lọc đang khớp 40 dự án, **When** bấm "Xóa tất cả" và gõ đúng chữ xác nhận, **Then** cả 40 dự án khớp bị xóa, dự án ngoài bộ lọc giữ nguyên.
8. **Given** người dùng có vai trò "Người xem", **When** mở danh sách, **Then** không thấy nút đổi tên, xóa, ô chọn nhiều; gọi API xóa trực tiếp cũng bị từ chối.
9. **Given** một dự án, **When** đổi tên tại chỗ và nhấn Enter, **Then** tên mới hiện ở danh sách, trình chỉnh sửa và đường dẫn trang.

---

### User Story 6 - Gói, mức dùng và API rõ ràng (Priority: P2)

Mỗi chỉ số mức dùng có thanh tiến độ và cảnh báo khi dùng trên 80%. Thẻ gói ghi rõ đơn vị giá (miễn phí / tháng), đánh dấu gói hiện tại, nút nâng cấp bị vô hiệu kèm giải thích khi chưa có phương thức thanh toán. Trang API & webhooks bị khóa kèm thẻ nâng cấp khi gói không có API.

**Why this priority**: Ảnh hưởng doanh thu và tránh người dùng thao tác rồi mới nhận lỗi.

**Independent Test**: Với workspace gói Free đã dùng 2/3 video, mở Gói & mức dùng và API; với workspace gói Starter, mở API.

**Acceptance Scenarios**:

1. **Given** đã dùng 2/3 video, **When** mở Gói & mức dùng, **Then** thanh tiến độ ở 67%; khi vượt 80% thì hiện cảnh báo, cả trên trang lẫn thanh quota ở thanh bên.
2. **Given** gói Free, **When** xem thẻ gói, **Then** giá ghi "Miễn phí", không phải "0".
3. **Given** gói Free (không có API), **When** mở API & webhooks, **Then** không nhập được tên key/URL, thấy thẻ giải thích và nút "Nâng cấp".
4. **Given** chưa có phương thức thanh toán nào được bật, **When** xem nút nâng cấp, **Then** nút bị vô hiệu kèm dòng giải thích.

---

### User Story 7 - Trang công khai và trang đăng nhập/đăng ký (Priority: P2)

Khách chưa đăng nhập thấy trang giới thiệu đầy đủ (hero, 3 bước, thư viện phong cách, tính năng, trường hợp sử dụng, bảng giá, FAQ, lời kêu gọi cuối, chân trang nhiều cột), trang Bảng giá riêng, và trang đăng nhập/đăng ký chia đôi (form bên trái, panel thương hiệu bên phải; mobile chỉ có form).

**Why this priority**: Cần để thu hút người dùng mới, nhưng người dùng hiện tại không bị chặn nếu chưa có.

**Independent Test**: Mở trang chủ khi chưa đăng nhập ở 360px và 1280px, đi qua mọi khối, vào Bảng giá, đăng ký tài khoản mới, đăng xuất, đăng nhập lại.

**Acceptance Scenarios**:

1. **Given** khách chưa đăng nhập, **When** mở `/`, **Then** thấy trang giới thiệu; khi đã đăng nhập, `/` là danh sách dự án như hiện nay.
2. **Given** trang giới thiệu, **When** tải xong, **Then** hero hiện ảnh poster ngay rồi video mẫu 9:16 phát không tiếng trong khung điện thoại; khi bật giảm chuyển động thì chỉ có ảnh poster.
3. **Given** mobile, **When** bấm nút menu ở đầu trang công khai, **Then** menu trượt ra chứa các liên kết, nút ngôn ngữ, nút giao diện, Đăng nhập và "Dùng thử miễn phí".
4. **Given** form đăng ký, **When** nhập email sai định dạng và rời ô, **Then** lỗi hiện ngay dưới ô đó.
5. **Given** ô mật khẩu, **When** bấm biểu tượng con mắt, **Then** mật khẩu hiện/ẩn và nút có nhãn cho trình đọc màn hình.
6. **Given** Google chưa được cấu hình, **When** mở trang đăng nhập, **Then** không có nút "Tiếp tục với Google"; khi đã cấu hình thì có.
7. **Given** bảng giá, **When** bấm "Theo năm", **Then** thấy nhãn "Sắp ra mắt" vì hệ thống chỉ có gói theo tháng.
8. **Given** URL không tồn tại, **When** mở, **Then** thấy trang 404 đúng giao diện, có nút về trang chủ, ở cả hai ngôn ngữ và hai giao diện.

---

### User Story 8 - Brand kit, thư viện, thành viên, hàng loạt dùng thành phần đồng bộ (Priority: P3)

Ô chọn màu (ô màu + mã hex), ô chọn, ô tải file (kéo-thả), bảng, hộp thoại, thông báo nổi đều cùng một kiểu theo giao diện. Brand kit đặt khung xem trước chữ tiếng Việt bên cạnh form trên desktop. Mọi trang có đủ trạng thái đang tải / rỗng (minh họa + nút hành động) / lỗi (thông báo + nút thử lại) / thành công (thông báo nổi).

**Why this priority**: Hoàn thiện tính nhất quán; các chức năng đã chạy được, chỉ chưa đẹp.

**Independent Test**: Ở mỗi trang Workspace và Hàng loạt, thử trạng thái rỗng, tải file sai định dạng, mời thành viên, đổi màu thương hiệu; so sánh với ảnh chụp ở cả 2 giao diện.

**Acceptance Scenarios**:

1. **Given** Brand kit, **When** nhập mã hex không hợp lệ, **Then** ô báo lỗi và không lưu.
2. **Given** khu tải logo, **When** kéo một file ảnh vào, **Then** file được nhận như khi chọn qua nút.
3. **Given** Thư viện chưa có tài nguyên, **When** mở trang, **Then** thấy minh họa, câu giải thích và nút tải lên.
4. **Given** mời thành viên thành công, **When** gửi form, **Then** thấy thông báo nổi xác nhận, ở cả hai ngôn ngữ.

---

### User Story 9 - Hồ sơ và cài đặt tài khoản (Priority: P3)

Người dùng mở "Hồ sơ" từ menu người dùng để sửa tên, đổi ảnh đại diện, đổi mật khẩu và chọn giao diện, ngôn ngữ ở một chỗ.

**Why this priority**: Chủ sản phẩm chọn làm đầy đủ; hữu ích nhưng không chặn luồng tạo video.

**Independent Test**: Đổi tên, tải ảnh đại diện, đổi mật khẩu, đăng xuất rồi đăng nhập bằng mật khẩu mới; kiểm tra tên và ảnh hiện ở menu người dùng và danh sách thành viên.

**Acceptance Scenarios**:

1. **Given** trang Hồ sơ, **When** đổi tên và lưu, **Then** thấy thông báo nổi và tên mới hiện ngay ở menu người dùng.
2. **Given** khu ảnh đại diện, **When** kéo vào một file không phải ảnh hoặc quá lớn, **Then** thấy lỗi dễ hiểu và ảnh cũ giữ nguyên.
3. **Given** form đổi mật khẩu, **When** nhập sai mật khẩu hiện tại, **Then** lỗi hiện dưới ô đó; khi nhập đúng thì đăng nhập lại được bằng mật khẩu mới.
4. **Given** tài khoản chỉ đăng nhập bằng Google, **When** mở trang Hồ sơ, **Then** không thấy form đổi mật khẩu mà thấy câu giải thích.
5. **Given** người dùng chọn "English" ở trang Hồ sơ, **When** đăng nhập trên thiết bị khác, **Then** ứng dụng mở bằng tiếng Anh.

---

### Edge Cases

- Tên dự án, tên workspace, email rất dài, hoặc chuỗi tiếng Việt dài hơn bản tiếng Anh: chữ được rút gọn có dấu "…" hoặc xuống dòng, không vỡ bố cục, không thanh cuộn ngang ở 360px.
- Trình duyệt chặn lưu trữ (chế độ riêng tư): lựa chọn giao diện/ngôn ngữ vẫn áp dụng trong phiên, chỉ không nhớ lâu dài.
- Người dùng đổi ngôn ngữ khi đang gõ dở trong form tạo video hoặc ô chat: hệ thống cảnh báo trước khi rời trang nếu có nội dung chưa gửi.
- Kết nối tiến độ thời gian thực bị ngắt: hiển thị trạng thái "Đang kết nối lại", không hiện tiến độ sai.
- Dự án ở trạng thái "lỗi" hoặc "cần chú ý": thẻ và trình chỉnh sửa hiện câu giải thích dễ hiểu và bước tiếp theo, không lộ thông tin kỹ thuật.
- Video có nhiều tỷ lệ xuất: menu "Tải về" liệt kê từng tỷ lệ.
- Mức dùng "không giới hạn" (gói có giới hạn rỗng): hiện "Không giới hạn", không vẽ thanh tiến độ.
- Người dùng tắt hiệu ứng chuyển động trong hệ điều hành: mọi chuyển động trang trí bị tắt.
- Người dùng không có quyền (ví dụ thành viên thường mở trang Thành viên hoặc API): thấy giải thích thay vì form bấm rồi báo lỗi.
- Xóa một dự án đang render: các bước còn lại dừng, không có video "mồ côi" xuất hiện sau đó, phần quota giữ chỗ được trả lại.
- Xóa dự án đã được lưu thành template hoặc thuộc một lô tạo hàng loạt: template và lô vẫn còn; dòng của lô trỏ tới dự án đã xóa hiện "Đã xóa", không vỡ trang.
- Hai người cùng xóa một dự án: người sau nhận thông báo "dự án đã bị xóa", không hiện lỗi kỹ thuật.
- Người khác đang mở trình chỉnh sửa khi dự án bị xóa: lần thao tác tiếp theo hiện thông báo dự án đã bị xóa và nút về danh sách.
- Trang lỗi không lường trước: trang lỗi đúng giao diện, có nút thử lại, không hiện thông tin kỹ thuật.

## Requirements _(mandatory)_

### Functional Requirements

**Nền tảng chung**

- **FR-001**: Hệ thống MUST giữ nguyên toàn bộ hành vi nghiệp vụ hiện có; mọi luồng đang chạy (đăng ký, đăng nhập, tạo dự án, duyệt từng bước, xem tiến độ, sửa bằng chat, hoàn tác/làm lại, nhân bản, lưu template, tải về, lịch sử phiên bản, hàng loạt, brand kit, thư viện, thành viên, lời mời, gói, API keys, webhooks, quản trị) MUST vẫn chạy sau thay đổi.
- **FR-002**: Mọi màu sắc, bo góc, bóng đổ, kiểu chữ MUST lấy từ một bộ token thiết kế duy nhất (bộ "poppy-1" ở Phụ lục A của UI_PROMPT.md), có biến thể sáng và tối; không component nào được dùng mã màu cố định.
- **FR-003**: Bộ token MUST đạt tương phản WCAG AA ở cả hai giao diện; nếu token gốc không đạt (viền quá gắt, chữ phụ quá nhạt), chỉ điều chỉnh token và ghi lại thay đổi trong báo cáo.
- **FR-004**: Font hiển thị MUST hiển thị đúng mọi ký tự tiếng Việt (Ẩ, Ỹ, Ự, ặ, ở…); font không đạt MUST được thay bằng font gần giống có hỗ trợ đầy đủ và ghi vào báo cáo.
- **FR-005**: Sau khi hoàn tất, giao diện cũ (các lớp kiểu viết tay hiện có) MUST được gỡ bỏ hoàn toàn.

**Giao diện sáng/tối**

- **FR-006**: Người dùng MUST chọn được Sáng / Tối / Theo hệ thống từ nút có biểu tượng ở đầu trang công khai, trang đăng nhập/đăng ký và thanh trên trong ứng dụng; mặc định Theo hệ thống.
- **FR-007**: Lựa chọn giao diện MUST được ghi nhớ giữa các lần truy cập và được áp dụng ngay khung hình đầu tiên (không nháy sai màu).
- **FR-008**: Mọi màn hình, kể cả trình phát video, hộp thoại, thông báo nổi, biểu đồ/thanh tiến độ, MUST hiển thị đúng ở cả hai giao diện.

**Ngôn ngữ**

- **FR-009**: Nút chuyển ngôn ngữ (biểu tượng quả địa cầu + mã `VI`/`EN`, mỗi mục ghi tên ngôn ngữ bằng chính ngôn ngữ đó) MUST thay cho liên kết chữ hiện tại và có ở đầu trang công khai, trang đăng nhập/đăng ký, thanh trên trong ứng dụng và menu người dùng.
- **FR-010**: Đổi ngôn ngữ MUST giữ nguyên trang đang xem và tham số truy vấn, theo quy ước đường dẫn hiện có (tiếng Việt mặc định không tiền tố, tiếng Anh tiền tố `/en`, `/vi/...` tự chuyển về không tiền tố), và MUST ghi nhớ lựa chọn. Thứ tự ưu tiên: (1) ngay sau khi đăng nhập, chuyển sang ngôn ngữ lưu trong hồ sơ; (2) sau đó ngôn ngữ trong đường dẫn quyết định; (3) khi đã đăng nhập, đổi ngôn ngữ ở bất kỳ nút nào MUST cập nhật cả lựa chọn trên trình duyệt lẫn hồ sơ; khách chưa đăng nhập chỉ lưu trên trình duyệt.
- **FR-011**: Mọi chuỗi hiển thị MUST có ở cả bản tiếng Việt và tiếng Anh; không có chữ cứng trong giao diện. Bộ kiểm tra tự động MUST báo lỗi khi một khóa chuỗi thiếu ở một ngôn ngữ.
- **FR-012**: Ngày, số, tiền MUST định dạng theo ngôn ngữ đang chọn; giá MUST hiển thị VND ở tiếng Việt và USD ở tiếng Anh, lấy từ dữ liệu gói hiện có.

**Khu công khai**

- **FR-013**: Khách chưa đăng nhập MUST thấy trang giới thiệu ở `/` gồm theo thứ tự: hero (tiêu đề giá trị, mô tả, 2 nút kêu gọi, khung minh họa trình chỉnh sửa hoặc video mẫu), 3 bước (Nhập ý tưởng → AI dựng video → Xuất MP4), thư viện phong cách (lưới các phong cách thật có ảnh thu nhỏ), tính năng nổi bật (giọng đọc tiếng Việt, phụ đề kiểu TikTok, nhiều tỷ lệ, tạo hàng loạt, API), trường hợp sử dụng (giáo dục, mạng xã hội, tin tức, giới thiệu repo), bảng giá, câu hỏi thường gặp (mở/đóng từng câu), lời kêu gọi cuối, chân trang nhiều cột (sản phẩm, tài nguyên, pháp lý, ngôn ngữ, mạng xã hội). Người đã đăng nhập vẫn thấy danh sách dự án ở `/`.
- **FR-013a**: Hero MUST hiển thị một video mẫu 10–15 giây, tỷ lệ 9:16, render bằng chính hệ thống từ một phong cách có sẵn, đặt trong khung điện thoại. Video MUST tải sau khi phần chính của trang đã hiện, có ảnh poster, tự phát không tiếng và lặp lại, có nút tạm dừng, và chỉ hiện ảnh poster khi người dùng bật giảm chuyển động. Kịch bản video mẫu (một bản tiếng Việt, một bản tiếng Anh theo ngôn ngữ trang) MUST được chủ sản phẩm duyệt trước khi đưa lên.
- **FR-014**: Đầu trang công khai MUST dính trên cùng, gồm logo, menu (Tính năng, Phong cách, Bảng giá, Tài liệu API → trang `/docs/api` hiện có), nút ngôn ngữ, nút giao diện, "Đăng nhập", "Dùng thử miễn phí"; trên mobile menu thu vào một ngăn trượt.
- **FR-015**: MUST có trang `/pricing` riêng. Bảng giá MUST lấy gói, giá và giới hạn từ dữ liệu gói hiện có; công tắc Tháng/Năm MUST có, với "Năm" mang nhãn "Sắp ra mắt" cho tới khi hệ thống có gói theo năm.
- **FR-016**: Liên kết pháp lý, mạng xã hội và nội dung chưa tồn tại ở chân trang MUST được đánh dấu "Sắp ra mắt" hoặc ẩn, không trỏ tới trang trống.
- **FR-017**: Trang 404 và trang lỗi MUST đúng giao diện, có cả hai ngôn ngữ, có hành động quay về/thử lại.

**Đăng nhập / đăng ký**

- **FR-018**: Trang đăng nhập và đăng ký MUST bố cục chia đôi trên desktop (form + panel thương hiệu), chỉ form trên mobile, có liên kết qua lại giữa hai trang.
- **FR-019**: Form MUST kiểm tra hợp lệ ngay dưới từng ô, có nút hiện/ẩn mật khẩu, trạng thái đang gửi, lỗi từ máy chủ bằng câu dễ hiểu.
- **FR-020**: Nút "Tiếp tục với Google" MUST chỉ hiện khi đăng nhập Google được cấu hình. Liên kết quên mật khẩu MUST NOT hiện vì hệ thống chưa hỗ trợ (ghi vào báo cáo).

**Khung ứng dụng**

- **FR-021**: Khung ứng dụng MUST có thanh bên với: logo + bộ chọn workspace; nhóm **Sáng tạo** (Dự án, Tạo video, Tạo hàng loạt), **Workspace** (Brand kit, Thư viện, Thành viên), **Tài khoản** (Gói & mức dùng, API & webhooks, Hồ sơ); mục Quản trị chỉ với quản trị nền tảng; cuối thanh là thanh quota và menu người dùng (hồ sơ, giao diện, ngôn ngữ, đăng xuất). Mục đang mở MUST được đánh dấu rõ.
- **FR-022**: Thanh bên MUST thu gọn được thành biểu tượng và nhớ trạng thái; trên mobile là ngăn trượt.
- **FR-023**: Thanh trên MUST có đường dẫn trang, ô tìm kiếm nhanh (Ctrl/Cmd+K) tìm được các trang và dự án theo tên, nút "Tạo video mới", chuông thông báo, nút ngôn ngữ, nút giao diện.
- **FR-024**: Chuông thông báo MUST liệt kê các dự án vừa sẵn sàng, cần chú ý hoặc lỗi gần đây (lấy từ trạng thái dự án hiện có), mỗi mục mở tới dự án đó. Trạng thái "đã đọc" chỉ nhớ trên thiết bị hiện tại.
- **FR-025**: Mọi trang trong ứng dụng MUST dùng cùng một khung tiêu đề trang (tiêu đề + mô tả + hành động bên phải) và cùng độ rộng nội dung.

**Danh sách dự án**

- **FR-026**: Trang Dự án MUST có dải thẻ thống kê lấy từ dữ liệu mức dùng của kỳ hiện tại (video đã tạo, phút đã dùng / quota).
- **FR-027**: Danh sách dự án MUST chuyển được giữa dạng lưới (ảnh thu nhỏ nếu có, tỷ lệ, ngày tạo, trạng thái) và dạng bảng, nhớ lựa chọn. Tìm, lọc, sắp xếp, phân trang MUST do máy chủ xử lý (FR-053) và phản ánh trong URL.
- **FR-028**: Dự án đang xử lý MUST hiện tiến độ cập nhật trực tiếp; dự án không có ảnh thu nhỏ MUST hiện ô thay thế đúng tỷ lệ.

**Tạo video**

- **FR-029**: Form tạo video MUST giữ nguyên mọi trường, giá trị mặc định và dữ liệu gửi đi của form hiện tại, và được chia thành 4 phần có tiêu đề (nguồn + nội dung; tỷ lệ + độ dài; giọng đọc; chế độ).
- **FR-030**: Tỷ lệ khung hình MUST chọn bằng thẻ có hình minh họa tỷ lệ; độ dài bằng thanh trượt kèm ô số, giới hạn trên bằng độ dài tối đa của gói.
- **FR-031**: Cuối form MUST có thẻ tóm tắt lựa chọn và mức quota sẽ dùng so với phần còn lại của kỳ; khi vượt giới hạn, nút "Tạo video" MUST bị vô hiệu kèm lý do và lối nâng cấp.
- **FR-032**: Bộ chọn giọng đọc MUST thay 21 thẻ bằng tab theo nhóm chất lượng (Standard / Pro / Ultra) + bộ lọc giới tính và vùng miền + danh sách gọn; MUST có một dòng giải thích khác biệt giữa 3 nhóm; nghe thử MUST có trạng thái đang phát và chỉ một giọng phát tại một thời điểm. Không khóa nhóm giọng nào vì gói hiện không giới hạn theo nhóm.

**Trình chỉnh sửa dự án**

- **FR-033**: Trình chỉnh sửa MUST có 3 khu co giãn được (cảnh / xem trước / chat) trên desktop và chuyển thành tab trên mobile.
- **FR-034**: Khung xem trước MUST hiển thị đúng tỷ lệ của video, có ảnh poster, trạng thái đang tải và thông báo lỗi kèm "Thử lại" khi không tải được.
- **FR-035**: Thanh công cụ MUST có tên dự án, trạng thái, Hoàn tác / Làm lại, menu "Tải về" (video theo từng tỷ lệ, phụ đề .srt, thumbnail), menu "…" (Lưu thành template, Nhân bản dự án), nút Lịch sử phiên bản mở ngăn trượt.
- **FR-036**: Khung chat MUST luôn nhìn thấy trên desktop; khi dự án đang chờ duyệt (kịch bản hoặc storyboard), giao diện duyệt hiện có MUST được giữ và đặt ở vị trí dễ thấy.
- **FR-037**: Khi đang xử lý, trình chỉnh sửa MUST hiện các bước tiến độ bằng câu dễ hiểu, cập nhật trực tiếp.

**Gói, mức dùng, API**

- **FR-038**: Mỗi chỉ số mức dùng MUST có thanh tiến độ, số đã dùng / giới hạn có đơn vị (video, phút, ký tự, ảnh, dung lượng), cảnh báo khi trên 80%, và "Không giới hạn" khi gói không giới hạn.
- **FR-039**: Thẻ gói MUST ghi đơn vị giá ("Miễn phí" hoặc giá "/ tháng"), đánh dấu gói hiện tại; nút nâng cấp MUST bị vô hiệu kèm giải thích khi chưa có phương thức thanh toán nào được bật.
- **FR-040**: Khi gói không có API, trang API & webhooks MUST khóa toàn bộ form và hiện thẻ nâng cấp; tương tự trang Tạo hàng loạt khi gói không có tính năng hàng loạt.

**Brand kit và thành phần nhập liệu**

- **FR-041**: Ô chọn màu MUST gồm ô màu + mã hex có kiểm tra hợp lệ; ô chọn và ô tải file MUST dùng thành phần đúng giao diện; tải file MUST hỗ trợ kéo-thả, và giữ nguyên kiểm tra định dạng/kích thước hiện có.
- **FR-042**: Khung xem trước chữ tiếng Việt của Brand kit MUST đặt cạnh form trên desktop và dưới form trên mobile.

**Trạng thái và trải nghiệm chung**

- **FR-043**: Mọi trang có dữ liệu MUST có trạng thái đang tải (khung chờ), rỗng (minh họa + câu giải thích + nút hành động), lỗi (câu dễ hiểu + nút thử lại); thao tác thành công/thất bại MUST báo bằng thông báo nổi.
- **FR-044**: Giao diện MUST NOT hiển thị thông tin kỹ thuật (mã lỗi thô, tên engine, tên nhà cung cấp) ở bất kỳ trạng thái nào.
- **FR-045**: Mọi chức năng MUST dùng được hoàn toàn bằng bàn phím với vòng focus rõ; mọi ô nhập có nhãn; mọi nút chỉ có biểu tượng có nhãn cho trình đọc màn hình.
- **FR-046**: Chuyển động MUST nhẹ (hover/nhấn trên nút và thẻ, chuyển trang) và MUST tắt khi người dùng bật giảm chuyển động.
- **FR-047**: Biểu tượng MUST dùng một bộ duy nhất trong toàn ứng dụng.
- **FR-048**: Mọi trang MUST hiển thị tốt ở 360px, 768px, 1280px, 1536px, không thanh cuộn ngang.
- **FR-049**: Mục nào backend chưa hỗ trợ MUST hiển thị khung giao diện với trạng thái rỗng và nhãn "Sắp ra mắt", và được liệt kê trong báo cáo cuối.
- **FR-050**: MUST có trang Cài đặt tài khoản (mở từ menu người dùng và mục "Hồ sơ" trong nhóm Tài khoản của thanh bên) gồm: sửa tên hiển thị; tải lên / đổi / gỡ ảnh đại diện (kéo-thả, kiểm tra định dạng và kích thước); xem email (chỉ đọc); đổi mật khẩu (mật khẩu hiện tại + mật khẩu mới + nhập lại, có tùy chọn đăng xuất các thiết bị khác); chọn giao diện và ngôn ngữ. Ngôn ngữ chọn ở đây được lưu vào hồ sơ như mọi nút ngôn ngữ khác (FR-010).
- **FR-051**: Tài khoản chỉ đăng nhập bằng Google (chưa có mật khẩu) MUST thấy giải thích thay cho form đổi mật khẩu.
- **FR-052**: Ảnh đại diện MUST hiển thị ở menu người dùng, danh sách thành viên; khi chưa có ảnh thì hiện chữ cái đầu của tên.

**Quản lý dự án (API + giao diện)**

- **FR-053**: API nội bộ của ứng dụng web (đăng nhập bằng phiên, không qua API key; API công khai `/api/v1` không đổi) MUST hỗ trợ liệt kê dự án với: tìm theo tên (không phân biệt hoa thường và dấu tiếng Việt); lọc theo trạng thái (nhiều giá trị, kèm nhóm "Đang xử lý" / "Chờ duyệt" / "Sẵn sàng" / "Cần chú ý" / "Lỗi"), khoảng thời gian tạo và cập nhật (có sẵn: hôm nay, 7 ngày, 30 ngày, tùy chọn từ–đến), tỷ lệ khung hình, nguồn nội dung, chế độ (Tự động / Duyệt từng bước), người tạo; sắp xếp theo ngày tạo, ngày cập nhật, tên (tăng/giảm); phân trang với tổng số kết quả. Kích thước trang mặc định 24, tối đa 100.
- **FR-054**: Người dùng MUST đổi tên được dự án (tại chỗ trong danh sách và trong thanh công cụ trình chỉnh sửa); tên không được rỗng, tối đa 200 ký tự, chuẩn hóa NFC.
- **FR-055**: Người dùng MUST xóa được một dự án, nhiều dự án đã chọn, hoặc tất cả dự án khớp bộ lọc hiện tại (không có bộ lọc = toàn bộ workspace). Xóa là **vĩnh viễn**: mọi thao tác xóa MUST có hộp thoại xác nhận nêu số dự án và ghi rõ "không thể khôi phục"; xóa nhiều và "Xóa tất cả" MUST yêu cầu gõ một chữ xác nhận.
- **FR-056**: Chọn nhiều MUST có: ô chọn trên từng dòng/thẻ, chọn tất cả trong trang, thanh hành động hiện số đã chọn; lựa chọn bị bỏ khi đổi bộ lọc.
- **FR-057**: Đổi tên và xóa MUST chỉ cho vai trò Chủ sở hữu, Quản trị, Biên tập; vai trò Người xem chỉ xem. Máy chủ MUST kiểm tra quyền và cách ly workspace cho mọi thao tác, kể cả khi gọi thẳng API; xóa hàng loạt MUST NOT chạm tới dự án của workspace khác.
- **FR-058**: Dự án đã xóa MUST biến mất khỏi danh sách, tìm kiếm nhanh, thống kê, thông báo; mở đường dẫn của dự án đã xóa MUST hiện trang "không tìm thấy" đúng giao diện.
- **FR-060**: Xóa vĩnh viễn MUST gỡ cùng lúc mọi thứ thuộc dự án: các phiên bản, lịch sử chat, file video, phụ đề, thumbnail, ảnh xem trước cảnh, file trung gian. Dự án đang xử lý MUST bị dừng các bước còn lại trước khi xóa; phần quota đang giữ chỗ được trả lại, phần đã dùng thì không. Link tải đã phát ra trước đó MUST hết hiệu lực.
- **FR-059**: Xóa nhiều/tất cả MUST báo kết quả từng phần nếu có dự án không xóa được (ví dụ "Đã xóa 38/40, 2 dự án không xóa được"), không âm thầm bỏ qua.

### Key Entities

- **Lựa chọn hiển thị của người dùng**: giao diện (sáng/tối/hệ thống), ngôn ngữ, trạng thái thu gọn thanh bên, dạng xem danh sách dự án, thông báo đã đọc. Lưu ở thiết bị của người dùng (ngôn ngữ còn thể hiện qua đường dẫn); khi đã đăng nhập, ngôn ngữ còn được lưu vào hồ sơ người dùng (FR-010).
- **Hồ sơ người dùng**: tên hiển thị, email (chỉ đọc), ảnh đại diện, ngôn ngữ ưa thích, có/không có mật khẩu. Các trường đã có trong dữ liệu hiện tại.
- **Dự án (hiển thị)**: tên, trạng thái, tỷ lệ chính và các tỷ lệ xuất, ngày tạo/cập nhật, ảnh thu nhỏ (nếu đã render), tiến độ. Dùng dữ liệu đã có.
- **Gói và mức dùng (hiển thị)**: tên gói theo ngôn ngữ, giá USD/VND, kỳ, các giới hạn và số đã dùng. Dùng dữ liệu đã có.
- **Giọng đọc (hiển thị)**: tên, nhóm chất lượng, giới tính, vùng miền, đoạn nghe thử. Dùng dữ liệu đã có.
- **Phong cách (hiển thị)**: tên và ảnh thu nhỏ cho thư viện phong cách ở trang giới thiệu. Dùng dữ liệu đã có.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% luồng người dùng hiện có (liệt kê ở FR-001) vẫn chạy được sau thay đổi, chứng minh bằng bộ kiểm thử đầu-cuối hiện có cộng thêm kiểm thử mới cho các màn hình đổi bố cục.
- **SC-002**: Ở màn hình 360px, phần đầu trang trong ứng dụng chiếm tối đa 64px chiều cao (hiện tại gần 1/3 màn hình); 0 trang có thanh cuộn ngang ở 360px, 768px, 1280px, 1536px.
- **SC-003**: Từ bất kỳ trang nào trong ứng dụng, người dùng tới được mọi mục menu trong tối đa 2 thao tác (hoặc 1 tổ hợp phím + gõ tên).
- **SC-004**: Đổi giao diện và ngôn ngữ trên mọi trang không gây nháy sai màu, không lỗi hiển thị, và giữ đúng trang + tham số truy vấn trong 100% trường hợp kiểm thử.
- **SC-005**: 0 khóa chuỗi thiếu ở một trong hai ngôn ngữ, 0 chuỗi hiển thị viết cứng, được kiểm tra tự động.
- **SC-006**: Mọi cặp chữ/nền và viền ô nhập đạt tương phản WCAG AA ở cả hai giao diện; kiểm tra truy cập tự động trên các trang chính không có lỗi mức nghiêm trọng.
- **SC-007**: Ở 1280px, người dùng xem video, gửi một yêu cầu chat, hoàn tác và tải video trong trình chỉnh sửa mà không phải cuộn trang.
- **SC-008**: Ở 1280px, bước chọn giọng đọc hiển thị gọn trong một màn hình (không cần cuộn để thấy bộ lọc và danh sách), so với 21 thẻ hiện nay chiếm nhiều màn hình.
- **SC-009**: Người dùng thấy mức quota sẽ dùng trước khi bấm "Tạo video" trong 100% lần tạo; 0 lần người dùng nhập được form API khi gói không có API.
- **SC-010**: Trang chủ công khai đạt từ 90 điểm trở lên ở Hiệu năng, Khả năng truy cập, Thực hành tốt nhất trong bài đo chuẩn của trình duyệt.
- **SC-011**: Bộ ảnh chụp các trang chính ở 2 giao diện × 2 ngôn ngữ × desktop/mobile được tạo tự động và nộp kèm báo cáo mỗi giai đoạn.
- **SC-012**: Không còn lớp kiểu giao diện cũ nào trong mã nguồn khi kết thúc.
- **SC-013**: Với workspace 1.000 dự án, mỗi lần đổi bộ lọc hoặc trang trả kết quả trong dưới 1 giây; test tự động chứng minh 0 trường hợp xóa hoặc đọc được dự án của workspace khác.

## Assumptions

- **Quy trình**: yêu cầu "viết `docs/UI_PLAN.md` rồi dừng chờ duyệt" được thực hiện qua `/speckit-plan`; plan sẽ chứa danh sách route, sơ đồ bố cục (công khai / xác thực / ứng dụng), danh sách thành phần, thứ tự chuyển đổi, rủi ro, và chia công việc theo 5 giai đoạn ở mục 9 của UI_PROMPT.md (0 khảo sát → 1 nền tảng → 2 công khai + xác thực → 3 khung ứng dụng + màn hình chính → 4 hoàn thiện), mỗi giai đoạn có cổng duyệt và ảnh chụp 2 giao diện × 2 ngôn ngữ × desktop/mobile. `docs/UI_PLAN.md` sẽ là bản tóm tắt trỏ tới plan.
- **Ràng buộc kỹ thuật do chủ sản phẩm chỉ định** (mục 4–6 của UI_PROMPT.md, dành cho bước plan, không phải yêu cầu chức năng): bộ thành phần giao diện và token theme "poppy-1" cài từ registry của tweakcn (dự phòng bằng Phụ lục A), quản lý giao diện sáng/tối bằng thư viện chuyên dụng, giữ thư viện đa ngôn ngữ hiện có, font Plus Jakarta Sans / DM Sans / Space Mono có kiểm tra tiếng Việt. Mọi thư viện mới phải qua kiểm tra license của dự án và tài liệu phiên bản hiện tại.
- Trang `/admin` có thật nhưng chỉ dành cho quản trị nền tảng; nó được đưa vào thanh bên chỉ với người có quyền đó và chuyển sang khung mới, không thay đổi chức năng.
- Trang `/docs/api`, `/invite/[token]`, `/batches/[id]` cũng chuyển sang giao diện mới. `/docs/api` dùng khung công khai.
- Gói chỉ có kỳ tháng; công tắc Năm ở bảng giá mang nhãn "Sắp ra mắt".
- Nhóm giọng không bị giới hạn theo gói, nên không có khóa giọng; nếu sau này có, bộ chọn giọng sẽ bổ sung.
- Không có kho thông báo trên máy chủ; chuông thông báo dựng từ trạng thái dự án gần đây, "đã đọc" nhớ trên thiết bị.
- Không có quên mật khẩu; liên kết này không hiển thị cho tới khi hệ thống hỗ trợ.
- Trang Hồ sơ dùng chức năng sửa hồ sơ và đổi mật khẩu có sẵn của thư viện đăng nhập đang dùng (plan phải xác minh trên tài liệu phiên bản hiện tại). Ảnh đại diện lưu qua kho lưu trữ hiện có, với giới hạn định dạng ảnh phổ biến và kích thước tối đa 2 MB. Mọi phần máy chủ thêm cho việc này phải nêu trong plan và có test.
- Đổi email và xóa tài khoản nằm ngoài phạm vi.
- Tìm, lọc, sắp xếp, phân trang, đổi tên, xóa dự án được làm ở cả máy chủ và giao diện (ngoại lệ 2). API công khai `/api/v1` không đổi trong feature này; chỉ API nội bộ của ứng dụng web được mở rộng, có test cách ly workspace và phân quyền.
- Thư viện phong cách dùng ảnh thu nhỏ phong cách thật sẵn có. Video hero (FR-013a) được render một lần và đóng gói tĩnh cùng trang, không render khi khách truy cập; không dùng số liệu khách hàng giả.
- Nội dung FAQ, trích dẫn ở panel thương hiệu, trường hợp sử dụng là nội dung tiếp thị do nhóm viết, không phải lời chứng thực giả của khách hàng thật.
