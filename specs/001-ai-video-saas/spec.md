# Feature Specification: Nền tảng SaaS sản xuất video AI từ animation HTML

**Feature Branch**: `001-ai-video-saas`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "@docs/prompt_requirement.md đọc prompt requirement và thực hiện" — toàn bộ đặc tả nguồn nằm ở [docs/prompt_requirement.md](../../docs/prompt_requirement.md).

## Clarifications

### Session 2026-11-12

- Q: Ngôn ngữ lời đọc của video? → A: Chỉ tiếng Việt ở bản đầu, tiếng Anh làm sau (FR-009).
- Q: Có gói miễn phí hoặc dùng thử không? → A: Có gói miễn phí giới hạn: 3 video/tháng, tối đa 60 giây, có watermark (FR-050).
- Q: Tiêu chí chất lượng hình ảnh tham chiếu? → A: Agent tự đề xuất bộ tiêu chí cụ thể (SC-013). Có thể thay khi người dùng mô tả hai video tham khảo.

> Ghi chú phạm vi: spec này mô tả **cái gì** và **vì sao** cho toàn bộ sản phẩm. Các lựa chọn công nghệ trong đặc tả nguồn (engine render, thư viện animation, ngôn ngữ, cơ sở dữ liệu, hàng đợi, nhà cung cấp TTS/LLM, cổng thanh toán…) được cố ý để lại cho giai đoạn `/speckit-plan`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tạo video hoàn chỉnh từ một ý tưởng bằng một cú nhấp (Priority: P1)

Một khách hàng không biết code đăng nhập, gõ một ý tưởng bằng tiếng Việt (ví dụ "Giải thích lãi kép cho người mới bắt đầu, 60 giây, dọc cho TikTok"), chọn tỷ lệ khung hình và nhấn "Tạo video". Hệ thống tự viết kịch bản, chọn phong cách phù hợp, chia cảnh, dựng hình động, tạo giọng đọc tiếng Việt, phụ đề highlight từng từ, nhạc nền, hiệu ứng âm thanh, tự kiểm tra lỗi hiển thị và trả về một video MP4 cùng file phụ đề và ảnh thumbnail. Trong lúc chờ, người dùng thấy tiến độ bằng ngôn ngữ dễ hiểu ("Đang dựng cảnh 4/9").

**Why this priority**: Đây là giá trị cốt lõi của sản phẩm và là ưu tiên số 1 ("tự động hóa > chất lượng hình ảnh"). Không có luồng này thì không có sản phẩm.

**Independent Test**: Nhập 10 ý tưởng tiếng Việt đa dạng (giáo dục, tin tức, giới thiệu phần mềm…) ở chế độ Tự động, không can thiệp giữa chừng, và kiểm tra video đầu ra.

**Acceptance Scenarios**:

1. **Given** người dùng đã đăng nhập và còn quota, **When** nhập một ý tưởng và nhấn tạo ở chế độ Tự động, **Then** hệ thống trả về video hoàn chỉnh có hình động, giọng đọc tiếng Việt, phụ đề, nhạc nền mà không dừng lại hỏi người dùng.
2. **Given** video ngắn (≤ 60 giây) đang được tạo, **When** kịch bản được viết, **Then** 3 giây đầu chứa một câu mở đầu thu hút (hook) và tổng thời lượng sát với thời lượng mục tiêu (±10%).
3. **Given** một video đã hoàn thành, **When** người dùng xem, **Then** không có chữ tràn khung, chữ đè nhau, chữ nằm trong vùng bị giao diện mạng xã hội che, hoặc dấu tiếng Việt bị lỗi.
4. **Given** một video đã hoàn thành, **When** người dùng xem, **Then** phụ đề highlight đúng từ đang được đọc, lệch so với giọng đọc dưới 100 ms, không ngắt dòng giữa một từ.
5. **Given** bước tự kiểm tra phát hiện lỗi hiển thị ở một cảnh, **When** hệ thống tự sửa quá số lần cho phép mà vẫn lỗi, **Then** người dùng nhận thông báo dễ hiểu chỉ rõ cảnh nào có vấn đề và gợi ý cách xử lý.
6. **Given** bất kỳ lỗi nào xảy ra, **When** hiển thị cho người dùng, **Then** thông báo không chứa mã, dữ liệu kỹ thuật hay log, và luôn kèm gợi ý bước tiếp theo.

---

### User Story 2 - Xem trước và chỉnh sửa video bằng chat (Priority: P2)

Sau khi có video, người dùng xem trước ngay trong trình duyệt (có âm thanh, tua được tới bất kỳ khung hình nào, không cần chờ xuất file). Họ gõ yêu cầu bằng ngôn ngữ tự nhiên như "làm cảnh 3 chậm lại", "đổi màu nền sang xanh", "bỏ cảnh cuối", "đổi giọng nữ miền Nam", hoặc chọn một cảnh trên thanh thumbnail rồi gõ yêu cầu chỉ cho cảnh đó. Hệ thống chỉ thay đổi phần bị ảnh hưởng, giữ nguyên phần còn lại. Mỗi lần sửa tạo một phiên bản mới; người dùng có thể hoàn tác, làm lại hoặc khôi phục phiên bản cũ.

**Why this priority**: Video tự động hiếm khi đúng ý 100% ngay lần đầu; chỉnh sửa không cần kỹ năng là điều khác biệt so với việc phải tạo lại từ đầu.

**Independent Test**: Lấy một video có sẵn, thực hiện 3 yêu cầu sửa bằng chat khác loại (thời lượng, màu sắc, giọng đọc), kiểm tra chỉ các cảnh liên quan thay đổi và có thể khôi phục từng phiên bản.

**Acceptance Scenarios**:

