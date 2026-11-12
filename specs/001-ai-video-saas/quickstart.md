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

- **M4**: `makvid golden --all` pass cho 13 style. Mỗi nguồn đầu vào (`fixtures/sources/*`) cho ra
  1 video đạt QA.
- **M5**: chạy batch 100 dòng (`fixtures/batch/100.csv`) → 100 video. Đo thời gian khi có 1, 2 và 4
  worker (`docker compose up -d --scale worker-render=N`) → tăng gần tuyến tính. Test vượt quota → 402.
- **M6**: cài từ đầu theo README trên Windows 11 và trên một VPS Linux trống bằng
  `docker compose up -d`. Render cùng một spec trên hai máy rồi so frame hash → trùng.

Xem thêm: [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/).
