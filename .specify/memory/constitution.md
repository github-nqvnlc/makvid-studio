<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: all placeholders replaced (initial ratification)
  - [PRINCIPLE_1] → I. Plan và milestone có cổng duyệt
  - [PRINCIPLE_2] → II. Xong nghĩa là đã chạy thật
  - [PRINCIPLE_3] → III. VideoSpec là nguồn sự thật, render tất định
  - [PRINCIPLE_4] → IV. Tiếng Việt và chất lượng hình ảnh là bắt buộc
  - [PRINCIPLE_5] → V. Người dùng không bao giờ thấy thông tin kỹ thuật
- Added principles: VI. License thương mại sạch; VII. Cách ly và bảo mật mặc định;
  VIII. Trừu tượng hóa nhà cung cấp và đo chi phí
- Added sections: "Ràng buộc kỹ thuật và chất lượng", "Quy trình làm việc đa agent"
- Removed sections: none
- Templates checked (not modified by this command):
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate reads this file at runtime
  ✅ .specify/templates/spec-template.md — no conflict
  ✅ .specify/templates/tasks-template.md — tests are mandatory here (Principle II), tasks must include them
- Deferred TODOs: none
- Source: docs/prompt_requirement.md (mục 1, 4, 5, 6, 7)
-->

# MakVid Studio Constitution

## Core Principles

### I. Plan và milestone có cổng duyệt

- MUST NOT viết code sản phẩm trước khi plan được chủ sản phẩm duyệt.
- Công việc MUST đi theo milestone M0 → M6 trong `docs/prompt_requirement.md`. Mỗi milestone
  kết thúc bằng báo cáo gồm: đã làm gì, cách chạy thử, video mẫu đã render, kết quả test,
  tiêu chí nghiệm thu đạt/chưa, các quyết định cần chủ sản phẩm chọn. Sau đó MUST dừng chờ duyệt.
- Trong một milestone, agent tự quyết chi tiết kỹ thuật và ghi quyết định quan trọng thành ADR
  ngắn trong `docs/decisions/`. Agent MUST hỏi chủ sản phẩm khi quyết định ảnh hưởng tới
  chi phí, pháp lý/license, hoặc trải nghiệm người dùng.

**Lý do**: phạm vi lớn, nhiều agent cùng làm; cổng duyệt ngăn việc đi sai hướng tốn kém.

### II. Xong nghĩa là đã chạy thật

- "Xong" MUST có nghĩa là: đã render ra file MP4 mở được, test liên quan pass. Không báo cáo
  thành công dựa trên việc code trông có vẻ đúng.
- Với mọi thư viện hoặc API bên ngoài (engine render, TTS, LLM, cổng thanh toán…), agent MUST
  đọc tài liệu hoặc mã nguồn của phiên bản hiện tại trước khi dùng. MUST NOT dựa vào trí nhớ
  hay bịa API.
- Mỗi tính năng MUST có test tự động ở mức phù hợp: unit test cho spec, compiler, patch, quota;
  integration test cho pipeline với LLM/TTS giả lập có fixture; E2E cho luồng người dùng chính;
  visual regression (golden frames) cho mỗi style pack ở mỗi tỷ lệ khung hình.

**Lý do**: sản phẩm là video; chỉ file render thật mới chứng minh được chất lượng.

### III. VideoSpec là nguồn sự thật, render tất định

- AI MUST sinh VideoSpec có schema và có version, không viết thẳng một file HTML lớn cho cả video.
  Mọi chỉnh sửa MUST là patch trên VideoSpec; chỉ cảnh bị ảnh hưởng được render lại.
- Cùng VideoSpec + cùng cấu hình xuất MUST cho kết quả giống nhau từng frame.
- Trong mọi style pack và cảnh tự do: MUST NOT dùng `Math.random()`, `Date.now()` hay
  `setTimeout` trực tiếp; ngẫu nhiên MUST dùng PRNG có seed; thời gian MUST lấy từ timeline;
  mọi timeline MUST tua được.
- MUST NOT tải tài nguyên từ mạng/CDN lúc render; font, thư viện, asset MUST đóng gói cục bộ.
- Toàn bộ hệ thống MUST gọi render qua interface `Renderer`, và MUST luôn có một implementation
  dự phòng tự viết để thay engine mà không sửa phần còn lại.
- Style pack MUST độc lập: thêm phong cách mới không sửa code lõi.

**Lý do**: tất định là điều kiện cho cache, batch, render phân tán và kiểm thử hồi quy.

### IV. Tiếng Việt và chất lượng hình ảnh là bắt buộc

- Mọi văn bản đầu vào MUST được chuẩn hóa Unicode NFC. Test MUST bao gồm chuỗi có đủ dấu và
  chữ hoa có dấu (Ẩ, Ỹ, Ự…).
- Font MUST hỗ trợ đầy đủ dấu tiếng Việt. Hiệu ứng tách chữ MUST NOT tách dấu khỏi chữ.
  Phụ đề MUST NOT ngắt dòng giữa một từ.
- Chữ MUST tự co cỡ hoặc xuống dòng; MUST NOT tràn khung, đè nhau hay ra ngoài safe area của
  từng tỷ lệ (đặc biệt vùng UI TikTok/Reels/Shorts ở 9:16). Có kiểm tra tự động chứng minh.
- Chất lượng hình ảnh MUST đạt tiêu chí SC-013 của spec; khi đánh đổi, thứ tự ưu tiên là
  tự động hóa > chất lượng hình ảnh > số phong cách > tốc độ > dễ dùng.

**Lý do**: thị trường mục tiêu là người Việt; lỗi dấu hay tràn chữ làm hỏng toàn bộ video.