1. **Given** video có 8 cảnh, **When** người dùng yêu cầu "đổi màu nền cảnh 3 sang xanh", **Then** chỉ cảnh 3 thay đổi; các cảnh khác giống hệt trước đó và không phải xử lý lại.
2. **Given** người dùng gõ một yêu cầu mơ hồ (ví dụ "làm đẹp hơn"), **When** hệ thống không xác định được ý định, **Then** hệ thống hỏi lại đúng một câu ngắn thay vì tự đoán.
3. **Given** đã có 3 lần sửa, **When** người dùng nhấn hoàn tác hai lần, **Then** video quay về trạng thái sau lần sửa thứ nhất; nhấn làm lại thì tiến tới đúng thứ tự.
4. **Given** đang xem trước, **When** người dùng kéo tới một thời điểm bất kỳ, **Then** khung hình và âm thanh tại đó hiển thị đúng như trong video xuất ra.
5. **Given** người dùng sửa bằng chat, **When** hệ thống phản hồi, **Then** không có HTML, JSON hay thuật ngữ kỹ thuật nào xuất hiện trong giao diện.

---

### User Story 3 - Chế độ Duyệt và chọn phong cách (Priority: P3)

Người dùng muốn kiểm soát nhiều hơn chọn chế độ Duyệt. Hệ thống dừng sau khi viết kịch bản để người dùng sửa hoặc chấp nhận lời đọc; sau đó đề xuất 2–3 phong cách hình ảnh phù hợp kèm lý do ngắn và ảnh xem trước để người dùng chọn; rồi dừng lần nữa ở bước storyboard (lưới thumbnail các cảnh) trước khi tạo video cuối.

**Why this priority**: Phục vụ khách hàng chuyên nghiệp cần duyệt nội dung trước khi tốn thời gian và chi phí xuất video. Dùng chung quy trình với chế độ Tự động nên chi phí thêm thấp.

**Independent Test**: Tạo một video ở chế độ Duyệt, sửa một câu trong kịch bản, chọn phong cách số 2, bỏ một cảnh ở storyboard, rồi xác nhận video cuối phản ánh đúng cả ba thay đổi.

**Acceptance Scenarios**:

1. **Given** chế độ Duyệt, **When** kịch bản được viết xong, **Then** quy trình dừng và hiển thị kịch bản cho người dùng sửa hoặc chấp nhận.
2. **Given** kịch bản đã được chấp nhận, **When** đến bước chọn phong cách, **Then** người dùng thấy 2–3 đề xuất, mỗi đề xuất có tên, lý do ngắn và ảnh xem trước.
3. **Given** chế độ Tự động, **When** đến bước chọn phong cách, **Then** hệ thống tự lấy đề xuất số 1 và không dừng.
4. **Given** storyboard đang hiển thị dạng lưới thumbnail, **When** người dùng chấp nhận, **Then** video cuối được tạo đúng theo storyboard đó.

---

### User Story 4 - Tạo video từ nhiều loại nguồn nội dung (Priority: P4)

Ngoài ý tưởng tự do, người dùng có thể đưa vào: kịch bản viết sẵn (giữ nguyên lời, chỉ chia cảnh và dựng hình), đường dẫn bài báo (lấy nội dung chính và ảnh minh họa nếu được phép), kho mã nguồn GitHub (giới thiệu dự án hoặc tóm tắt thay đổi), file dữ liệu bảng (dựng biểu đồ động), hoặc file âm thanh/video có sẵn (chuyển thành lời đọc có mốc thời gian từng từ, có thể dùng chính âm thanh đó làm giọng đọc).

**Why this priority**: Mở rộng đáng kể các loại video phục vụ được (tin tức, changelog phần mềm, dữ liệu), nhưng sản phẩm vẫn có giá trị chỉ với nguồn ý tưởng.

**Independent Test**: Với mỗi loại nguồn, tạo một video mẫu và xác nhận video qua được bước tự kiểm tra chất lượng.

**Acceptance Scenarios**:

1. **Given** người dùng dán kịch bản viết sẵn, **When** tạo video, **Then** lời đọc trong video trùng khớp từng chữ với kịch bản (sau chuẩn hóa Unicode).
2. **Given** người dùng dán đường dẫn một bài báo, **When** tạo video, **Then** nội dung video dựa trên phần bài viết chính, không lấy quảng cáo, menu hay chân trang.
3. **Given** người dùng dán đường dẫn trỏ tới địa chỉ nội bộ/riêng tư, **When** hệ thống xử lý, **Then** yêu cầu bị từ chối với thông báo dễ hiểu.
4. **Given** người dùng tải lên file dữ liệu bảng, **When** tạo video, **Then** số liệu trong biểu đồ khớp với dữ liệu gốc.
5. **Given** người dùng tải lên file ghi âm giọng của chính họ, **When** tạo video, **Then** video dùng giọng đó và phụ đề khớp với lời nói.

---

### User Story 5 - Tạo hàng loạt từ template và bảng dữ liệu (Priority: P5)

Người dùng lưu một dự án thành template có biến (ví dụ `{{ten_khach_hang}}`), tải lên bảng dữ liệu 100 dòng, và hệ thống tạo 100 video, mỗi dòng một video. Có trang theo dõi tiến độ từng dòng, chạy lại riêng các dòng lỗi và tải tất cả về dưới dạng một file nén.

**Why this priority**: Đặc tả nguồn đánh dấu "rất quan trọng" — đây là động lực doanh thu chính cho khách hàng doanh nghiệp, nhưng phụ thuộc vào việc luồng tạo đơn lẻ (P1) đã ổn định.

**Independent Test**: Chạy một lô 100 dòng từ template video 30 giây, xác nhận 100 video được tạo, mỗi video mang đúng giá trị biến của dòng tương ứng.

**Acceptance Scenarios**:

