# Prompt cho agent: Nền tảng SaaS sản xuất video AI từ HTML animation

## 1. Vai trò và cách làm việc

Bạn là một staff engineer full-stack, đồng thời có kinh nghiệm motion design và xử lý video. Nhiệm vụ: xây dựng từ đầu một nền tảng SaaS tạo video bằng AI. AI viết kịch bản và dựng từng cảnh bằng HTML/CSS/JS có animation (GSAP), sau đó hệ thống render các cảnh thành MP4. Tài liệu này là đặc tả yêu cầu chính thức.

Quy tắc làm việc:

1. **Không viết code trước khi plan được duyệt.** Việc đầu tiên là tạo `docs/PLAN.md` theo mục "Việc đầu tiên" ở phần 8, rồi dừng lại chờ tôi duyệt.
2. **Làm theo milestone.** Mỗi milestone kết thúc bằng một báo cáo gồm: đã làm gì, cách chạy thử, video mẫu đã render, kết quả test, các tiêu chí nghiệm thu đạt hay chưa, các quyết định cần tôi chọn. Sau đó dừng lại chờ tôi duyệt rồi mới sang milestone tiếp.
3. **Trong một milestone, tự quyết các chi tiết kỹ thuật.** Ghi lại quyết định quan trọng vào `docs/decisions/` theo dạng ADR ngắn. Chỉ hỏi tôi khi quyết định ảnh hưởng đến chi phí, pháp lý/license, hoặc trải nghiệm người dùng.
4. **Kiểm chứng trước khi khẳng định.** Với mọi thư viện hay API bên ngoài (HyperFrames, nhà cung cấp TTS, LLM, cổng thanh toán), đọc tài liệu hoặc mã nguồn phiên bản hiện tại. Không dựa vào trí nhớ. Không tự bịa API.
5. **"Xong" nghĩa là đã chạy thật:** render ra file MP4, mở kiểm tra được, test pass. Không báo cáo thành công dựa trên việc code trông có vẻ đúng.
6. **Dự án được làm bởi nhiều agent (Claude Code và Antigravity).** Tạo `AGENTS.md` ở gốc repo chứa quy ước, lệnh build/test, sơ đồ thư mục. Tạo `CLAUDE.md` trỏ tới `AGENTS.md`. Luôn cập nhật `docs/PROGRESS.md` để agent khác tiếp tục được.
7. **Ngôn ngữ:** trao đổi với tôi bằng tiếng Việt. Code, tên biến, commit message và comment trong code viết bằng tiếng Anh.

## 2. Sản phẩm và người dùng

**Sản phẩm:** web SaaS thương mại, mã nguồn đóng, bán cho khách hàng. Khách đăng ký tài khoản, nhập ý tưởng hoặc nội dung nguồn, và nhận video MP4 hoàn chỉnh có animation, giọng đọc tiếng Việt, phụ đề và nhạc nền.

**Loại video mục tiêu:**

- Video giải thích, giáo dục
- Video ngắn mạng xã hội (TikTok, Reels, Shorts)
- Tin tức, tóm tắt bài viết
- Giới thiệu repo GitHub, changelog phần mềm

**Độ dài:** 30 giây đến 10 phút. Tối ưu nhất cho khoảng 30 giây đến 2 phút.

**Người dùng cuối không biết code.** Mọi thao tác phải qua giao diện và chat bằng ngôn ngữ tự nhiên. Không bao giờ hiển thị HTML, JSON hay log kỹ thuật cho người dùng. Lỗi phải được diễn đạt thành thông báo dễ hiểu, kèm gợi ý cách xử lý.

**Ưu tiên khi đánh đổi (theo thứ tự):** tự động hóa > chất lượng hình ảnh > số phong cách > tốc độ > dễ dùng.

**Video tham khảo về chất lượng mong muốn:**

- https://www.youtube.com/shorts/ih9h5rHQZzI
- https://www.youtube.com/shorts/MhXXcUlI-bU

> [BỔ SUNG TRƯỚC KHI GỬI: 3–5 dòng mô tả điều bạn thích ở hai video trên, ví dụ: nhịp cắt cảnh, kiểu chữ, màu sắc, kiểu phụ đề, cách chuyển cảnh. Agent không xem được video nên cần mô tả bằng chữ.]

