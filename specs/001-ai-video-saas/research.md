# Research: Nền tảng SaaS sản xuất video AI (Phase 0)

**Ngày**: 2026-11-12 · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Phương pháp: đọc trực tiếp mã nguồn/README/manifest bản mới nhất trên GitHub và npm, trang
license chính thức, trang "supported countries" của cổng thanh toán (ngày truy cập 2026-11-12).
Mục nào chưa kiểm chứng được bằng nguồn chính thức được ghi rõ **[CẦN XÁC MINH Ở M0]** và
được đưa vào việc của spike/benchmark M0, không dùng làm căn cứ quyết định cuối.

---

## R1. Engine render: HyperFrames

**Decision**: Dùng HyperFrames làm engine chính qua interface `Renderer`, ghim phiên bản chính
xác (hiện `0.9.34`), cùng một implementation dự phòng tự viết (Puppeteer + FFmpeg).

**Kiểm chứng (repo `heygen-com/hyperframes`, push 2026-11-11, release `v0.9.34`)**:

- License Apache-2.0, ~82k sao, phát hành rất dày (5 bản trong 2 ngày gần nhất) → API biến động nhanh.
- Yêu cầu: Node.js ≥ 22, FFmpeg, Chrome (`chrome-headless-shell`, tự tải qua Puppeteer).
- **API thư viện có thật** (không chỉ CLI): `@hyperframes/producer` export
  `createRenderJob(config)` + `executeRenderJob(job, projectDir, outPath, onProgress)`;
  `RenderConfig` gồm `fps` (số nguyên hoặc `{num, den}`), `quality` (`draft|standard|high`),
  `format` (`mp4|webm|mov|gif|png-sequence|hls`), `entryFile`, `chromaSubsampling`.
- **Render theo đoạn / phân tán có thật**: `@hyperframes/producer/distributed` export
  `planV2`, `renderChunkV2`, `assembleV2`, `planV2WithPublisher` (publish artifact thẳng lên object
  storage). Hỗ trợ mp4 SDR, mov, png-sequence trong chế độ phân tán.
- **Tất định**: capture qua `HeadlessExperimental.beginFrame` trên Linux headless-shell; trên
  macOS/Windows mặc định dùng `Page.captureScreenshot`. → Golden frames và kiểm tra "giống
  nhau từng frame" MUST chạy trong container Linux, không chạy native trên Windows.
- Animation qua adapter: GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI; giao thức seek
  `window.__hf`.
- **Preview nhúng được**: `@hyperframes/player` — web component `<hyperframes-player src controls>`,
  chạy composition trong iframe sandbox, có `play()/pause()/seek()`, sự kiện `timeupdate`,
  thuộc tính `audio-src`. Dùng được trong Next.js (client component, import side-effect).
- `@hyperframes/core` có export `./gsap-cdn` → runtime có đường tải GSAP từ CDN. Vi phạm
  nguyên tắc III (không CDN lúc render) nếu để mặc định → compiler MUST nhúng GSAP cục bộ và
  sandbox chặn mạng; spike M0 xác minh cách tắt.
- Producer có `startServer()` (HTTP render server) — không dùng; worker gọi API thư viện trực tiếp.

**Rủi ro (< 1.0)**: breaking change thường xuyên; phụ thuộc nặng (`puppeteer`, `hono`, `linkedom`,
`@chenglou/pretext`, `wawoff2`); hướng sản phẩm có phần thương mại (Studio Pro). Giảm thiểu:
ghim version chính xác, adapter mỏng trong `packages/renderer`, bộ test hồi quy golden frames
chạy trước mỗi lần nâng version, dự phòng tự viết luôn pass cùng bộ test.

**Alternatives**: Remotion (cấm — license); tự viết hoàn toàn (giữ làm dự phòng, chậm hơn để
đạt chất lượng encoder/audio mix tương đương); Motion Canvas (mô hình tác giả khác, không HTML).

**Spike M0 phải đo**: tốc độ render 10 giây GSAP tiếng Việt ở 9:16 và 16:9 trên worker chuẩn;
render 2 lần so khớp hash từng frame; render chia 3 chunk rồi `assembleV2` so với render liền;
cách nhúng GSAP cục bộ; nhúng player vào trang Next.js.

---

## R2. Thư viện animation: GSAP — **ĐÃ QUYẾT (2026-11-12): dùng GSAP + xin xác nhận Webflow** ([ADR 0001](../../docs/decisions/0001-gsap-license.md))

**Kiểm chứng**: npm `gsap@3.15.1`, license "Standard 'no charge' license" (gsap.com/standard-license,
thuộc Webflow). Điều khoản liên quan:

- "Prohibited Uses": dùng GSAP _"in tools that allow users to build visual animations without code"_
  mà tạo ra giải pháp cạnh tranh với khả năng dựng animation trực quan của Webflow.
- "Competitive Products": phần mềm cho phép tạo/sửa/quản lý animation _"through a visual interface
  or builder similar to Webflow"_.
- FAQ: _"AI-generated code is not a 'Prohibited Use'"_; công cụ ngách không cạnh tranh trực tiếp
  được khuyến khích; nếu không chắc thì liên hệ Webflow.
- Webflow có quyền sửa license; bản cũ vẫn dùng được theo điều khoản cũ.

**Đánh giá**: sản phẩm là công cụ không cần code, tạo animation (video) bằng chat, không có
timeline editor trực quan kiểu Webflow. Khả năng cao không thuộc "Prohibited Uses", nhưng đây là
vùng xám pháp lý cho một SaaS thương mại.

**Decision (đề xuất)**: (a) Dùng GSAP nhưng chỉ sau lớp trừu tượng `AnimationRuntime` trong style
pack; (b) xin xác nhận bằng văn bản từ Webflow trước khi bán (M5); (c) giữ một runtime thay thế
giấy phép MIT (Anime.js hoặc WAAPI thuần — cả hai đều có adapter HyperFrames) và chạy bộ golden
test trên ít nhất 1 style pack với runtime thay thế ở M1 để chứng minh có đường lui. Ghi ADR.

**Alternatives**: Anime.js (MIT, adapter có sẵn), WAAPI/CSS (không phụ thuộc), Motion (MIT, thiên
về DOM/React). Đổi hoàn toàn sang MIT ngay từ đầu an toàn pháp lý hơn nhưng mất hệ sinh thái
plugin (SplitText, MorphSVG, DrawSVG) → chi phí làm style pack cao hơn.

---

## R3. Lưu trữ object: **không dùng MinIO**

**Kiểm chứng**: `minio/minio` — license AGPL-3.0 và **repo đã bị archive** (2026-04-24).
Vi phạm nguyên tắc VI (cấm AGPL) và không còn bảo trì.

**Decision**: SeaweedFS (Apache-2.0, đang hoạt động, có S3 gateway) cho VPS và dev; Cloudflare R2
hoặc AWS S3 cho production khi cần, chuyển bằng cấu hình (endpoint, bucket, key). Code chỉ dùng
S3 API qua AWS SDK v3.

**Alternatives**: Garage (AGPL → loại), Ceph RGW (quá nặng cho 1 VPS), dùng thẳng R2 từ dev
(phụ thuộc mạng, chi phí egress = 0 nhưng không chạy offline).

---

## R4. Hàng đợi: BullMQ trên **Valkey** (không dùng Redis ≥ 8)

**Kiểm chứng**: `redis/redis` license NOASSERTION (Redis 8 phát hành dưới RSALv2/SSPLv1/AGPLv3);
`valkey-io/valkey` BSD-3-Clause; `taskforcesh/bullmq` MIT.

**Decision**: Valkey 8.x làm backend Redis-compatible cho BullMQ, rate limit, cache ngắn hạn.
**[CẦN XÁC MINH Ở M0]**: chạy test tích hợp BullMQ (flows, priorities, rate limiter) trên Valkey.

**Alternatives**: pg-boss (chỉ Postgres, đơn giản hơn nhưng ưu tiên/flow kém hơn), Redis 7.2 (BSD,
hết hỗ trợ).

---

## R5. Các lựa chọn nền tảng còn lại (đã kiểm license)