1. **Given** một template có 2 biến và bảng 100 dòng hợp lệ, **When** chạy lô, **Then** tạo đúng 100 video, mỗi video chứa đúng giá trị của dòng mình.
2. **Given** bảng có cột thiếu so với biến của template, **When** người dùng tải lên, **Then** hệ thống báo rõ cột nào thiếu trước khi chạy.
3. **Given** 3 dòng bị lỗi trong lô, **When** người dùng nhấn chạy lại các dòng lỗi, **Then** chỉ 3 dòng đó được xử lý lại.
4. **Given** lô đã hoàn thành, **When** người dùng nhấn tải về tất cả, **Then** nhận một file nén chứa mọi video thành công kèm phụ đề.
5. **Given** một lô lớn đang chạy, **When** người dùng khác trong cùng hệ thống tạo một video đơn lẻ hoặc xem trước, **Then** yêu cầu đơn lẻ được ưu tiên xử lý trước lô.

---

### User Story 6 - Workspace, thành viên, quota và thanh toán (Priority: P6)

Khách hàng đăng ký bằng email hoặc tài khoản Google, tạo workspace và mời thành viên với vai trò Owner / Admin / Editor / Viewer. Workspace đăng ký gói theo tháng hoặc năm, có thể mua thêm credit. Người dùng luôn thấy mức đã dùng (phút video, số video, số ký tự giọng đọc, số ảnh AI, dung lượng lưu trữ, số tác vụ đồng thời) so với hạn mức của gói; vượt hạn mức thì bị chặn kèm hướng dẫn nâng cấp.

**Why this priority**: Bắt buộc để thương mại hóa, nhưng không cần cho việc chứng minh giá trị tạo video.

**Independent Test**: Tạo 2 workspace, xác nhận người của workspace A không xem/sửa/tải được bất cứ thứ gì của workspace B; đặt hạn mức thấp và xác nhận việc vượt hạn mức bị chặn.

**Acceptance Scenarios**:

1. **Given** người dùng thuộc workspace A, **When** cố truy cập dự án, file hoặc video của workspace B bằng bất kỳ cách nào, **Then** bị từ chối.
2. **Given** một thành viên có vai trò Viewer, **When** cố sửa hoặc xóa dự án, **Then** bị từ chối.
3. **Given** workspace đã dùng hết phút video của gói, **When** tạo video mới, **Then** yêu cầu bị chặn trước khi tiêu tốn chi phí, kèm thông báo và lựa chọn nâng cấp hoặc mua thêm credit.
4. **Given** thanh toán thành công, **When** quay lại ứng dụng, **Then** hạn mức mới có hiệu lực ngay.

---

### User Story 7 - Tích hợp qua API công khai và webhook (Priority: P7)

Nhà phát triển của khách hàng tạo khóa API theo workspace, gọi API có phiên bản để: tạo video từ ý tưởng/kịch bản/đường dẫn, tạo từ template + biến, chạy lô từ bảng dữ liệu, xem trạng thái, lấy link tải, liệt kê phong cách và giọng đọc. Khi video xong hoặc lỗi, hệ thống gọi webhook có chữ ký để họ xác minh. Có trang tài liệu API tự sinh.

**Why this priority**: Mở kênh khách hàng tự động hóa quy mô lớn, nhưng dựa trên toàn bộ năng lực đã có ở P1–P6.

**Independent Test**: Dùng khóa API tạo một video, nhận webhook, xác minh chữ ký và tải video qua link có hạn.

**Acceptance Scenarios**:

1. **Given** một khóa API hợp lệ, **When** gọi tạo video từ ý tưởng, **Then** nhận mã tác vụ và có thể theo dõi đến khi hoàn tất.
2. **Given** khóa API bị thu hồi hoặc sai, **When** gọi API, **Then** bị từ chối.
3. **Given** một client gọi vượt giới hạn tần suất, **When** tiếp tục gọi, **Then** bị từ chối tạm thời với thông tin thời điểm được gọi lại.
4. **Given** video hoàn tất, **When** webhook được gửi, **Then** nội dung có chữ ký mà bên nhận xác minh được.
5. **Given** link tải đã hết hạn, **When** truy cập, **Then** bị từ chối.

---

### User Story 8 - Brand kit và tài sản riêng (Priority: P8)

Workspace lưu brand kit (logo, bảng màu, font) và thư viện tài sản (ảnh, video footage, nhạc, giọng thu sẵn). Khi bật brand kit cho một dự án, màu và font của brand kit thay thế màu/font của phong cách; logo xuất hiện nhất quán trong video. Tùy chọn theo dự án: bật sinh ảnh/video bằng AI cho cảnh, với chi phí được tính vào hạn mức.

**Why this priority**: Tăng giá trị cho khách doanh nghiệp, không cần cho luồng lõi.

**Independent Test**: Tải brand kit, bật cho một dự án, xác nhận mọi cảnh dùng màu/font của brand và logo hiển thị đúng ở cả 4 tỷ lệ.

**Acceptance Scenarios**:

1. **Given** brand kit đã bật, **When** tạo video, **Then** màu và font của brand thay thế màu/font của phong cách ở mọi cảnh.
2. **Given** người dùng tải lên file sai định dạng hoặc quá kích thước, **When** tải lên, **Then** bị từ chối với thông báo dễ hiểu.
3. **Given** sinh ảnh AI chưa được bật cho dự án, **When** tạo video, **Then** chỉ dùng đồ họa dựng sẵn, không phát sinh chi phí sinh ảnh.

---

### User Story 9 - Quản trị vận hành (Priority: P9)

Quản trị viên của nền tảng quản lý người dùng và gói, xem chi phí AI thực tế so với doanh thu theo từng workspace, theo dõi hàng đợi và các máy xử lý video. Đội nội dung của nền tảng có thể thêm một phong cách mới mà không phải sửa phần lõi của hệ thống.

**Why this priority**: Cần cho vận hành bền vững nhưng không trực tiếp phục vụ khách hàng cuối.

**Independent Test**: Tạo vài video ở các workspace khác nhau, mở trang quản trị và xác nhận chi phí từng bước của từng video được ghi lại và tổng hợp đúng.