Mức chất lượng tối thiểu: mỗi khung hình phải đẹp như do motion designer làm. Không tràn chữ, không đè chữ, không khoảng trống vô nghĩa. Chuyển động có easing mượt, nhịp khớp với giọng đọc.

## 3. Yêu cầu chức năng

### 3.1 Đầu vào

Người dùng tạo video từ một trong các nguồn sau. Mọi nguồn được chuẩn hóa về cùng một dạng "tư liệu nguồn" (Markdown + metadata) trước khi đưa cho AI.

- **Prompt mô tả:** AI tự viết kịch bản.
- **Kịch bản viết sẵn:** giữ nguyên lời thoại, AI chỉ chia cảnh và dựng hình.
- **URL bài viết:** trích nội dung chính, bỏ quảng cáo và menu. Lấy kèm ảnh minh họa nếu nguồn cho phép.
- **Repo GitHub:** đọc README, release notes, commit gần đây qua GitHub API. Dùng cho video giới thiệu hoặc changelog.
- **CSV / JSON:** dữ liệu để dựng biểu đồ động, và làm nguồn biến cho batch (mục 3.7).
- **Audio / video có sẵn:** chuyển thành transcript có timestamp từng từ. Có thể dùng chính audio đó làm lời đọc.

**Tài sản người dùng tải lên:** brand kit (logo, bảng màu, font), ảnh, video footage, nhạc riêng, giọng đọc thu sẵn. Brand kit được lưu theo workspace và ghi đè màu/font của style pack khi người dùng bật.

### 3.2 AI viết kịch bản và dựng cảnh

- **Nhiều nhà cung cấp LLM qua chuẩn OpenAI SDK:** mỗi provider là một cấu hình `baseURL + apiKey + model` (OpenAI, Claude qua endpoint tương thích OpenAI, Gemini, OpenRouter, hoặc endpoint tự host). Mặc định là Claude. Cho phép chọn model riêng cho từng bước (kịch bản, dựng cảnh, kiểm tra hình). Nếu một tính năng bắt buộc phải dùng SDK gốc của hãng, đặt nó sau một adapter và ghi ADR.
- **Hai chế độ chạy:**
  - **Tự động (mặc định):** một cú nhấp từ đầu vào ra video hoàn chỉnh, không dừng giữa chừng.
  - **Duyệt:** dừng sau bước kịch bản và sau bước storyboard để người dùng sửa hoặc chấp nhận, rồi mới render.
  - Cả hai chế độ dùng chung pipeline nhiều bước ở phần 6. Chế độ chỉ khác nhau ở điểm dừng.
- **Chọn phong cách:** AI đề xuất 2–3 phong cách phù hợp với nội dung, kèm lý do ngắn và ảnh thumbnail xem trước. Người dùng quyết định. Ở chế độ Tự động, lấy đề xuất số 1.
- **Trộn phong cách:** được phép dùng nhiều phong cách trong một video, theo từng cảnh. Bắt buộc có cảnh chuyển tiếp hợp lý, và một "style chủ đạo" quy định font phụ đề và logo để video không bị rời rạc.
- **Hình ảnh trong cảnh:** mặc định chỉ dùng HTML/SVG/CSS thuần. Tùy chọn bật theo dự án: sinh ảnh hoặc video bằng AI (Flux, SDXL, Imagen, Veo, Kling…) qua interface `MediaGenProvider`. Asset sinh ra được cache và tính vào chi phí.
- **Chi phí:** không đặt trần theo video. Nhưng phải ghi lại token, số ký tự TTS, số ảnh sinh ra, và chi phí ước tính (USD) cho từng bước của từng video. Dữ liệu này dùng cho quota và billing.

### 3.3 Âm thanh và phụ đề