| Hạng mục       | Lựa chọn                                                   | License            | Lý do                                                            |
| -------------- | ---------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo                                | MIT                | Theo đề xuất trong đặc tả                                        |
| Web + BFF      | Next.js (App Router)                                       | MIT                | Theo đặc tả                                                      |
| i18n           | next-intl                                                  | MIT                | Hỗ trợ App Router, ICU message                                   |
| Auth           | Better Auth                                                | MIT                | Email + Google, có plugin organization (workspace/role), API key |
| ORM            | Drizzle ORM + drizzle-kit                                  | Apache-2.0         | Schema TS thuần, SQL rõ ràng, dùng tốt với RLS                   |
| DB             | PostgreSQL 17                                              | PostgreSQL         | Theo đặc tả                                                      |
| Queue          | BullMQ + Valkey                                            | MIT / BSD-3        | R4                                                               |
| Storage        | SeaweedFS / R2 / S3 qua S3 API                             | Apache-2.0         | R3                                                               |
| LLM client     | `openai` (openai-node)                                     | Apache-2.0         | Chuẩn OpenAI SDK cho mọi provider                                |
| Trích bài viết | `@mozilla/readability` + `linkedom`                        | Apache-2.0 / ISC   | Lấy nội dung chính, bỏ menu/quảng cáo                            |
| HTTP nội bộ    | Hono (worker health/metrics)                               | MIT                | Nhẹ, cũng là dependency của HyperFrames                          |
| Alignment      | whisper.cpp (MIT) và/hoặc WhisperX (BSD-2)                 | MIT / BSD-2        | R7                                                               |
| Mã hóa/mix     | FFmpeg (gọi như tiến trình riêng)                          | LGPL/GPL tùy build | Không phân phối binary cho khách; chỉ chạy server-side. Ghi ADR  |
| Validation     | zod                                                        | MIT                | Schema VideoSpec, contract API                                   |
| Test           | Vitest, Playwright                                         | MIT / Apache-2.0   | Theo đặc tả                                                      |
| Quét license   | `license-checker-rseidelsohn` hoặc tương đương + allowlist | BSD-3              | Chặn AGPL/SSPL/RSAL/CC-NC trong CI **[CẦN XÁC MINH Ở M0]**       |
| Lỗi/giám sát   | Sentry SDK (MIT) hoặc GlitchTip tự host                    | MIT                | GlitchTip tự host để giảm chi phí — chọn ở M6                    |
| Log            | pino                                                       | MIT                | Log JSON có cấu trúc                                             |

---

## R6. TTS tiếng Việt — ứng viên cho benchmark M0

Không có kết quả đo thực tế ở bước này (công cụ tìm kiếm web không khả dụng trong phiên). Bảng
dưới đây là **danh sách ứng viên và giả thuyết cần kiểm chứng**, không phải kết quả. Benchmark M0
MUST: sinh cùng 1 đoạn văn mẫu ~600 ký tự có đủ dấu, đo thời gian, kiểm tra timestamp, chấm MOS
mù (≥ 5 người nghe tiếng Việt), đọc trang giá và điều khoản thương mại hiện hành.

| Ứng viên                                                      | Giả thuyết cần kiểm                                                    | Timestamp từng từ (giả thuyết)                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Azure Speech vi-VN (Neural: nam/nữ, giọng Bắc)                | Giá theo ký tự; có thể thiếu giọng Nam                                 | Có (WordBoundary event)                       |
| Google Cloud TTS vi-VN (Neural2 / WaveNet / Chirp HD)         | Giá theo ký tự, phân tầng theo loại giọng                              | Chỉ qua SSML `<mark>` (cần alignment bổ sung) |
| ElevenLabs (model đa ngữ có tiếng Việt)                       | Giá theo gói/credit, chất lượng cao, ít giọng Việt bản xứ              | Có (endpoint with-timestamps, mức ký tự)      |
| OpenAI TTS                                                    | Đọc được tiếng Việt, giọng có thể "ngoại"                              | Không → cần alignment                         |
| FPT.AI TTS                                                    | Giọng Bắc/Nam bản xứ, giá rẻ                                           | Không rõ → cần alignment                      |
| Viettel AI TTS                                                | Giọng Bắc/Trung/Nam bản xứ                                             | Không rõ → cần alignment                      |
| Mô hình mở tiếng Việt (ví dụ VieNeu-TTS, F5-TTS bản Việt hóa) | Tự host GPU; **license trọng số** thường là non-commercial → phải kiểm | Không → cần alignment                         |

**Decision tạm thời**: thiết kế `TtsProvider` trả về `words[]` tùy chọn; nếu thiếu thì luôn chạy
alignment (R7). Provider mặc định do chủ sản phẩm chọn sau benchmark M0.

---

## R7. Forced alignment

**Decision tạm thời**: service riêng `worker-align`. Đánh giá ở M0 hai hướng:

1. **whisper.cpp** (MIT, binary C++, chạy CPU tốt): transcribe có timestamp từng token rồi khớp
   với văn bản gốc bằng DTW/Needleman–Wunsch phía TypeScript. Không cần Python.
2. **WhisperX** (BSD-2, Python + PyTorch): alignment bằng wav2vec2. Mô hình wav2vec2 tiếng Việt
   phổ biến có thể mang license non-commercial → **[CẦN XÁC MINH Ở M0]**.

Ưu tiên (1) nếu đạt sai lệch < 100 ms (SC-002) vì không cần Python/GPU, phù hợp nguyên tắc
"Python chỉ khi bắt buộc".

---

## R8. Cổng thanh toán — **CẦN CHỦ SẢN PHẨM CHỌN**