**Acceptance Scenarios**:

1. **Given** một video đã hoàn tất, **When** quản trị viên xem chi tiết, **Then** thấy số token AI, số ký tự giọng đọc, số ảnh AI và chi phí ước tính theo từng bước.
2. **Given** đội nội dung thêm một phong cách mới theo đúng quy cách, **When** triển khai, **Then** phong cách xuất hiện trong danh sách lựa chọn mà không thay đổi phần lõi.

---

### Edge Cases

- Văn bản rất dài trong một ô nội dung (tiêu đề 200 ký tự, từ ghép dài, URL dài): chữ phải tự co cỡ hoặc xuống dòng, không bao giờ tràn khung hay đè nhau.
- Chuỗi tiếng Việt có chữ hoa có dấu (Ẩ, Ỹ, Ự…), tổ hợp dấu dạng tách rời (không chuẩn hóa) do người dùng dán vào: phải hiển thị đúng sau khi chuẩn hóa; hiệu ứng tách từng chữ không được tách dấu khỏi chữ.
- Video ở biên thời lượng (30 giây và 10 phút): cả hai đều tạo thành công; video 10 phút vẫn có tiến độ rõ ràng.
- Bài báo ở đường dẫn yêu cầu đăng nhập, bị chặn, không có nội dung chính, hoặc ảnh không cho phép tái sử dụng: báo lỗi dễ hiểu hoặc bỏ ảnh, không dùng ảnh không được phép.
- Kho GitHub riêng tư, không tồn tại hoặc không có README.
- File âm thanh không có lời nói, nhiều người nói, hoặc ngôn ngữ khác tiếng Việt.
- Dịch vụ giọng đọc hoặc AI bên ngoài tạm thời lỗi: tự thử lại; nếu vẫn lỗi, tác vụ dừng ở bước đó, giữ kết quả các bước trước và cho phép tiếp tục mà không làm lại từ đầu.
- Dịch vụ giọng đọc không trả mốc thời gian từng từ: hệ thống vẫn phải tự xác định mốc thời gian để đồng bộ phụ đề và hình.
- Yêu cầu chat mâu thuẫn với nội dung hiện có (ví dụ "bỏ cảnh 12" khi chỉ có 8 cảnh): hệ thống giải thích ngắn và không thay đổi gì.
- Hai thành viên cùng sửa một dự án cùng lúc: không mất phiên bản của ai; phiên bản sau được tạo trên nền phiên bản mới nhất.
- Hết hạn mức giữa chừng khi đang chạy lô: các video đang xử lý được hoàn tất, các dòng còn lại tạm dừng và người dùng được báo.
- Nội dung do AI tạo cố gắng truy cập mạng, đọc file hệ thống hoặc dùng thời gian thực: bị chặn và không ảnh hưởng tới video khác.
- Tạo lại cùng một dự án hai lần không có thay đổi: kết quả giống nhau từng khung hình và không tốn chi phí xử lý lại.

## Requirements _(mandatory)_

### Functional Requirements

**Đầu vào và tư liệu nguồn**

- **FR-001**: Hệ thống MUST cho phép tạo video từ: ý tưởng mô tả, kịch bản viết sẵn, đường dẫn bài viết, kho mã nguồn GitHub công khai, file dữ liệu bảng (CSV/JSON), và file âm thanh/video có sẵn.
- **FR-002**: Hệ thống MUST chuẩn hóa mọi loại đầu vào về cùng một dạng tư liệu nguồn (văn bản có cấu trúc + thông tin mô tả) trước khi xử lý tiếp.
- **FR-003**: Với kịch bản viết sẵn, hệ thống MUST giữ nguyên lời thoại, chỉ chia cảnh và dựng hình.
- **FR-004**: Với đường dẫn bài viết, hệ thống MUST chỉ lấy nội dung chính (bỏ quảng cáo, menu), chỉ lấy ảnh khi nguồn cho phép, và MUST từ chối đường dẫn trỏ tới địa chỉ nội bộ/riêng tư.
- **FR-005**: Với kho GitHub, hệ thống MUST đọc phần giới thiệu, ghi chú phát hành và các thay đổi gần đây để làm video giới thiệu hoặc tóm tắt thay đổi.
- **FR-006**: Với âm thanh/video có sẵn, hệ thống MUST tạo bản chép lời có mốc thời gian từng từ và MUST cho phép dùng chính âm thanh đó làm giọng đọc.
- **FR-007**: Hệ thống MUST chuẩn hóa Unicode (NFC) cho mọi văn bản đầu vào.

**Viết kịch bản và dựng cảnh**

- **FR-008**: Hệ thống MUST hỗ trợ hai chế độ dùng chung một quy trình: Tự động (không dừng) và Duyệt (dừng sau kịch bản và sau storyboard).
- **FR-009**: Hệ thống MUST viết lời đọc tự nhiên, đúng thời lượng mục tiêu (30 giây – 10 phút), có hook trong 3 giây đầu với video ngắn. Ở bản đầu, lời đọc và phụ đề của video chỉ hỗ trợ tiếng Việt; tiếng Anh là mở rộng về sau (Video Spec vẫn ghi ngôn ngữ để mở rộng không phải đổi cấu trúc). Giao diện vẫn song ngữ theo FR-032.
- **FR-010**: Hệ thống MUST đề xuất 2–3 phong cách phù hợp với nội dung, mỗi đề xuất kèm lý do ngắn và ảnh xem trước; ở chế độ Tự động tự chọn đề xuất số 1.
- **FR-011**: Hệ thống MUST cho phép trộn nhiều phong cách theo từng cảnh trong một video, có cảnh chuyển tiếp hợp lý và một phong cách chủ đạo quy định font phụ đề và logo cho cả video.
- **FR-012**: Hệ thống MUST lưu toàn bộ nội dung một video dưới dạng một bản mô tả có cấu trúc và có phiên bản (gọi là Video Spec), làm nguồn sự thật duy nhất; video được tạo lại từ bản mô tả này.
- **FR-013**: Hệ thống MUST dựng cảnh chủ yếu từ các mẫu cảnh của phong cách; chỉ khi không mẫu nào phù hợp mới dùng "cảnh tự do", và cảnh tự do MUST tuân thủ màu/font của phong cách, MUST qua kiểm tra an toàn (không truy cập mạng, không tải mã ngoài, không dùng thời gian thực). Mục tiêu dưới 20% số cảnh là cảnh tự do.
- **FR-014**: Hệ thống MUST mặc định chỉ dùng đồ họa dựng sẵn; sinh ảnh/video bằng AI là tùy chọn bật theo dự án, kết quả sinh ra được tái sử dụng khi không đổi và được tính vào chi phí.
- **FR-015**: Hệ thống MUST cho phép chọn nhà cung cấp và mô hình AI riêng cho từng bước (kịch bản, dựng cảnh, kiểm tra hình) bằng cấu hình, không cần sửa sản phẩm.