- **TTS nhiều provider qua interface `TtsProvider`,** có một provider mặc định. **Giọng tiếng Việt là bắt buộc,** có cả giọng nam và nữ, giọng Bắc và Nam nếu provider có. Ở M0, agent phải benchmark ít nhất 4 lựa chọn (ví dụ Azure Speech vi-VN, Google Cloud TTS, ElevenLabs, OpenAI TTS, FPT.AI, Viettel AI, và một model open source tiếng Việt). Tiêu chí: độ tự nhiên, giá trên 1.000 ký tự, có trả về timestamp từng từ hay không, license thương mại.
- **Đồng bộ theo giọng đọc:** thời lượng cảnh và thời điểm animation của các phần tử bám theo timestamp của câu và từ. Nếu provider không trả timestamp, chạy forced alignment (ví dụ WhisperX hoặc whisper.cpp) để lấy. Giọng thu sẵn của người dùng cũng đi qua bước alignment này.
- **Phụ đề kiểu TikTok,** highlight từng từ theo thời gian thực. Kiểu phụ đề do style pack quy định, có thể tắt. Xuất kèm file `.srt`. Phải hiển thị đúng dấu tiếng Việt và không ngắt dòng giữa một từ.
- **Nhạc nền:** kèm sẵn thư viện nhạc miễn phí bản quyền, có metadata license, mood và BPM. Người dùng có thể tải nhạc riêng. AI chọn nhạc theo mood của kịch bản.
- **Ducking tự động:** giảm âm lượng nhạc khi có giọng đọc (ví dụ FFmpeg `sidechaincompress`). Chuẩn hóa loudness đầu ra về khoảng -14 LUFS.
- **Hiệu ứng âm thanh** (whoosh, pop, click) gắn vào chuyển cảnh và các phần tử xuất hiện. Mỗi style pack có bộ SFX riêng, có thể tắt.

### 3.4 Chỉnh sửa bằng chat

- Người dùng chỉ chỉnh sửa qua chat, ví dụ "làm cảnh 3 chậm lại", "đổi màu nền sang xanh", "bỏ cảnh cuối", "đổi giọng nữ miền Nam".
- AI chuyển yêu cầu thành một bản vá (patch) trên VideoSpec ở phần 6, không sinh lại toàn bộ video. Chỉ render lại các cảnh bị ảnh hưởng.
- Chat có thể nhắm vào một cảnh cụ thể: người dùng chọn cảnh trên thanh thumbnail rồi gõ yêu cầu.
- Yêu cầu mơ hồ thì AI hỏi lại một câu ngắn, không đoán bừa.

### 3.5 Xem trước và quản lý dự án

- Xem trước realtime trong trình duyệt, tua được tới bất kỳ khung hình nào, có âm thanh. Preview chạy trực tiếp HTML của cảnh, không cần chờ render.
- Lưu dự án, mở lại, nhân bản.
- Lịch sử phiên bản: mỗi lần sửa bằng chat tạo một phiên bản. Có undo/redo và khôi phục về phiên bản cũ.
- Thư viện template: lưu một dự án thành template có biến (`{{ten_khach_hang}}`) để dùng lại và chạy batch.
- Giao diện song ngữ Việt và Anh, mặc định tiếng Việt.

### 3.6 Xuất video

- Tỷ lệ khung hình: 16:9, 9:16, 1:1, 4:5. Mỗi style pack phải có layout riêng cho từng tỷ lệ, không chỉ co giãn. Một dự án có thể xuất ra nhiều tỷ lệ trong một lần.
- 1080p, 30 fps, MP4 H.264 + AAC. Để sẵn cấu hình cho 60 fps và 4K về sau.
- Đi kèm: file `.srt` và ảnh thumbnail được chọn tự động từ khung hình đẹp nhất.

### 3.7 Tạo hàng loạt (rất quan trọng)

- Từ một template + một file CSV, mỗi dòng sinh ra một video (ví dụ 100 video, mỗi video một tên khách hàng hoặc sản phẩm).
- Chạy song song trên hàng đợi render. Có trang theo dõi tiến độ, chạy lại từng dòng lỗi, tải về tất cả dưới dạng ZIP.
- Có thể gọi batch qua REST API (phần 7).

## 4. Hệ thống style pack

