# Implementation Plan: Nền tảng SaaS sản xuất video AI từ animation HTML

**Branch**: `001-ai-video-saas` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ai-video-saas/spec.md`

**Note**: Tài liệu này đóng vai trò `docs/PLAN.md` mà đặc tả nguồn yêu cầu ở M0. Chi tiết nghiên
cứu ở [research.md](research.md), mô hình dữ liệu ở [data-model.md](data-model.md), các contract ở
[contracts/](contracts/), hướng dẫn kiểm chứng ở [quickstart.md](quickstart.md).

## Summary

Khách hàng nhập ý tưởng (hoặc kịch bản, URL, repo GitHub, CSV, audio) và nhận video MP4 tiếng
Việt có animation, giọng đọc, phụ đề highlight từng từ, nhạc nền. AI không viết thẳng HTML cho cả
video: AI sinh **VideoSpec** (JSON có schema zod, có version). **Compiler** ghép VideoSpec với
**style pack** để ra HTML từng cảnh, sau đó **Renderer** (HyperFrames, có bản dự phòng tự viết)
render theo cảnh, cache theo hash, rồi ghép video, trộn âm, ducking và chuẩn hóa loudness. Mỗi
bước của pipeline là một job BullMQ idempotent, có ghi chi phí. Chỉnh sửa bằng chat là JSON Patch
trên VideoSpec, nên chỉ các cảnh bị ảnh hưởng được render lại.

## Technical Context

**Language/Version**: TypeScript 5.x strict trên Node.js 22 LTS (HyperFrames yêu cầu ≥ 22). Python
chỉ dùng nếu alignment bắt buộc WhisperX (R7), đặt trong service riêng.

**Primary Dependencies**: Next.js (App Router), next-intl, Better Auth, Drizzle ORM, BullMQ,
`openai` SDK, zod, `@hyperframes/producer` / `@hyperframes/player` (ghim `0.9.34`), GSAP sau
`AnimationRuntime` (cần quyết định, R2), Puppeteer (renderer dự phòng), FFmpeg, whisper.cpp,
`@mozilla/readability`, pino, AWS SDK v3 (S3).

**Storage**: PostgreSQL 17 (dữ liệu, RLS theo workspace); S3 API, gồm SeaweedFS trên VPS/dev và
R2/S3 khi cần (R3, không dùng MinIO); Valkey cho hàng đợi và rate limit (R4).

**Testing**: Vitest (unit cho spec, compiler, patch, quota, contract), integration pipeline với mock
LLM/TTS có fixture, Playwright E2E, visual regression bằng golden frames (so pixel/hash, chạy trong
container Linux), test tràn/đè chữ bằng đo DOM, test cách ly workspace.

**Target Platform**: Container Linux (Docker Compose) trên VPS; dev trên Windows 11 qua Docker
Desktop/WSL2 và Linux. Trình duyệt người dùng: Chrome, Edge, Firefox, Safari bản hiện hành.

**Project Type**: Web SaaS dạng monorepo: web app + 3 worker + các package dùng chung + CLI.

**Performance Goals**: 1 phút 1080p30 render ≤ 10 phút trên một worker chuẩn (8 vCPU/16 GB), tăng
gần tuyến tính khi thêm worker; sửa một cảnh nhanh hơn ≥ 3 lần so với render lại toàn bộ (SC-009);
batch 100 video 30 giây không lỗi.

**Constraints**: render tất định (trùng từng frame); sandbox không có mạng; không tải từ CDN lúc
render; lệch phụ đề so với giọng đọc < 100 ms; đầu ra ≈ -14 LUFS; mọi dependency có license
thương mại, không AGPL/SSPL/RSAL/non-commercial.

**Scale/Scope**: 13 style pack × ≥ 8 scene template × 4 tỷ lệ; video từ 30 giây đến 10 phút; quy mô
ban đầu hàng trăm workspace, batch 100+ video; 7 milestone (M0–M6).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Nguyên tắc                                  | Cách plan tuân thủ                                                                                                                                                                                                                            | Trạng thái                                                                     |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| I    | Plan và milestone có cổng duyệt             | Không có code sản phẩm trước khi plan này được duyệt; lộ trình M0–M6 ở dưới, mỗi milestone dừng lại báo cáo; ADR đặt trong `docs/decisions/`                                                                                                  | PASS                                                                           |
| II   | Xong nghĩa là đã chạy thật                  | Mỗi milestone có lệnh render thật trong [quickstart.md](quickstart.md); mọi API bên ngoài đã đọc từ nguồn bản hiện tại (research.md), phần chưa xác minh được ghi rõ                                                                          | PASS                                                                           |
| III  | VideoSpec là nguồn sự thật, render tất định | `packages/spec` là nguồn sự thật; patch RFC 6902; lint style pack cấm `Math.random`/`Date.now`/`setTimeout`; PRNG có seed; GSAP được nhúng cục bộ; luôn đi qua `Renderer` + bản dự phòng                                                      | PASS (phải xác minh ở spike: tắt đường `gsap-cdn` của HyperFrames)             |
| IV   | Tiếng Việt và chất lượng hình ảnh           | Chuẩn hóa NFC ở biên ingest/API; test glyph coverage cho font; QA đo DOM (tràn, đè, safe area, tương phản); tiêu chí SC-013 có kiểm tự động một phần + chấm mù                                                                                | PASS                                                                           |
| V    | Không lộ thông tin kỹ thuật                 | Lớp `UserFacingError` (mã lỗi → thông điệp i18n + gợi ý); không gửi lỗi thô qua SSE; E2E kiểm không có chuỗi kỹ thuật trên UI                                                                                                                 | PASS                                                                           |
| VI   | License thương mại sạch                     | Đã loại MinIO (AGPL, archived) và Redis 8 (tri-license gồm AGPL); quét license trong CI; GSAP đặt sau `AnimationRuntime`, có runtime MIT dự phòng, xin xác nhận Webflow trước khi bán ([ADR 0001](../../docs/decisions/0001-gsap-license.md)) | PASS (điều kiện: có xác nhận Webflow hoặc đã chuyển sang runtime MIT trước M5) |
| VII  | Cách ly và bảo mật                          | Docker network `internal` cho worker render; chặn request trong Chromium; chống SSRF (chặn IP private, kiểm DNS lại); RLS + test cách ly; mã hóa key (AES-256-GCM, khóa từ env/KMS); signed URL; HMAC webhook                                 | PASS                                                                           |
| VIII | Trừu tượng hóa nhà cung cấp, đo chi phí     | Interface `LlmProvider`, `TtsProvider`, `Aligner`, `MediaGenProvider`, `PaymentProvider`, `Renderer`, `ObjectStore` ([contracts/provider-interfaces.md](contracts/provider-interfaces.md)); bảng `usage_records` theo bước                    | PASS                                                                           |

**Re-check sau Phase 1**: data model, contract và cấu trúc thư mục không tạo vi phạm mới. Cả 8
nguyên tắc vẫn PASS, riêng VI có điều kiện chờ quyết định GSAP.

## Kiến trúc

```text
                ┌──────────────────────── apps/web (Next.js) ────────────────────────┐
 Browser ──────►│ UI song ngữ · Auth · Chat · Preview (<hyperframes-player>) · SSE    │
                │ BFF + /api/v1 (API key, rate limit) · Webhook dispatcher · Admin    │
                └───────┬───────────────────────────────┬────────────────────────────┘
                        │ Drizzle (RLS)                 │ BullMQ enqueue / events
                  ┌─────▼─────┐                  ┌──────▼──────┐
                  │ PostgreSQL│                  │   Valkey    │
                  └─────▲─────┘                  └──┬───┬───┬──┘
                        │                           │   │   │
       ┌────────────────┴───┐   ┌───────────────────▼┐ ┌▼───▼──────────────────┐
       │ apps/worker-ai     │   │ apps/worker-audio  │ │ apps/worker-render (N)│
       │ ingest · script ·  │   │ TTS · alignment ·  │ │ compile · QA capture ·│
       │ style · storyboard │   │ mix · duck · LUFS  │ │ render chunk · mux    │
       │ · chat→patch · QA  │   │ (worker-align svc) │ │ (network: internal)   │
       └─────────┬──────────┘   └─────────┬──────────┘ └──────────┬────────────┘
                 │      LLM/TTS/MediaGen (outbound, qua adapter)   │
                 └────────────────────┬───────────────────────────┘
                                ┌─────▼─────┐
                                │ S3 API    │ SeaweedFS | R2 | S3
                                └───────────┘
