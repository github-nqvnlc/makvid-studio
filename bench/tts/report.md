# Benchmark TTS tiếng Việt (T007–T008) — TRẠNG THÁI: ĐÃ CHỐT (ADR 0002) — FPT.AI mặc định

**Ngày chuẩn bị**: 2026-11-12

## Đã sẵn sàng

- Văn bản mẫu [sample-vi.txt](sample-vi.txt): ~825 ký tự, đủ dấu, có Ẩ/Ỷ, số đọc bằng chữ, tên riêng nước ngoài (Albert Einstein).
- Harness [run.ts](run.ts): chỉ chạy provider có key trong biến môi trường, không in key ra log; lưu `out/<provider>-<voice>.mp3` và `out/results.json` (độ trễ, số ký tự, timestamp từng từ nếu có).
- Endpoint đã đối chiếu với tài liệu hiện hành (truy cập 2026-11-12):

| Provider | Endpoint | Timestamp từng từ | Ghi chú tài liệu |
| --- | --- | --- | --- |
| Azure Speech | `POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1` (SSML), voices: `/cognitiveservices/voices/list` | Chỉ qua Speech SDK (WordBoundary); REST thì không | Trang language-support liệt kê vi-VN |
| Google Cloud TTS | `POST https://texttospeech.googleapis.com/v1/text:synthesize`, voices: `/v1/voices?languageCode=vi-VN` | Không (chỉ SSML mark ở v1beta1) | |
| ElevenLabs | `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps` | **Có** (theo ký tự → ghép thành từ) | Cần chọn voice id tiếng Việt |
| OpenAI | `POST https://api.openai.com/v1/audio/speech` (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`) | Không | Kiểm từ mã nguồn openai-node |
| FPT.AI | `POST https://api.fpt.ai/hmi/tts/v5` (header `api_key`, `voice`), trả URL bất đồng bộ | Không | Giọng: banmai, thuminh, leminh (Bắc); myan, giahuy (Trung); lannhi, linhsan (Nam) |
| Viettel AI | chưa có tài khoản/tài liệu | ? | Thêm khi có key |

## Cần chủ sản phẩm cung cấp

1. API key (đặt trong `.env` cục bộ, không commit) cho **ít nhất 4** provider: `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, `GOOGLE_TTS_API_KEY`, `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_IDS`, `OPENAI_API_KEY`, `FPT_AI_API_KEY`.
2. ≥ 5 người nghe tiếng Việt cho bài chấm MOS mù (1–5 điểm, file được đổi tên ngẫu nhiên).
3. Giá trên 1.000 ký tự: sẽ đọc trang giá chính thức khi chạy benchmark và ghi kèm URL + ngày truy cập (chưa ghi số nào ở đây để tránh số liệu chưa kiểm chứng).

## Bảng kết quả (điền sau khi chạy)

| Provider | Giọng (giới tính, vùng) | MOS | Giá / 1.000 ký tự (nguồn) | Timestamp | License thương mại | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| FPT AI Marketplace `FPT.AI-VITs` | banmai, thuminh, ngoclam, kimngan, hatieumai (nữ); leminh, giahuy, minhquan, huyphong (nam) | chưa chấm (chỉ 1 provider) | chưa kiểm chứng | Không | chưa kiểm chứng điều khoản | Độ trễ 1,3–2,5 s cho 618 ký tự; audio 30–41 s. Mẫu: [docs/reports/assets/M0/tts/](../../docs/reports/assets/M0/tts/) |

**Ghi chú 2026-11-12**: key `sk-…` là key FPT AI **Marketplace** (OpenAI-compatible, `mkp-api.fptcloud.com`), không dùng được với API cũ `api.fpt.ai` (401). Key hiện chỉ được phép dùng `FPT.AI-VITs`; `FPT.TTS-pro`/`FPT.TTS-ultra` trả 403.