Mỗi phong cách là một **style pack** đóng gói độc lập, nằm trong `packages/styles/<style-id>/`. Thêm phong cách mới không cần sửa code lõi. Mỗi style pack gồm:

1. `manifest.json`: id, tên Việt/Anh, mô tả, hợp với loại nội dung nào, hợp với tỷ lệ khung hình nào, và các thư viện cần dùng.
2. **Design tokens:** bảng màu, font (bắt buộc hỗ trợ đầy đủ dấu tiếng Việt, license cho phép dùng thương mại, tự host), thang cỡ chữ, khoảng cách, bo góc, bóng. Brand kit của người dùng có thể ghi đè các token này.
3. **Thư viện scene template:** tối thiểu 8 loại cảnh, gồm: hook/mở đầu, tiêu đề, điểm nhấn + nội dung, danh sách, so sánh, số liệu/biểu đồ, trích dẫn, kêu gọi hành động/kết. Mỗi template có layout riêng cho 16:9, 9:16, 1:1, 4:5, và định nghĩa schema các slot nội dung (text, ảnh, số liệu) kèm giới hạn độ dài.
4. **Animation preset (GSAP):** vào cảnh, ra cảnh, nhấn mạnh, chuyển cảnh. Mọi timeline phải tua được (seekable) và cho kết quả giống nhau mỗi lần render.
5. **Kiểu phụ đề, bộ SFX, mood nhạc gợi ý.**
6. **Prompt fragment cho AI:** mô tả tinh thần thị giác, các điều nên và không nên, và ví dụ cảnh mẫu.
7. **Video demo và ảnh thumbnail** để hiển thị trong màn chọn phong cách, kèm golden frames cho visual regression test.

**13 phong cách cần làm.** Đánh dấu M1/M3/M4 là milestone phải hoàn thành:

| #   | Phong cách               | Milestone | Ghi chú kỹ thuật                                                                                  |
| --- | ------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| 1   | Minimal / corporate      | M1        | Nền sáng, lưới chặt, chuyển động tiết chế                                                         |
| 2   | Kinetic typography       | M1        | Chữ là nhân vật chính; tách từ/ký tự nhưng phải giữ đúng dấu tiếng Việt (không tách dấu khỏi chữ) |
| 3   | Infographic / data viz   | M1        | Biểu đồ cột, đường, tròn, số chạy; dựng bằng SVG từ dữ liệu CSV/JSON                              |
| 4   | Flat illustration 2D     | M3        | Thư viện icon/minh họa SVG có license thương mại                                                  |
| 5   | Glassmorphism / gradient | M3        | Hiệu năng: hạn chế `backdrop-filter` quá nặng, đo thời gian render                                |
| 6   | Kiểu tin tức             | M3        | Lower-third, ticker, nhãn "Nóng", ảnh nguồn                                                       |
| 7   | Kiểu slide thuyết trình  | M3        | Tiêu đề + gạch đầu dòng xuất hiện theo lời đọc                                                    |
| 8   | Terminal / code          | M3        | Gõ chữ, highlight cú pháp, phù hợp video repo/changelog                                           |
| 9   | Neon / cyberpunk         | M4        | Glow, scanline, glitch có seed cố định                                                            |
| 10  | Retro / VHS / pixel      | M4        | Nhiễu, lệch màu, font pixel có dấu tiếng Việt                                                     |
| 11  | Hand-drawn / whiteboard  | M4        | Nét vẽ SVG chạy (stroke-dashoffset), tay cầm bút                                                  |
| 12  | Giấy cắt / collage       | M4        | Texture giấy, bóng đổ, chuyển động stop-motion                                                    |
| 13  | 3D nhẹ (Three.js)        | M4        | Phải render tất định theo frame trong headless Chromium; đo GPU/CPU trên worker                   |

**Quy tắc bắt buộc cho mọi style pack:**