```

**Luồng pipeline** (mỗi bước là một job BullMQ trong một Flow, idempotent theo
`(projectVersionId, step, inputHash)`):

1. `ingest` → SourceMaterial (Markdown + metadata), NFC.
2. `script` → lời đọc. _Điểm dừng chế độ Duyệt._
3. `style-suggest` → 2–3 đề xuất + thumbnail (thumbnail tĩnh trong style pack).
4. `storyboard` → VideoSpec v1. _Điểm dừng chế độ Duyệt._
5. `tts` → audio + `words[]`; `align` nếu thiếu; cập nhật thời lượng cảnh.
6. `compile` → HTML từng cảnh (+ sinh ảnh AI nếu bật).
7. `qa` → chụp frame mốc, đo DOM, (tùy chọn) VLM chấm điểm; tự sửa ≤ N lần (mặc định 2).
8. `render-scene` (song song, cache) → `mux` (concat, mix nhạc + SFX + voice, `sidechaincompress`,
   `loudnorm` 2-pass về -14 LUFS) → SRT + thumbnail.

**Ưu tiên hàng đợi**: preview > video đơn lẻ > batch (BullMQ priority). Giới hạn đồng thời theo
workspace bằng group concurrency hoặc semaphore trên Valkey.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-video-saas/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── videospec.md
│   ├── style-pack.md
│   ├── provider-interfaces.md
│   ├── cli.md
│   └── public-api.openapi.yaml
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/
  web/                 Next.js: UI, auth, BFF, /api/v1, SSE, preview, admin
  worker-ai/           ingest, script, style-suggest, storyboard, chat→patch, QA (LLM/VLM)
  worker-audio/        TTS, alignment client, mix, ducking, loudness, SRT
  worker-render/       compile, QA capture, render chunk, mux (Chromium + HyperFrames + FFmpeg)
  worker-align/        whisper.cpp wrapper (hoặc WhisperX/Python nếu M0 chọn)
  cli/                 `makvid render <spec.json>` và công cụ dev
packages/
  spec/                VideoSpec zod schema, patch, migration, NFC utils
  compiler/            VideoSpec + style pack → HTML từng cảnh; text-fit; safe area
  styles/<style-id>/   style pack (manifest, tokens, templates, presets, prompts, demo, golden)
  style-kit/           SDK dùng chung cho style pack: PRNG, AnimationRuntime, text-fit, lint
  ai/                  LlmProvider (OpenAI SDK), prompt, agent pipeline steps
  tts/                 TtsProvider, Aligner
  media/               ingest URL/GitHub/CSV/audio, MediaGenProvider, nhạc/SFX library
  renderer/            Renderer interface, HyperFramesRenderer, FallbackRenderer
  queue/               định nghĩa job/flow BullMQ, idempotency, cost logging
  db/                  Drizzle schema, migration, RLS policies
  billing/             quota, usage, PaymentProvider
  storage/             ObjectStore (S3 API), signed URL
  ui/                  component dùng chung, i18n messages
  config/              eslint, tsconfig, prettier dùng chung
tests/
  e2e/                 Playwright
  visual/              golden frames runner
  isolation/           test cách ly workspace
docker/                Dockerfile từng app, compose.yml, compose.dev.yml
docs/                  PLAN (trỏ về spec này), PROGRESS.md, decisions/, style-pack-guide.md
```

