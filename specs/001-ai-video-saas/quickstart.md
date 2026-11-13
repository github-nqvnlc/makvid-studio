# Quickstart: kịch bản kiểm chứng theo milestone

Tài liệu này mô tả **cách chứng minh** mỗi milestone chạy thật (nguyên tắc II). Các lệnh là dạng dự
kiến. Lệnh chính xác sẽ được ghi vào `AGENTS.md` khi monorepo được tạo ở M1.

## Điều kiện tiên quyết

- Windows 11 + Docker Desktop (WSL2), hoặc Linux + Docker Engine; Docker Compose v2.
- Node.js 22 LTS + pnpm (corepack) để chạy ngoài container khi dev.
- FFmpeg (đã có trong image worker; khi chạy native thì cần có trong PATH).
- File `.env` tạo từ `.env.example`. Ở M0–M1 không cần key AI (dùng mock và fixture).

## M0: Spike và benchmark

1. Render cảnh spike 10 giây có GSAP và tiếng Việt (đủ dấu, có "Ẩ Ỹ Ự") ở 9:16 và 16:9 bằng
   `@hyperframes/producer` trong container Linux.
   - **Kỳ vọng**: 2 file MP4 1080×1920 và 1920×1080, 30 fps. Mở ra xem thì dấu hiển thị đúng.
     Ghi lại thời gian render.
2. Render lại lần 2 với `--frame-hashes` rồi so file hash → **kỳ vọng**: trùng 100%.
3. Render chia 3 chunk (`planV2`/`renderChunkV2`/`assembleV2`) → **kỳ vọng**: so với render liền
   thì không lệch frame, không có đường nối âm thanh.
4. Nhúng `<hyperframes-player>` vào một trang Next.js tối thiểu → **kỳ vọng**: tua được, có âm thanh.
5. Chạy benchmark TTS: cùng một đoạn văn mẫu cho ≥ 4 provider → `bench/tts/<provider>.mp3` +
   `bench/tts/report.md` (độ tự nhiên, giá/1.000 ký tự, timestamp, license).
6. Thử alignment whisper.cpp trên 1 file TTS không có timestamp → **kỳ vọng**: lệch trung vị < 100 ms
   so với timestamp tham chiếu.

## M1: Lõi render

```bash
pnpm install
```

```bash
docker compose -f docker/compose.dev.yml run --rm worker-render makvid render fixtures/specs/sample-vi.json --aspect 16:9,9:16,1:1,4:5 --frame-hashes --out out/m1
```

- **Kỳ vọng**: `out/m1/<aspect>/video.mp4` (1080p30) + `captions.srt` + `thumbnail.jpg` cho cả 4 tỷ lệ.
- Chạy lại lệnh trên vào `out/m1b`, so `frames.sha256` → trùng hết.
- Chạy `makvid golden minimal`, `makvid golden kinetic`, `makvid golden infographic` → pass.
- Chạy `pnpm test` → unit test của spec/compiler/patch pass, test tràn chữ với chuỗi dài pass.

## M2: Pipeline AI tự động

- Chạy `pnpm test:integration` với mock LLM/TTS có fixture → pipeline 8 bước pass, có `usage_records`.
- Chạy với provider thật: 10 prompt trong `fixtures/prompts/m2-acceptance.json` ở chế độ Tự động.
  - **Kỳ vọng**: ≥ 9/10 có QA pass. Báo cáo lệch phụ đề < 100 ms. Có báo cáo chi phí trung bình.

## M3: Web app

```bash
docker compose up -d
```

- Mở `http://localhost:3000`, đăng ký, tạo video từ prompt, sửa 3 lần bằng chat, tải về.
- Chạy `pnpm test:e2e` → luồng đăng ký → tạo → sửa chat → tải về pass. Kiểm thêm: không có chuỗi
  kỹ thuật nào (`{`, `<div`, `Error:`, stack) trên các trang người dùng.

## M4–M6

- **M4**: `scripts/verify-render.sh` (container render, mạng tắt): golden frame 13 style × 32 khung khớp,
  test chữ dài tối đa đạt. Mỗi nguồn đầu vào có video mẫu đạt QA (`docs/reports/M4.md`).
- **M5** (stack dev có `MAKVID_INFRA_TESTS=1`):
  - `pnpm --filter @makvid/tests exec vitest run integration/batch integration/priority`: lô 10 dòng có 2 lỗi,
    chạy lại đúng 2 dòng; video đơn đi trước lô.
  - `MAKVID_BATCH100=1 … integration/batch100`: lô `fixtures/batch/100.csv` (đã chạy: 71/100, 0 lỗi, được chấp nhận).
  - `pnpm --filter @makvid/billing test`: 10 yêu cầu cùng lúc ở gói miễn phí → đúng 3 được nhận (quota → 402).
  - Tăng tốc render: `apps/cli/scripts/m5-scale-bench.ts` trong container với 1/2/4 worker
    (hoặc `docker compose up -d --scale worker-render=N`).
  - Hợp đồng API: `MAKVID_E2E_BASE_URL=http://localhost:3000 pnpm --filter @makvid/web exec vitest run test/api-v1.contract.test.ts`.
- **M6**: cài từ đầu theo README bằng `docker compose up -d --build` (trên Windows 11 + Docker Desktop;
  máy Linux thật được thay bằng runner Linux của CI theo quyết định chủ sản phẩm). Kiểm:
  `docker compose ps` (healthy), `/api/health`, E2E Playwright với `E2E_BASE_URL` trỏ vào bản cài,
  sao lưu + thử khôi phục (`docker compose run --rm backup /backup/restore-test.sh`).
  Cùng một spec → cùng khung hình: golden frame tạo trên Windows (container) phải khớp trên runner Linux
  của CI (job `render-smoke`).

Xem thêm: [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/).