- Không dùng `Math.random()`, `Date.now()` hay `setTimeout` trực tiếp. Mọi yếu tố ngẫu nhiên phải dùng PRNG có seed. Mọi thời gian phải lấy từ timeline.
- Không tải tài nguyên từ CDN lúc render. Font, thư viện và asset phải được đóng gói cục bộ.
- Text tự co cỡ chữ hoặc xuống dòng khi dài. Không bao giờ tràn khung hoặc đè lên nhau. Có test tự động kiểm tra điều này.
- Giữ vùng an toàn (safe area) cho từng tỷ lệ, đặc biệt vùng bị UI TikTok/Reels che ở 9:16.
- Mỗi style có một video demo khoảng 30 giây dùng cùng một kịch bản mẫu tiếng Việt, để so sánh các phong cách với nhau.

## 5. Kiến trúc và công nghệ

Các lựa chọn dưới đây là mặc định. Chỗ nào đánh dấu "đề xuất" thì agent được đổi, nhưng phải nêu lý do trong PLAN.md.

| Lớp              | Lựa chọn                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Ngôn ngữ         | TypeScript (strict) cho toàn bộ hệ thống. Chỉ dùng Python cho tác vụ bắt buộc (ví dụ forced alignment), đặt trong service riêng |
| Monorepo         | pnpm workspaces + Turborepo (đề xuất)                                                                                           |
| Frontend + BFF   | Next.js (App Router), giao diện song ngữ bằng next-intl hoặc tương đương                                                        |
| Cơ sở dữ liệu    | PostgreSQL, ORM Drizzle hoặc Prisma (đề xuất)                                                                                   |
| Hàng đợi job     | Redis + BullMQ (đề xuất)                                                                                                        |
| Lưu trữ file     | S3-compatible: MinIO trên VPS, có thể chuyển sang Cloudflare R2 hoặc S3 bằng cấu hình                                           |
| Engine render    | HyperFrames (Apache 2.0) làm lõi, qua interface `Renderer`                                                                      |
| Animation        | GSAP (kiểm tra điều khoản license hiện hành cho SaaS thương mại và ghi ADR)                                                     |
| Mã hóa / trộn âm | FFmpeg                                                                                                                          |
| Triển khai       | Docker Compose trên VPS Linux. Môi trường dev chạy được trên Windows (qua Docker Desktop/WSL2) và Linux                         |

**Về HyperFrames (dùng làm lõi, nhưng agent đánh giá trước):** Ở M0, đọc repo `heygen-com/hyperframes` bản mới nhất và làm một spike: render một cảnh GSAP 10 giây, có tiếng Việt, ở 9:16 và 16:9. Báo cáo các điểm sau:

- API dùng dưới dạng thư viện (không chỉ CLI) có ổn định không.
- Tốc độ render trên một worker.
- Có render theo đoạn (chunk) được không.
- Có nhúng player preview vào Next.js được không.
- Rủi ro khi phiên bản còn dưới 1.0.

Dù chọn gì, toàn bộ hệ thống chỉ gọi qua interface `Renderer`. Phải có sẵn một implementation dự phòng tự viết bằng Puppeteer/Playwright + FFmpeg (điều khiển thời gian theo frame, chụp từng frame), để có thể thay engine mà không sửa phần còn lại. Không dùng Remotion (license không phù hợp SaaS thương mại).

**Cấu trúc dự kiến (đề xuất):**

```
apps/
  web/            Next.js: UI, auth, API routes, chat, preview
  worker-ai/      Job AI: kịch bản, storyboard, dựng cảnh, QA
  worker-render/  Job render: Chromium + HyperFrames + FFmpeg (scale ngang)
  worker-audio/   TTS, alignment, mix, ducking
packages/
  spec/           Schema VideoSpec (zod), patch, migration
  styles/         Các style pack
  compiler/       VideoSpec + style pack -> HTML của từng cảnh
  ai/             Provider LLM (chuẩn OpenAI SDK), prompt, agent pipeline
  tts/            Provider TTS + alignment
  media/          Ingest URL/GitHub/CSV/audio, sinh ảnh AI, thư viện nhạc/SFX
  renderer/       Interface Renderer + HyperFrames + bản dự phòng
  db/             Schema, migration
  billing/        Quota, usage, cổng thanh toán
```

**Cấu hình máy:** trong PLAN.md, đề xuất cấu hình cho 3 môi trường: máy dev Windows, VPS chạy web/DB, và máy render worker. Ghi rõ CPU, RAM, GPU có cần hay không, ước tính chi phí hàng tháng, và số phút video render được mỗi giờ.