**Âm thanh và phụ đề**

- **FR-016**: Hệ thống MUST cung cấp giọng đọc tiếng Việt có cả giọng nam và nữ, và giọng Bắc và Nam khi nhà cung cấp hỗ trợ; hỗ trợ nhiều nhà cung cấp giọng đọc với một nhà cung cấp mặc định.
- **FR-017**: Thời lượng từng cảnh và thời điểm xuất hiện của các phần tử MUST bám theo mốc thời gian của câu và từ trong giọng đọc (kể cả khi nhà cung cấp không trả mốc thời gian, và với giọng thu sẵn của người dùng).
- **FR-018**: Hệ thống MUST tạo phụ đề highlight từng từ theo thời gian thực, kiểu do phong cách quy định, có thể tắt; hiển thị đúng dấu tiếng Việt, không ngắt dòng giữa một từ; và MUST xuất kèm file phụ đề `.srt`.
- **FR-019**: Hệ thống MUST kèm sẵn thư viện nhạc nền miễn phí bản quyền có thông tin giấy phép, tâm trạng (mood) và nhịp (BPM); AI chọn nhạc theo tâm trạng của kịch bản; người dùng có thể tải nhạc riêng.
- **FR-020**: Hệ thống MUST tự giảm âm lượng nhạc khi có giọng đọc và chuẩn hóa độ to đầu ra về khoảng -14 LUFS.
- **FR-021**: Hệ thống MUST gắn hiệu ứng âm thanh (whoosh, pop, click…) vào chuyển cảnh và phần tử xuất hiện theo bộ hiệu ứng của phong cách, có thể tắt.

**Kiểm tra chất lượng tự động**

- **FR-022**: Trước khi xuất video, hệ thống MUST tự kiểm tra từng cảnh để phát hiện: chữ tràn khung, chữ đè nhau, phần tử nằm ngoài vùng an toàn, độ tương phản thấp, lỗi hiển thị dấu tiếng Việt.
- **FR-023**: Khi phát hiện lỗi, hệ thống MUST tự sửa và kiểm tra lại tối đa một số lần cấu hình được; nếu vẫn lỗi MUST báo cho người dùng cảnh nào có vấn đề bằng ngôn ngữ dễ hiểu.
- **FR-024**: Mỗi tỷ lệ khung hình MUST có vùng an toàn riêng, đặc biệt tránh vùng bị giao diện TikTok/Reels/Shorts che ở tỷ lệ 9:16.

**Chỉnh sửa, xem trước và quản lý dự án**

- **FR-025**: Người dùng MUST chỉnh sửa video chỉ bằng chat ngôn ngữ tự nhiên, có thể nhắm vào một cảnh cụ thể bằng cách chọn cảnh trên thanh thumbnail.
- **FR-026**: Mỗi yêu cầu chỉnh sửa MUST được áp dụng như một thay đổi cục bộ trên Video Spec; chỉ các cảnh bị ảnh hưởng được xử lý lại.
- **FR-027**: Với yêu cầu mơ hồ, hệ thống MUST hỏi lại một câu ngắn thay vì đoán.
- **FR-028**: Hệ thống MUST cho xem trước trong trình duyệt có âm thanh, tua được tới bất kỳ khung hình nào, không phải chờ xuất file; nội dung xem trước MUST khớp với video xuất ra.
- **FR-029**: Người dùng MUST lưu, mở lại và nhân bản dự án.
- **FR-030**: Mỗi lần sửa bằng chat MUST tạo một phiên bản mới; người dùng MUST hoàn tác, làm lại và khôi phục phiên bản cũ được.
- **FR-031**: Người dùng MUST lưu dự án thành template có biến để dùng lại và chạy hàng loạt.
- **FR-032**: Giao diện MUST song ngữ Việt và Anh, mặc định tiếng Việt.
- **FR-033**: Giao diện MUST không bao giờ hiển thị mã, dữ liệu cấu trúc hoặc log kỹ thuật cho người dùng cuối; mọi lỗi được diễn đạt dễ hiểu kèm gợi ý xử lý.
- **FR-034**: Tiến độ xử lý MUST được cập nhật trực tiếp lên giao diện bằng câu dễ hiểu (ví dụ "Đang dựng cảnh 4/9").

**Xuất video**

- **FR-035**: Hệ thống MUST xuất video ở các tỷ lệ 16:9, 9:16, 1:1, 4:5; mỗi phong cách có bố cục riêng cho từng tỷ lệ (không chỉ co giãn); một dự án xuất được nhiều tỷ lệ trong một lần.
- **FR-036**: Video đầu ra MUST là MP4 1080p, 30 khung hình/giây, tương thích với các nền tảng mạng xã hội phổ biến; hệ thống MUST sẵn sàng mở rộng lên 60 khung hình/giây và 4K mà không thay đổi luồng người dùng.
- **FR-037**: Mỗi video MUST đi kèm file phụ đề `.srt` và ảnh thumbnail được tự chọn từ khung hình đẹp nhất.
- **FR-038**: Tạo lại cùng một Video Spec với cùng cấu hình MUST cho kết quả giống nhau từng khung hình; cảnh không đổi MUST không phải xử lý lại.