| Cổng          | Loại                          | Hỗ trợ người bán ở VN                                                                                      | Ghi chú                                                          |
| ------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Lemon Squeezy | Merchant of Record quốc tế    | **Có** — Vietnam nằm trong danh sách supported countries (docs, 2026-11-12)                                | Lo thuế VAT/GST toàn cầu; phí cao hơn cổng nội địa; thuộc Stripe |
| Polar         | Merchant of Record            | **Có** — Vietnam trong danh sách supported countries (docs, 2026-11-12); payout qua Stripe Connect Express | Hướng developer, API tốt, phí thấp                               |
| Paddle        | Merchant of Record            | **Chưa xác minh được** (trang help không nhắc Vietnam)                                                     | Cần hỏi Paddle trực tiếp                                         |
| PayOS         | Nội địa (VietQR chuyển khoản) | Có (cần pháp nhân/tài khoản ngân hàng VN)                                                                  | Phí thấp, không hỗ trợ thẻ quốc tế/tự gia hạn kiểu thẻ           |
| VNPay         | Nội địa                       | Có (cần đăng ký kinh doanh)                                                                                | Thẻ nội địa + QR; tự gia hạn hạn chế                             |
| MoMo          | Ví nội địa                    | Có (cần đăng ký kinh doanh)                                                                                | Phổ biến với cá nhân; recurring hạn chế                          |

**Đề xuất**: Polar hoặc Lemon Squeezy cho khách quốc tế và thẻ (lo thuế hộ), cộng PayOS cho khách
Việt chuyển khoản/VietQR mua credit hoặc gói năm. Cả hai đi sau `PaymentProvider`. Chủ sản phẩm
chọn trước M5.

---

## R9. Font tiếng Việt (giả thuyết, kiểm ở M1)

Ứng viên license SIL OFL có dấu tiếng Việt: Be Vietnam Pro, Inter, Montserrat, Lexend, Roboto
Flex, JetBrains Mono (terminal), Pixelify Sans / font pixel có hỗ trợ Latin Extended Additional
(retro). Mỗi font MUST qua test glyph coverage tự động cho toàn bộ ký tự tiếng Việt (gồm Ẩ, Ỹ, Ự)
trước khi vào style pack.

---

## R10. Cấu hình máy và chi phí (ước tính, xác nhận bằng số đo spike M0)

| Môi trường           | Cấu hình đề xuất                                            | GPU                        | Chi phí/tháng (ước tính)                              | Ghi chú                                               |
| -------------------- | ----------------------------------------------------------- | -------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Máy dev Windows 11   | 8+ nhân, 32 GB RAM, SSD 100 GB trống, Docker Desktop + WSL2 | Không                      | —                                                     | Render golden chạy trong container Linux              |
| VPS web/DB           | 4 vCPU, 8–16 GB RAM, 200 GB SSD                             | Không                      | ~20–50 USD                                            | Next.js, Postgres, Valkey, SeaweedFS                  |
| Worker render chuẩn  | 8 vCPU dedicated, 16 GB RAM, 80 GB SSD                      | Không (CPU encode libx264) | ~40–90 USD (dedicated) hoặc ~0,1–0,3 USD/giờ theo giờ | 3–4 Chrome song song                                  |
| Worker style 3D (M4) | như trên + GPU tùy chọn                                     | Đo ở M4                    | Đo ở M4                                               | Three.js trong headless có thể dùng SwiftShader (CPU) |

**Mục tiêu**: 1 phút 1080p30 = 1.800 frame trong ≤ 10 phút → ≥ 3 frame/giây cho cả pipeline trên
worker chuẩn. Ước tính thông lượng ≥ 6 phút video/giờ/worker; số thật lấy từ spike M0.

---

## R11. Những điểm đã tự quyết (ghi ADR khi bắt đầu code)

- VideoSpec là JSON có `specVersion` (semver) + migration tuần tự trong `packages/spec`.
- Patch chat dùng RFC 6902 JSON Patch được kiểm bằng zod sau khi áp; lưu patch + snapshot định kỳ.
- Khóa cache render = SHA-256(HTML cảnh đã compile + hash asset + cấu hình xuất + version engine).
- Multi-tenant: cột `workspace_id` trên mọi bảng + Postgres Row-Level Security, có test cách ly.
- Tiến độ realtime: SSE (một chiều, qua proxy dễ hơn WebSocket).
- Sandbox: Chromium trong container worker không có route mạng ra ngoài (Docker network
  `internal`), chặn request bằng request interception, chỉ phục vụ file từ thư mục cảnh.