## 6. VideoSpec, pipeline sản xuất và render

### 6.1 VideoSpec: nguồn sự thật duy nhất

AI không viết thẳng một file HTML lớn cho cả video. AI sinh ra **VideoSpec**: một JSON có schema (zod) và có version. Compiler ghép VideoSpec với style pack để tạo HTML cho từng cảnh. Mỗi lần sửa bằng chat là một patch trên VideoSpec. Nhờ vậy video ổn định, sửa được từng phần, và batch được.

VideoSpec tối thiểu gồm:

- `meta`: ngôn ngữ, tỷ lệ, fps, style chủ đạo, brand kit, giọng đọc, nhạc.
- `script`: các đoạn lời đọc.
- `scenes[]`: mỗi cảnh gồm `styleId`, `templateId`, nội dung các slot, asset, tham chiếu tới đoạn lời đọc, kiểu chuyển cảnh, và các tinh chỉnh (tốc độ, màu nhấn).
- `audio`: TTS, timestamp từng từ, nhạc, SFX.
- `captions`: bật/tắt và kiểu phụ đề.
- `variables`: các biến dùng cho template và batch.

**Chế độ "cảnh tự do":** khi không scene template nào phù hợp, AI được viết HTML/GSAP riêng cho một cảnh, nhưng phải tuân thủ token của style pack và qua được linter + sandbox (không truy cập mạng, không script ngoài, không dùng thời gian thực). Mục tiêu là dưới 20% số cảnh dùng chế độ này.

### 6.2 Các bước của pipeline

1. **Ingest:** chuẩn hóa đầu vào thành tư liệu nguồn.
2. **Kịch bản:** LLM viết lời đọc tiếng Việt tự nhiên, có hook trong 3 giây đầu với video ngắn, đúng độ dài mục tiêu. (Điểm dừng của chế độ Duyệt.)
3. **Gợi ý phong cách:** đề xuất 2–3 style, hoặc tự chọn ở chế độ Tự động.
4. **Storyboard:** chia cảnh, chọn template, điền slot, chọn asset, nhạc và SFX. Kết quả là VideoSpec. (Điểm dừng thứ hai của chế độ Duyệt, hiển thị dạng lưới thumbnail.)
5. **Audio:** sinh TTS, lấy timestamp hoặc chạy alignment, rồi cập nhật thời lượng cảnh theo audio.
6. **Compile:** dựng HTML từng cảnh. Sinh ảnh AI nếu được bật.
7. **QA tự động:** chụp các khung hình mốc của mỗi cảnh, đo DOM để phát hiện tràn chữ, đè chữ, ra ngoài safe area, độ tương phản thấp, lỗi font tiếng Việt. Có thể thêm một bước model có khả năng nhìn ảnh chấm điểm. Lỗi thì tự sửa rồi kiểm tra lại, tối đa N lần. Hết số lần mà vẫn lỗi thì báo rõ cho người dùng cảnh nào có vấn đề.
8. **Render và mux:** render theo cảnh, ghép video, trộn audio, ducking, chuẩn hóa loudness, xuất SRT và thumbnail.

Mỗi bước là một job riêng trên hàng đợi: có retry, idempotent, lưu kết quả trung gian, ghi log chi phí. Tiến độ được đẩy về UI realtime (SSE hoặc WebSocket) bằng ngôn ngữ dễ hiểu, ví dụ "Đang dựng cảnh 4/9".

### 6.3 Render phân tán và hiệu năng

- **Mục tiêu:** 1 phút video 1080p30 render xong trong tối đa 10 phút trên một worker chuẩn (định nghĩa cấu hình worker chuẩn trong PLAN.md). Nhanh hơn tuyến tính khi thêm worker.
- **Song song:** chia video theo cảnh hoặc theo đoạn, render song song trên nhiều worker hoặc nhiều máy, rồi ghép lại không lộ đường nối (khớp frame và audio).
- **Scale worker:** worker render là container độc lập, thêm hoặc bớt bằng cấu hình. Thiết kế sẵn để sau này chạy worker trên cloud (ví dụ máy thuê theo giờ) mà không đổi code.
- **Cache:** cảnh không đổi thì không render lại (khóa cache = hash của HTML cảnh + asset + cấu hình xuất).
- **Ưu tiên hàng đợi:** preview và job đơn lẻ được ưu tiên hơn batch. Mỗi workspace có giới hạn số job đồng thời theo gói.