**Tạo hàng loạt**

- **FR-039**: Hệ thống MUST tạo một video cho mỗi dòng của bảng dữ liệu dựa trên một template, kiểm tra bảng có đủ biến trước khi chạy.
- **FR-040**: Hệ thống MUST xử lý lô song song, có trang theo dõi tiến độ từng dòng, chạy lại riêng các dòng lỗi và tải về toàn bộ dưới dạng một file nén.
- **FR-041**: Yêu cầu xem trước và video đơn lẻ MUST được ưu tiên hơn video thuộc lô; mỗi workspace có giới hạn số tác vụ đồng thời theo gói.

**Phong cách (style pack)**

- **FR-042**: Mỗi phong cách MUST được đóng gói độc lập, thêm mới không cần sửa phần lõi; mỗi phong cách gồm: thông tin mô tả song ngữ và loại nội dung/tỷ lệ phù hợp, bộ màu–font–cỡ chữ–khoảng cách, tối thiểu 8 loại mẫu cảnh (mở đầu, tiêu đề, điểm nhấn + nội dung, danh sách, so sánh, số liệu/biểu đồ, trích dẫn, kêu gọi hành động/kết) với bố cục cho cả 4 tỷ lệ và giới hạn độ dài từng ô nội dung, bộ chuyển động (vào, ra, nhấn mạnh, chuyển cảnh), kiểu phụ đề, bộ hiệu ứng âm thanh, mood nhạc gợi ý, hướng dẫn tinh thần thị giác cho AI, video demo khoảng 30 giây dùng chung một kịch bản mẫu tiếng Việt, ảnh thumbnail và khung hình chuẩn để kiểm tra hồi quy hình ảnh.
- **FR-043**: Font của mọi phong cách MUST hỗ trợ đầy đủ dấu tiếng Việt, cho phép dùng thương mại và được lưu trữ nội bộ (không tải từ bên ngoài khi tạo video).
- **FR-044**: Mọi yếu tố ngẫu nhiên trong phong cách MUST tái lập được (cùng đầu vào cho cùng kết quả) và mọi chuyển động MUST tua được tới bất kỳ thời điểm nào.
- **FR-045**: Nền tảng MUST cung cấp đủ 13 phong cách: Minimal/corporate, Kinetic typography, Infographic/data viz, Flat illustration 2D, Glassmorphism/gradient, Tin tức, Slide thuyết trình, Terminal/code, Neon/cyberpunk, Retro/VHS/pixel, Hand-drawn/whiteboard, Giấy cắt/collage, 3D nhẹ — theo thứ tự giao hàng ở mục Assumptions.

**Tài khoản, workspace, hạn mức và thanh toán**

- **FR-046**: Người dùng MUST đăng ký/đăng nhập bằng email hoặc tài khoản Google.
- **FR-047**: Workspace MUST có nhiều thành viên với vai trò Owner / Admin / Editor / Viewer; dữ liệu giữa các workspace MUST được cách ly hoàn toàn.
- **FR-048**: Hệ thống MUST ghi lại cho từng bước của từng video: lượng sử dụng AI, số ký tự giọng đọc, số ảnh/video AI sinh ra và chi phí ước tính (USD); dữ liệu này dùng cho hạn mức, thanh toán và báo cáo quản trị. Không đặt trần chi phí cho từng video.
- **FR-049**: Hệ thống MUST áp hạn mức theo gói cho: phút video, số video, số ký tự giọng đọc, số ảnh AI, dung lượng lưu trữ, số tác vụ đồng thời; hiển thị mức đã dùng; chặn yêu cầu vượt hạn mức trước khi phát sinh chi phí.
- **FR-050**: Hệ thống MUST hỗ trợ gói theo tháng, theo năm và mua thêm credit; cổng thanh toán cụ thể được chọn ở giai đoạn lập kế hoạch và có thể thay thế. Hệ thống MUST có gói miễn phí giới hạn: mặc định 3 video/tháng, mỗi video tối đa 60 giây, video xuất ra có watermark; không dùng được tạo hàng loạt, API công khai và sinh ảnh AI. Các con số giới hạn do quản trị viên cấu hình. Khi nâng cấp lên gói trả phí, các video xuất từ đó trở đi không còn watermark. Hệ thống MUST có biện pháp chống lạm dụng gói miễn phí (ví dụ một người tạo nhiều tài khoản).
- **FR-051**: Quản trị viên nền tảng MUST quản lý người dùng và gói, xem chi phí AI thực tế so với doanh thu theo workspace, và theo dõi hàng đợi cùng các máy xử lý.

**API công khai**

- **FR-052**: Hệ thống MUST cung cấp API công khai có phiên bản, xác thực bằng khóa API theo workspace, có giới hạn tần suất, với các thao tác: tạo video từ ý tưởng/kịch bản/đường dẫn, tạo từ template + biến, chạy lô từ bảng dữ liệu, xem trạng thái, lấy link tải, liệt kê phong cách và giọng đọc.
- **FR-053**: Hệ thống MUST gửi webhook có chữ ký khi video hoàn tất hoặc lỗi, và MUST có trang tài liệu API tự sinh.

**Bảo mật, dữ liệu, giấy phép**

