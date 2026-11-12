# Benchmark LLM: chuẩn bị cho M2

**Ngày**: 2026-11-12 · **Harness**: [run.ts](run.ts), [task.ts](task.ts), [score.ts](score.ts), [providers.ts](providers.ts) · **Trạng thái**: đã chạy xong phần FPT (12 model); phần Claude, OpenAI và Gemini đang chờ API key

## 1. Bài test

Mỗi model nhận **cùng một prompt**: từ một chủ đề tiếng Việt, viết storyboard JSON cho video 30–45 giây, gồm 6–8 cảnh, mở đầu bằng `hook`, kết bằng `cta`. Nội dung phải dùng đúng 8 template và **giới hạn ký tự thật** của các style pack ở M1. Có 10 chủ đề, gồm tài chính, sức khoẻ, lừa đảo, lịch sử, sản phẩm và môi trường.

Phần chấm tự động gồm:
- JSON hợp lệ.
- Đúng cấu trúc.
- Số lỗi vi phạm slot.
- Tỷ lệ từ có dấu tiếng Việt.
- Có lẫn chữ Trung, Nhật, Hàn hay Nga không.
- Chữ trên màn hình có vượt 12 từ mỗi cảnh không.
- Độ trễ, số token và chi phí.

Phần chấm mù dành cho người đọc nằm trong `out/blind/`: các bài được đổi tên ngẫu nhiên, khoá giải mã để ở `out/blind-key.json`.

## 2. Kết quả FPT AI Marketplace (key mới, 12 model × 10 chủ đề, chạy lại 2026-11-12)

| Model | JSON hợp lệ | Đạt hết quy tắc | Lời đọc TB (từ/cảnh) | Video ước tính | Độ trễ TB | Chi phí / storyboard |
| --- | --- | --- | --- | --- | --- | --- |
| **gemma-4-31B-it** | 10/10 | **10/10** | 18,5 | 53 s | 14 s | $0,00046 |
| Qwen3.6-27B | 10/10 | 10/10 | 18,9 | 49 s | 25 s | $0,0158 |
| **DeepSeek-V4.1-Flash** | 10/10 | 9/10 | 19,7 | 55 s | **79 s** | $0,0031 |
| gpt-oss-120b | 10/10 | 9/10 | 14,7 | 40 s | 11 s | $0,0015 |
| gemma-4-26B-A4B-it | 10/10 | 8/10 | 15,3 | 40 s | **2,8 s** | $0,0003 |
| DeepSeek-V4-Flash | 8/10 | 8/10 | 18,3 | 51 s | 32 s | $0,0018 |
| Qwen3.8-27B | 7/10 | 7/10 | 13,3 | 36 s | 49 s | $0,0192 |
| gemma-3-27b-it | 10/10 | 5/10 | 20,4 | 60 s | 12 s | $0,0002 |
| Saola-Small-32B | 9/10 | 5/10 | 11,5 | 28 s | 20 s | $0,0002 |
| Llama-3.3-70B-Instruct | 10/10 | 9/10 | **3,8 ⚠** | 11 s | 12 s | $0,0003 |
| GLM-5.2 | 5/10 | 4/10 | 22,5 | 59 s | 53 s | $0,013 · **5/10 lỗi 524 (quá thời gian)** |
| Quyet-1.0-Large | 0/10 | 0/10 | — | — | 69 s | **5/10 lỗi 524, 5/10 ra chữ vô nghĩa** |

Giá lấy từ catalog [docs/fpt.ai/fpt-ai-list-model.json](../../docs/fpt.ai/fpt-ai-list-model.json) và số token thật mà API trả về. Lỗi 524 là lỗi quá thời gian chờ ở tầng Cloudflare của FPT. Kết quả lần chạy đầu với key cũ (7 model) vẫn giữ trong `out-v1-oldkey/`, và các con số khớp với lần này.