**Structure Decision**: monorepo pnpm + Turborepo theo cấu trúc đặc tả, thêm 4 package
(`style-kit`, `queue`, `storage`, `ui`) để style pack không phụ thuộc code lõi, và tách
`worker-align` để cô lập phần có thể cần Python.

## Lộ trình milestone (rút gọn)

| Milestone | Nội dung chính                                                                                                | Nghiệm thu                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| M0        | Plan này; spike HyperFrames (R1); benchmark TTS ≥ 4 (R6); thử alignment (R7); xác minh Valkey và quét license | Duyệt plan; video spike 9:16 + 16:9 hiển thị đúng tiếng Việt; bảng TTS kèm audio mẫu |
| M1        | Monorepo, `spec`, `compiler`, `renderer` (+ dự phòng), `style-kit`, 3 style pack, CLI                         | 4 tỷ lệ 1080p30; render 2 lần trùng từng frame; test tràn chữ pass; golden frames    |
| M2        | `ai`, `tts`, pipeline 8 bước, 2 chế độ, phụ đề + SRT, nhạc + ducking, SFX, cost log                           | 9/10 prompt sạch; lệch < 100 ms; báo cáo chi phí trung bình                          |
| M3        | Web app, auth/workspace, preview, chat patch, phiên bản, i18n, 8 style pack                                   | Người không biết code sửa 3 lần; E2E pass                                            |
| M4        | 13 style pack, trộn style, mọi nguồn đầu vào, brand kit, MediaGen, template                                   | Demo mỗi style; mỗi nguồn có video mẫu đạt QA                                        |
| M5        | Batch, render phân tán, `/api/v1` + webhook + OpenAPI, quota, billing, admin, gói miễn phí + watermark        | 100 video; scale gần tuyến tính; chặn quota đúng                                     |
| M6        | Bảo mật, CI đầy đủ, compose VPS, backup, giám sát, tài liệu                                                   | Cài từ README trên Windows + VPS, cùng spec cho cùng video                           |