- **FR-054**: Nội dung do AI tạo MUST chạy trong môi trường cách ly, không truy cập mạng và không đọc được file hệ thống.
- **FR-055**: Khóa API của nhà cung cấp MUST được mã hóa khi lưu; file tải lên MUST được kiểm tra định dạng và kích thước; link tải MUST có thời hạn.
- **FR-056**: Mọi thành phần bên thứ ba, font, nhạc, hiệu ứng âm thanh, icon MUST cho phép dùng thương mại trong sản phẩm SaaS mã nguồn đóng; danh sách giấy phép bên thứ ba MUST được duy trì và kiểm tra tự động.
- **FR-057**: Dữ liệu dự án MUST được sao lưu hằng ngày; file video cũ MUST được tự xóa theo chính sách lưu giữ của từng gói.
- **FR-058**: Hệ thống MUST có nhật ký có cấu trúc, theo dõi lỗi và số đo về hàng đợi, thời gian xử lý và chi phí mỗi video.

### Key Entities _(include if feature involves data)_

- **Người dùng (User)**: người có tài khoản; thuộc một hoặc nhiều workspace với một vai trò trong mỗi workspace.
- **Workspace**: đơn vị khách hàng và đơn vị cách ly dữ liệu; sở hữu dự án, brand kit, tài sản, template, khóa API, gói đăng ký và lượng sử dụng.
- **Thành viên (Membership)**: liên kết Người dùng – Workspace kèm vai trò Owner / Admin / Editor / Viewer.
- **Dự án (Project)**: một video đang được làm; có chế độ (Tự động/Duyệt), tư liệu nguồn và chuỗi phiên bản.
- **Tư liệu nguồn (Source Material)**: nội dung đầu vào đã chuẩn hóa (văn bản có cấu trúc + thông tin mô tả: loại nguồn, đường dẫn, ảnh kèm theo, bản chép lời có mốc thời gian).
- **Video Spec**: bản mô tả có cấu trúc, có phiên bản, là nguồn sự thật của một video: thông tin chung (ngôn ngữ, tỷ lệ, tốc độ khung hình, phong cách chủ đạo, brand kit, giọng đọc, nhạc), kịch bản, danh sách cảnh, âm thanh, phụ đề, biến.
- **Phiên bản (Version)**: một trạng thái của Video Spec sau một lần sửa; tạo nên lịch sử hoàn tác/làm lại/khôi phục.
- **Cảnh (Scene)**: phần của video, gồm phong cách, mẫu cảnh, nội dung các ô, tài sản, đoạn lời đọc liên kết, kiểu chuyển cảnh và tinh chỉnh (tốc độ, màu nhấn).
- **Phong cách (Style Pack)**: gói phong cách độc lập (xem FR-042).
- **Mẫu cảnh (Scene Template)**: một loại cảnh trong phong cách, có bố cục cho từng tỷ lệ và định nghĩa các ô nội dung kèm giới hạn.
- **Brand kit**: logo, bảng màu, font của workspace, ghi đè màu/font của phong cách khi bật.
- **Tài sản (Asset)**: ảnh, footage, nhạc, giọng thu sẵn, ảnh/video AI sinh ra; có nguồn gốc và thông tin giấy phép.
- **Giọng đọc (Voice)**: một giọng của một nhà cung cấp; có ngôn ngữ, giới tính, vùng miền.
- **Bản xuất (Render Output)**: file video theo một tỷ lệ, kèm phụ đề `.srt`, thumbnail, thời lượng và link tải có hạn.
- **Template**: dự án được lưu kèm danh sách biến để dùng lại.
- **Lô (Batch)**: một lần tạo hàng loạt từ template + bảng dữ liệu; gồm nhiều dòng, mỗi dòng có trạng thái và bản xuất riêng.
- **Tác vụ (Job)**: một bước xử lý của quy trình; có trạng thái, số lần thử lại, kết quả trung gian và chi phí.
- **Bản ghi sử dụng (Usage Record)**: lượng tài nguyên và chi phí ước tính theo bước, theo video, theo workspace.
- **Gói và Đăng ký (Plan / Subscription / Credit)**: hạn mức, chu kỳ thanh toán, credit mua thêm.
- **Khóa API và Webhook**: thông tin xác thực API theo workspace và điểm nhận thông báo có chữ ký.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với 10 ý tưởng tiếng Việt đa dạng (giáo dục, tin tức, giới thiệu phần mềm…) chạy chế độ Tự động, ít nhất 9/10 cho ra video không có lỗi hiển thị (tràn chữ, đè chữ, lỗi dấu, ra ngoài vùng an toàn) mà không cần con người can thiệp.
- **SC-002**: Độ lệch giữa phụ đề và giọng đọc dưới 100 ms trên mọi video kiểm thử.
- **SC-003**: Một người không biết code tạo được video từ một ý tưởng và sửa 3 lần bằng chat mà không gặp bất kỳ thông tin kỹ thuật nào trên giao diện.
- **SC-004**: Một phút video 1080p30 được xử lý xong trong tối đa 10 phút trên một máy xử lý chuẩn; thời gian giảm gần tuyến tính khi thêm máy xử lý.
- **SC-005**: Một lô 100 video dài 30 giây chạy xong không lỗi.
- **SC-006**: Tạo lại cùng một video hai lần cho kết quả giống nhau từng khung hình.
- **SC-007**: Từ một Video Spec mẫu, tạo được video ở cả 4 tỷ lệ khung hình, mỗi tỷ lệ có bố cục riêng và không lỗi hiển thị.
- **SC-008**: 100% yêu cầu vượt hạn mức bị chặn trước khi phát sinh chi phí; 0 trường hợp truy cập chéo dữ liệu giữa các workspace trong bộ kiểm thử cách ly.
- **SC-009**: Một lần sửa bằng chat nhắm vào một cảnh chỉ xử lý lại cảnh đó, và bản xem trước cập nhật nhanh hơn ít nhất 3 lần so với tạo lại toàn bộ video.
- **SC-010**: Mỗi phong cách có video demo; mỗi loại nguồn đầu vào có một video mẫu đạt kiểm tra chất lượng tự động.
- **SC-011**: Chi phí trung bình mỗi video được ghi nhận và báo cáo được theo từng bước; chi phí ghi nhận chênh lệch với hóa đơn thực tế của nhà cung cấp không quá 10%.
- **SC-012**: Cài đặt từ đầu chỉ theo hướng dẫn trên cả một máy Windows 11 và một máy chủ Linux trống bằng cùng một lệnh khởi động; cả hai chạy được toàn bộ luồng và cùng một Video Spec cho ra video giống nhau.
- **SC-013**: Chất lượng hình ảnh đạt mức của motion designer, kiểm chứng được bằng các tiêu chí sau trên bộ video kiểm thử:
  - **Nhịp:** với video ngắn, hình ảnh thay đổi đáng kể (cảnh mới hoặc phần tử mới xuất hiện) ít nhất mỗi 2–4 giây; không có đoạn nào màn hình đứng yên quá 4 giây.
  - **Khớp giọng đọc:** từ khóa xuất hiện trên màn hình trong khoảng ±150 ms so với lúc được đọc.
  - **Kiểu chữ:** chữ chính to, đậm, dễ đọc trên điện thoại; mỗi khung hình có tối đa một điểm nhấn chính và tối đa khoảng 12 từ chữ trên màn hình (không tính phụ đề).
  - **Màu sắc:** mỗi phong cách dùng một bảng màu giới hạn (nền + 1–2 màu nhấn); độ tương phản chữ/nền đạt mức dễ đọc (tương đương WCAG AA trở lên).
  - **Phụ đề:** nằm trong vùng an toàn, tối đa 2 dòng, highlight từ đang đọc bằng màu nhấn hoặc phóng to nhẹ.
  - **Chuyển động:** mọi chuyển động có gia tốc mượt (không chuyển động tuyến tính đều), chuyển cảnh ngắn (khoảng 0,3–0,6 giây) và có hiệu ứng âm thanh đi kèm khi bật.
  - **Bố cục:** không tràn chữ, không đè chữ, phần tử chính chiếm phần lớn khung hình, không có khoảng trống vô nghĩa.
  - **Đánh giá cảm quan:** khi chấm mù trên thang 1–5, điểm trung bình của video tạo tự động đạt ít nhất 4.