### V. Người dùng không bao giờ thấy thông tin kỹ thuật

- Giao diện cho người dùng cuối MUST NOT hiển thị HTML, JSON, stack trace, log hay mã lỗi thô.
- Mọi lỗi MUST được diễn đạt bằng ngôn ngữ dễ hiểu, kèm gợi ý bước tiếp theo.
- Tiến độ MUST được báo bằng câu dễ hiểu (ví dụ "Đang dựng cảnh 4/9").
- Yêu cầu chat mơ hồ MUST được hỏi lại bằng một câu ngắn, không đoán bừa.

**Lý do**: khách hàng không biết code; chỉ một chỗ lộ chi tiết kỹ thuật là mất niềm tin.

### VI. License thương mại sạch

- Mọi dependency, font, nhạc, SFX, icon MUST cho phép dùng thương mại trong SaaS mã nguồn đóng.
- MUST NOT dùng thành phần AGPL. MUST NOT dùng Remotion.
- License MUST được quét tự động trong CI; `THIRD_PARTY_LICENSES.md` MUST được cập nhật cùng
  thay đổi dependency/asset. Điều khoản license của thư viện animation MUST được ghi ADR.

**Lý do**: rủi ro pháp lý có thể buộc gỡ sản phẩm; phải chặn từ lúc thêm dependency.

### VII. Cách ly và bảo mật mặc định

- HTML do AI sinh MUST chỉ chạy trong Chromium sandbox: không có mạng, không đọc file hệ thống;
  cảnh tự do MUST qua linter + sandbox trước khi render.
- Ingest URL MUST chống SSRF. File tải lên MUST được kiểm tra định dạng và kích thước.
- Dữ liệu các workspace MUST cách ly hoàn toàn, có test chứng minh.
- API key của provider MUST được mã hóa khi lưu; link tải MUST là signed URL có hạn;
  webhook MUST có chữ ký HMAC.

**Lý do**: hệ thống chạy mã do AI sinh và giữ dữ liệu của nhiều khách hàng.

### VIII. Trừu tượng hóa nhà cung cấp và đo chi phí

- LLM, TTS, sinh ảnh/video, thanh toán, lưu trữ và render MUST đi qua interface
  (`TtsProvider`, `MediaGenProvider`, `PaymentProvider`, `Renderer`…); thay nhà cung cấp chỉ
  bằng cấu hình. LLM mặc định theo chuẩn OpenAI SDK; dùng SDK gốc của hãng MUST đặt sau adapter
  và có ADR.
- Mỗi bước của mỗi video MUST ghi lại token, số ký tự TTS, số ảnh/video sinh ra và chi phí ước
  tính (USD). Mỗi bước pipeline MUST là job idempotent, có retry, lưu kết quả trung gian.

**Lý do**: giá và chất lượng nhà cung cấp AI thay đổi nhanh; chi phí là nền của quota và billing.

## Ràng buộc kỹ thuật và chất lượng

- TypeScript strict cho toàn hệ thống; ESLint + Prettier. MUST NOT dùng `any` nếu không có
  comment ghi rõ lý do. Python chỉ dùng cho tác vụ bắt buộc (ví dụ forced alignment), đặt trong
  service riêng.
- Lựa chọn công nghệ mặc định nằm ở mục 5 của `docs/prompt_requirement.md`; chỗ đánh dấu
  "đề xuất" được đổi nếu nêu lý do trong plan.
- CI (GitHub Actions) MUST chạy: lint, typecheck, test, quét license, build Docker image,
  render thử một video ngắn.
- Môi trường dev MUST chạy được trên Windows (Docker Desktop/WSL2) và Linux; cùng VideoSpec
  MUST cho video giống nhau trên cả hai.
- Mục tiêu hiệu năng: 1 phút video 1080p30 render trong tối đa 10 phút trên một worker chuẩn,
  tăng gần tuyến tính khi thêm worker.

## Quy trình làm việc đa agent

- Dự án được làm bởi nhiều agent (Claude Code, Antigravity). `AGENTS.md` ở gốc repo MUST chứa
  quy ước, lệnh build/test, sơ đồ thư mục; `CLAUDE.md` MUST trỏ tới `AGENTS.md`.
- `docs/PROGRESS.md` MUST được cập nhật sau mỗi phiên làm việc đủ để agent khác tiếp tục.
- Quyết định kỹ thuật quan trọng MUST có ADR ngắn trong `docs/decisions/`.
- Ngôn ngữ: trao đổi với chủ sản phẩm, spec và báo cáo bằng tiếng Việt; code, tên biến,
  commit message và comment trong code bằng tiếng Anh.

## Governance

- Constitution này đứng trên mọi quy ước khác của dự án. Khi plan hoặc code mâu thuẫn với nó,
  constitution thắng, trừ khi được sửa đổi theo quy trình dưới đây.
- Sửa đổi MUST được chủ sản phẩm duyệt, ghi lý do, và kèm kế hoạch chuyển đổi nếu ảnh hưởng
  công việc đang làm.
- Phiên bản theo semver: MAJOR khi bỏ hoặc định nghĩa lại nguyên tắc; MINOR khi thêm nguyên tắc
  hoặc mở rộng đáng kể; PATCH khi làm rõ câu chữ.
- Mỗi plan MUST qua "Constitution Check"; mỗi báo cáo milestone MUST xác nhận tuân thủ. Mọi
  ngoại lệ MUST được ghi vào bảng Complexity Tracking của plan kèm lý do.
- Hướng dẫn vận hành hằng ngày cho agent nằm ở `AGENTS.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-12