**Nhận xét khi đọc trực tiếp bài làm** (chấm tự động bỏ sót những điểm này):
- **gemma-4-31B-it** ổn định nhất: đạt 10/10, viết tự nhiên, rẻ, chỉ mất 14 giây. Điểm trừ là lời đọc hơi dài, video khoảng 53 giây, vượt mục tiêu 45 giây.
- **DeepSeek-V4.1-Flash** có lời đọc hay nhất về văn phong. Ví dụ ở chủ đề lừa đảo: *"Bạn vừa nhận một tin nhắn từ ngân hàng, nhưng rất có thể đó là bẫy lừa đảo."* Nhưng nó **chậm (79 giây mỗi storyboard)** và đắt gấp khoảng 7 lần gemma.
- **Qwen3.6 / Qwen3.8 / GLM-5.2** tốn nhiều token suy luận, nên đắt và chậm. GLM-5.2 còn hay bị quá thời gian chờ.
- **Llama-3.3-70B** không viết lời đọc (chỉ nhãn 2–4 từ) và bịa số liệu. **Quyet-1.0-Large** sinh ra chữ vô nghĩa lẫn chữ Kirin. Cả hai bị loại.
- **Saola-Small-32B** (model tiếng Việt của FPT) rẻ nhất, nhưng chỉ 5/10 bài đạt quy tắc và hay thiếu cảnh.
- **Lỗi ở prompt của mình**: hầu hết bài trả cụm "highlight" không nằm trong câu chính, vì prompt v1 chưa yêu cầu điều đó. Ở M2 mình sẽ sửa prompt và thêm bước kiểm tra tự động, khi sai thì yêu cầu model viết lại. Mình cũng sẽ giới hạn tổng số từ để video không vượt 45 giây.

### Danh sách rút gọn (theo yêu cầu chủ sản phẩm, 2026-11-12)

Tiêu chí: loại model đạt hết quy tắc dưới 8/10; sắp xếp theo độ trễ từ nhanh đến chậm; không xét chi phí.

| # | Model | Đạt hết quy tắc | Độ trễ TB | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | gemma-4-26B-A4B-it | 8/10 | 2,8 s | Nhanh nhất |
| 2 | gpt-oss-120b | 9/10 | 10,8 s | |
| 3 | gemma-4-31B-it | 10/10 | 14,0 s | Ổn định nhất |
| 4 | Qwen3.6-27B | 10/10 | 25,4 s | |
| 5 | DeepSeek-V4-Flash | 8/10 | 31,9 s | |
| 6 | DeepSeek-V4.1-Flash | 9/10 | 78,7 s | Văn phong tốt nhất |

Bị loại: Llama-3.3-70B-Instruct (đạt 9/10 nhưng lời đọc chỉ khoảng 4 từ mỗi cảnh và bịa số liệu; chủ sản phẩm quyết định loại). Đạt dưới 8/10: Qwen3.8-27B (7/10), gemma-3-27b-it (5/10), Saola-Small-32B (5/10), GLM-5.2 (4/10), Quyet-1.0-Large (0/10).

## 3. Phát hiện về key và tài liệu FPT

- **Tên model phải dùng đúng như `GET /v1/models` trả về và phân biệt hoa thường**, ví dụ `gemma-4-31B-it`. Các mã `code` ghi trong tài liệu (`deepseek-v4.1-flash`, `fci-glm-5-2`, `saola-small-32b`, …) đều trả lỗi 404.
- **Key mới (2026-11-12)** gọi được cả 13 model chat, gồm Qwen2.5-VL-7B dùng cho xử lý ảnh. Key cũ đã bị xoá.
- **TTS**: key mới gọi được `FPT.TTS-pro` và `FPT.TTS-ultra`. Mình đã tạo mẫu cho:
  - `FPT.TTS-pro`: 5 giọng (fci_vietkhoa, fci_xuantoan, fci_phuongan, std_banmai, std_quanganh). Mỗi lượt khoảng 1,2 giây.
  - `FPT.TTS-ultra`: 7 giọng (fci_phuongan, fci_xuantoan, std_banmai, std_kimngan, std_minhquang, std_quanganh, std_vietkhoa). Mỗi lượt khoảng 2,5 giây.
  - Mẫu nằm ở [docs/reports/assets/M0/tts/](../../docs/reports/assets/M0/tts/), chia theo thư mục `vits/`, `pro/`, `ultra/`.
  - Đơn giá theo catalog: VITs và pro là $16,5 / 1 triệu ký tự, ultra là $99 / 1 triệu ký tự.