## Assumptions

- **Người dùng mục tiêu**: chủ yếu là người làm nội dung, giáo dục, truyền thông và doanh nghiệp tại Việt Nam; không biết code; dùng trình duyệt máy tính để bàn là chính.
- **Loại video**: video giải thích/giáo dục, video ngắn mạng xã hội, tin tức/tóm tắt bài viết, giới thiệu repo GitHub/changelog; tối ưu nhất cho 30 giây – 2 phút, hỗ trợ tới 10 phút.
- **Thứ tự ưu tiên khi đánh đổi**: tự động hóa > chất lượng hình ảnh > số phong cách > tốc độ > dễ dùng.
- **Thứ tự giao hàng** theo milestone của đặc tả nguồn, mỗi milestone dừng lại chờ duyệt:
  - M0: kế hoạch + thử nghiệm kỹ thuật engine render và đánh giá ít nhất 4 lựa chọn giọng đọc tiếng Việt (độ tự nhiên, giá trên 1.000 ký tự, có mốc thời gian từng từ không, giấy phép thương mại).
  - M1: lõi tạo video từ Video Spec, 3 phong cách (Minimal, Kinetic typography, Infographic).
  - M2: quy trình AI tự động đầy đủ (User Story 1, 3 phần quy trình).
  - M3: ứng dụng web, xem trước, sửa bằng chat, phiên bản; nâng lên 8 phong cách.
  - M4: đủ 13 phong cách, trộn phong cách, mọi loại nguồn, brand kit, sinh ảnh AI, thư viện template.
  - M5: tạo hàng loạt, xử lý phân tán, API + webhook, hạn mức, thanh toán, trang quản trị.
  - M6: kiểm tra bảo mật, triển khai, sao lưu, giám sát, tài liệu vận hành.
- **Quyết định để lại cho giai đoạn kế hoạch / người dùng chọn sau**: cổng thanh toán (so sánh nhóm quốc tế và nội địa phù hợp người bán ở Việt Nam), nhà cung cấp giọng đọc mặc định, cấu hình máy xử lý chuẩn và chi phí hạ tầng.
- **Mức hạn mức cụ thể của từng gói** (số phút, số video…) và **thời gian lưu giữ file video** theo gói do quản trị viên cấu hình; không cố định trong spec.
- **Thanh toán** có thể dùng cổng quốc tế hoặc nội địa; giá hiển thị và đơn vị tiền tệ theo cổng được chọn.
- **Ngôn ngữ video**: bản đầu chỉ tiếng Việt; các tiêu chí kiểm thử (đánh giá giọng đọc, kiểm tra hiển thị, phụ đề) chỉ áp dụng cho tiếng Việt.
- **Tiêu chí thị giác ở SC-013** do agent đề xuất vì đặc tả nguồn chưa có mô tả hai video tham khảo; sẽ được điều chỉnh nếu chủ sản phẩm bổ sung mô tả.
- **Kho GitHub**: chỉ hỗ trợ kho công khai ở bản đầu; kho riêng tư được xem là mở rộng sau.
- **Nhạc, hiệu ứng âm thanh, icon, font kèm sẵn** đều là tài nguyên được phép dùng thương mại; nền tảng không chịu trách nhiệm về bản quyền tài sản do người dùng tự tải lên (điều khoản sử dụng sẽ nêu rõ).
- **Triển khai**: chạy được trên một máy chủ Linux tự quản và trên máy phát triển Windows; máy xử lý video có thể thêm/bớt bằng cấu hình và sau này chạy trên máy thuê theo giờ mà không đổi sản phẩm.
- **Phụ thuộc bên ngoài**: dịch vụ AI tạo văn bản, dịch vụ giọng đọc, (tùy chọn) dịch vụ sinh ảnh/video, cổng thanh toán, dịch vụ đăng nhập Google, API GitHub.