## 7. SaaS, API, yêu cầu phi chức năng và chất lượng

### 7.1 SaaS đầy đủ

- **Tài khoản:** đăng ký/đăng nhập bằng email và Google. Thư viện auth đề xuất: Better Auth hoặc Auth.js.
- **Multi-tenant:** workspace có nhiều thành viên, vai trò Owner / Admin / Editor / Viewer. Dữ liệu các workspace cách ly hoàn toàn, có test chứng minh.
- **Quota:** theo gói. Đo bằng phút video render, số video, số ký tự TTS, số ảnh AI, dung lượng lưu trữ, số job đồng thời. Hiển thị mức đã dùng cho người dùng.
- **Billing:** gói theo tháng và năm, có thể mua thêm credit. Cổng thanh toán đặt sau interface `PaymentProvider`. Trong PLAN.md, so sánh các cổng thanh toán phù hợp với người bán ở Việt Nam: nhóm quốc tế (Paddle, Lemon Squeezy, Polar — kiểm tra cái nào hỗ trợ VN) và nhóm nội địa (VNPay, MoMo, PayOS). Để tôi chọn.
- **Trang admin:** quản lý người dùng và gói, xem chi phí AI thực tế so với doanh thu theo workspace, xem hàng đợi và worker.

### 7.2 REST API

- API công khai có version (`/api/v1`), xác thực bằng API key theo workspace, có rate limit.
- Các endpoint chính: tạo video từ prompt/kịch bản/URL; tạo từ template + biến; chạy batch từ CSV; xem trạng thái; lấy link tải; liệt kê style và giọng đọc.
- Webhook báo khi render xong hoặc lỗi, có ký HMAC.
- Có tài liệu OpenAPI và trang docs tự sinh.

### 7.3 Phi chức năng

- **Bảo mật:** mã HTML do AI sinh chỉ chạy trong Chromium sandbox của worker, không có mạng, không đọc được file hệ thống. Chống SSRF khi ingest URL. API key của provider được mã hóa khi lưu. File tải lên được kiểm tra định dạng và kích thước. Link tải là signed URL có hạn.
- **License:** mọi dependency, font, nhạc, SFX, icon phải cho phép dùng thương mại trong sản phẩm SaaS mã nguồn đóng. Không dùng AGPL. Kiểm tra tự động bằng công cụ quét license trong CI. Duy trì `THIRD_PARTY_LICENSES.md`.
- **Quan sát hệ thống:** log có cấu trúc, theo dõi lỗi (Sentry hoặc tương đương), metric hàng đợi, thời gian render và chi phí trên mỗi video.
- **Dữ liệu:** backup PostgreSQL hằng ngày. Có chính sách tự xóa file render cũ theo gói.
- **Tiếng Việt:** chuẩn hóa Unicode NFC ở mọi đầu vào. Test với chuỗi có đủ dấu và cả chữ hoa có dấu (Ẩ, Ỹ, Ự…).

### 7.4 Chất lượng code

- TypeScript strict, ESLint, Prettier. Không dùng `any` nếu không có lý do ghi rõ.
- Unit test (Vitest) cho spec, compiler, patch, quota. Integration test cho pipeline, dùng mock LLM/TTS có fixture. E2E (Playwright) cho luồng đăng ký → tạo video → sửa bằng chat → tải về.
- Visual regression: golden frames cho mỗi style pack ở mỗi tỷ lệ khung hình.
- CI trên GitHub Actions: lint, typecheck, test, quét license, build Docker image, render thử một video ngắn.
- README hướng dẫn cài đặt từng bước cho Windows và Linux. Mỗi style pack có video mẫu. Có tài liệu "cách tạo style pack mới".

## 8. Milestones, nghiệm thu và việc đầu tiên