- Các model `-resell` (Gemini, GPT-5.6, Kimi, …) không có trong `/v1/models` của key này.

## 4. Claude Code và Antigravity có làm "bộ não" cho SaaS được không?

**Không, nếu dùng đăng nhập theo gói thuê bao. Có, nếu dùng API key thương mại.**

- **Claude Code**: tài liệu pháp lý chính thức ([code.claude.com/docs/en/legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance), truy cập 2026-11-12) ghi rõ: đăng nhập OAuth của các gói Free/Pro/Max/Ultra chỉ dành cho việc dùng cá nhân thông thường. Nhà phát triển làm sản phẩm phải dùng **API key từ Claude Console** hoặc qua nhà cung cấp đám mây. Anthropic không cho phép chuyển request của người dùng qua thông tin đăng nhập của gói thuê bao, và **không cho bán lại hay làm trung gian lượt dùng Claude** thay cho người dùng cuối.
  → Muốn dùng Claude thì gọi **Claude API** bằng `ANTHROPIC_API_KEY`, qua SDK chính thức `@anthropic-ai/sdk`. Harness đã có adapter này. Chi phí tính theo giá API: Claude Opus 5.5 là $4/$20, Sonnet 5.5 là $2/$10, Haiku 5.5 là $0,10/$0,50, tính trên 1 triệu token vào/ra.
- **Google Antigravity**: là công cụ lập trình (IDE, CLI, app). Trong FAQ chính thức ([antigravity.google/docs/faq](https://antigravity.google/docs/faq), truy cập 2026-11-12), Google nói dùng phần mềm bên thứ ba truy cập Antigravity là vi phạm điều khoản, và việc bọc chế độ headless `agy -p` vào ứng dụng khác **không được hỗ trợ ở gói cá nhân**. Antigravity SDK (Python) thực chất là khung agent chạy bằng `GEMINI_API_KEY` hoặc Vertex AI.
  → Không dùng Antigravity làm backend. Muốn dùng model của Google thì gọi thẳng **Gemini API**, endpoint tương thích OpenAI `https://generativelanguage.googleapis.com/v1beta/openai/`. Harness đã có sẵn.
- **OpenAI / Gemini**: harness đã sẵn sàng, chỉ cần key và tên model (`OPENAI_MODELS`, `GEMINI_MODELS`). Giá sẽ đọc từ trang giá chính thức khi chạy, hiện để trống để tránh đưa số chưa kiểm chứng.

## 5. Thiết kế cho M2 (chưa chốt nhà cung cấp mặc định)

- `LlmProvider` có **hai adapter**: (1) chuẩn OpenAI, dùng cho FPT, OpenAI và Gemini, chỉ đổi `baseURL`, key và model; (2) Anthropic, dùng SDK chính thức. Mỗi bước trong pipeline cấu hình model riêng.
- Đề xuất tạm thời, dựa trên dữ liệu FPT:
  - Viết kịch bản (mặc định): **gemma-4-31B-it**.
  - Viết kịch bản (chất lượng cao, chấp nhận chậm và đắt hơn): **DeepSeek-V4.1-Flash**.
  - Các bước cần nhanh (phân loại, viết lại ngắn, sửa bằng chat): **gemma-4-26B-A4B-it**.
  - Loại: Llama-3.3-70B, Quyet-1.0-Large, Saola-Small-32B (bước kịch bản), GLM-5.2 (hay quá thời gian chờ).
- Sẽ ghi **ADR 0005 (LLM mặc định)** sau khi so sánh thêm với Claude, OpenAI và Gemini, có cả phần chấm mù của người đọc.

## 6. Chạy lại

```bash
cd bench/llm && npm ci && npx tsx --env-file=../../.env run.ts
```

Có thể thêm `--topics 3` để chạy nhanh với 3 chủ đề. Chỉ những nhà cung cấp có key trong `.env` mới được chạy.