## Rủi ro chính

| Rủi ro                                               | Ảnh hưởng                    | Giảm thiểu                                                               |
| ---------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| HyperFrames < 1.0, phát hành nhiều bản mỗi ngày      | Vỡ build/render khi nâng     | Ghim version, adapter mỏng, golden test trước khi nâng, có bản dự phòng  |
| License GSAP (điều khoản "no-code visual animation") | Pháp lý                      | `AnimationRuntime` + runtime MIT dự phòng + xin xác nhận Webflow (R2)    |
| Tất định khác nhau giữa Windows và Linux             | Golden test chập chờn        | Mọi render tham chiếu chạy trong container Linux                         |
| Chất lượng LLM khi dựng cảnh đẹp                     | Không đạt 9/10               | Dựa chủ yếu vào template + slot có giới hạn; cảnh tự do < 20%; QA tự sửa |
| Timestamp TTS tiếng Việt thiếu hoặc không chuẩn      | Lệch phụ đề                  | Alignment luôn có sẵn; đo lệch tự động trong CI                          |
| Hiệu năng `backdrop-filter`, 3D                      | Không đạt 10 phút/phút video | Đo theo style, lint ngân sách hiệu năng, worker GPU tùy chọn             |
| Chi phí AI trên mỗi video cao hơn doanh thu gói      | Lỗ                           | Cost log từng bước từ M2, dashboard admin, quota chặn trước              |

## Quyết định cần chủ sản phẩm chọn

1. ~~**GSAP** (R2)~~: **đã quyết 2026-11-12**. Dùng GSAP sau `AnimationRuntime`, giữ runtime MIT làm dự phòng, xin xác nhận Webflow ([ADR 0001](../../docs/decisions/0001-gsap-license.md)).
2. **TTS mặc định** (R6): chọn sau benchmark M0.
3. **Cổng thanh toán** (R8): đề xuất Polar hoặc Lemon Squeezy kết hợp PayOS; chọn trước M5.
4. **Ngân sách hạ tầng** (R10): xác nhận khung chi phí VPS + worker sau khi có số đo spike.

## Complexity Tracking

| Violation                                                                 | Why Needed                                                                                        | Simpler Alternative Rejected Because                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Thêm package `style-kit`, `queue`, `storage`, `ui` ngoài cấu trúc đề xuất | Style pack phải độc lập với lõi (nguyên tắc III); idempotency và cost log dùng chung cho 4 worker | Gộp vào `compiler`/`db` sẽ làm style pack phụ thuộc code lõi |
| Service `worker-align` riêng                                              | Cô lập phần có thể cần Python/binary native                                                       | Nhúng vào `worker-audio` sẽ kéo Python vào image Node        |