Toàn bộ phạm vi ở trên đều bắt buộc, nhưng làm theo thứ tự dưới đây. Thứ tự này ưu tiên tự động hóa và chất lượng hình ảnh trước. Kết thúc mỗi milestone phải dừng lại báo cáo và chờ tôi duyệt.

**M0 — Plan và spike** (không viết code sản phẩm)

- `docs/PLAN.md` gồm: kiến trúc, sơ đồ thành phần, data model, schema VideoSpec bản nháp, danh sách dependency kèm license, cấu hình máy và ước tính chi phí hạ tầng, rủi ro, các quyết định cần tôi chọn (cổng thanh toán, TTS mặc định).
- Spike HyperFrames (phần 5) và benchmark TTS tiếng Việt (mục 3.3): có file audio mẫu và bảng so sánh.
- **Nghiệm thu:** tôi đọc PLAN.md và duyệt; có video spike 9:16 và 16:9 hiển thị đúng tiếng Việt.

**M1 — Lõi render**

- Monorepo, `packages/spec`, `packages/compiler`, interface `Renderer` + HyperFrames, 3 style pack (Minimal, Kinetic typography, Infographic), CLI `render <spec.json>`.
- **Nghiệm thu:** từ một VideoSpec mẫu, render ra MP4 1080p30 ở cả 4 tỷ lệ khung hình; render lại 2 lần cho kết quả giống nhau từng frame; test tràn chữ pass; có golden frames.

**M2 — Pipeline AI tự động**

- Provider LLM theo chuẩn OpenAI SDK, các bước kịch bản → storyboard → audio → compile → QA → render. Hai chế độ Tự động và Duyệt. TTS tiếng Việt, đồng bộ theo lời đọc, phụ đề TikTok + SRT, nhạc + ducking, SFX, ghi log chi phí.
- **Nghiệm thu:** 10 prompt tiếng Việt đa dạng (giáo dục, tin tức, repo…) chạy chế độ Tự động; ít nhất 9/10 ra video không lỗi hiển thị, không cần can thiệp; lệch giữa phụ đề và giọng đọc dưới 100 ms; có báo cáo chi phí trung bình mỗi video.

**M3 — Web app**

- Next.js: đăng nhập, workspace, tạo dự án, chọn phong cách (AI gợi ý), duyệt kịch bản/storyboard, preview realtime, sửa bằng chat (patch + render lại cảnh bị ảnh hưởng), lịch sử phiên bản, nhân bản dự án, giao diện Việt/Anh. Nâng lên 8 style pack.
- **Nghiệm thu:** một người không biết code tạo được video từ prompt và sửa 3 lần bằng chat mà không thấy thông tin kỹ thuật nào; E2E test pass.

**M4 — Đầy đủ nội dung**

- Đủ 13 style pack, trộn phong cách theo cảnh. Đầu vào URL, GitHub, CSV/JSON, audio/video. Brand kit và các loại tài sản tải lên. Sinh ảnh/video AI (tùy chọn). Thư viện template.
- **Nghiệm thu:** mỗi style có video demo; mỗi loại đầu vào có một video mẫu đạt QA.

**M5 — Quy mô và kinh doanh**

- Batch từ CSV, render phân tán nhiều worker, REST API + webhook + OpenAPI, quota, billing qua cổng thanh toán đã chọn, trang admin.
- **Nghiệm thu:** batch 100 video 30 giây chạy xong không lỗi; tốc độ render đạt mục tiêu ở 6.3 và tăng gần tuyến tính khi thêm worker; vượt quota thì bị chặn đúng.

**M6 — Hoàn thiện và triển khai**

- Kiểm tra bảo mật, CI đầy đủ, Docker Compose cho VPS, backup, giám sát, tài liệu vận hành.
- **Nghiệm thu:** • Nghiệm thu: cài từ đầu chỉ bằng README trên cả hai môi trường: một máy Windows 11 có Docker Desktop và một VPS Linux trống, dùng cùng lệnh docker compose up -d; cả hai chạy được toàn bộ luồng và cùng một VideoSpec cho ra video giống nhau.
