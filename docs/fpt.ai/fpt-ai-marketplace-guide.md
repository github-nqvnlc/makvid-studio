# Cẩm Nang Toàn Diện: Sử Dụng FPT AI Marketplace & FPT Cloud Token Factory

> **Tài liệu kỹ thuật tổng hợp chính thức**  
> Nguồn dữ liệu đối chiếu: [fpt-ai-list-model.json](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-list-model.json) (Trích xuất từ API Endpoint chính thức của [FPT Cloud AI Marketplace - Token Factory](https://marketplace.fptcloud.com/en))  
> Phiên bản tài liệu: **v2.1 - 2026** *(Đồng bộ 100% chuẩn xác 34 mô hình theo cấu trúc API `data.items`)*

---

## 📑 Mục lục
1. [Tổng quan về FPT AI Marketplace & FPT Token Factory](#1-tổng-quan-về-fpt-ai-marketplace--fpt-token-factory)
2. [Cơ chế Xác thực & Quản lý API Key](#2-cơ-chế-xác-thực--quản-lý-api-key)
3. [Danh mục Toàn diện 34 Mô hình AI (Chuẩn hóa từ API Catalog)](#3-danh-mục-toàn-diện-34-mô-hình-ai-chuẩn-hóa-từ-api-catalog)
   - 3.1. [Cơ cấu Hạ tầng & Data Residency (Hosted by FPT vs Partner Resell)](#31-cơ-cấu-hạ-tầng--data-residency-hosted-by-fpt-vs-partner-resell)
   - 3.2. [Bảng Chi Tiết Toàn Bộ 34 Mô Hình Live Cấp Sản Xuất](#32-bảng-chi-tiết-toàn-bộ-34-mô-hình-live-cấp-sản-xuất)
   - 3.3. [Các Tính Năng & Năng Lực Nâng Cao (Capabilities Matrix)](#33-các-tính-năng--năng-lực-nâng-cao-capabilities-matrix)
   - 3.4. [Khuyến Nghị Lựa Chọn Mô Hình Cho Hệ Thống Makvid Studio](#34-khuyến-nghị-lựa-chọn-mô-hình-cho-hệ-thống-makvid-studio)
4. [Tích hợp Large Language Models (LLM)](#4-tích-hợp-large-language-models-llm)
5. [Tích hợp Vision Language Models (VLM) & Đa Phương Thức](#5-tích-hợp-vision-language-models-vlm--đa-phương-thức)
6. [Tích hợp Mô hình Embedding (Vector hóa văn bản)](#6-tích-hợp-mô-hình-embedding-vector-hóa-văn-bản)
7. [Tích hợp Mô hình Reranker (Tối ưu kết quả RAG)](#7-tích-hợp-mô-hình-reranker-tối-ưu-kết-quả-rag)
8. [Tích hợp Chuyển Văn Bản Thành Giọng Nói (Text-to-Speech - TTS)](#8-tích-hợp-chuyển-văn-bản-thành-giọng-nói-text-to-speech---tts)
9. [Tích hợp Responses API & Xây dựng AI Agent](#9-tích-hợp-responses-api--xây-dựng-ai-agent)
10. [Hướng dẫn Fine-tuning Mô hình với Kỹ thuật LoRA](#10-hướng-dẫn-fine-tuning-mô-hình-với-kỹ-thuật-lora)
11. [Đo lường Token & Bảng Giá Chi Phí (Tokenizer & Pricing Guide)](#11-đo-lường-token--bảng-giá-chi-phí-tokenizer--pricing-guide)
12. [Xử lý Lỗi, Mã phản hồi HTTP & Best Practices](#12-xử-lý-lỗi-mã-phản-hồi-http--best-practices)
13. [Tổng kết & Tài nguyên liên kết](#13-tổng-kết--tài-nguyên-liên-kết)

---

## 1. Tổng quan về FPT AI Marketplace & FPT Token Factory

**FPT AI Marketplace** (còn được gọi là **FPT Token Factory**, một thành phần của **FPT AI Factory**) là cổng điện toán đám mây cấp doanh nghiệp (Enterprise Production Gateway) cung cấp quyền truy cập thống nhất tới 34 mô hình trí tuệ nhân tạo thế hệ mới.

```
+-----------------------------------------------------------------------------------------+
|                                  MAKVID STUDIO CLIENT                                   |
|               (Video Production, Scriptwriting, Multimodal Content, Voiceover)          |
+-----------------------------------------------------------------------------------------+
                                             |
                              OpenAI-Compatible REST / SSE
                                             v
+-----------------------------------------------------------------------------------------+
|                  FPT TOKEN FACTORY GATEWAY (https://mkp-api.fptcloud.com)               |
|      - Base URL: https://mkp-api.fptcloud.com (hoặc https://token-api.fpt.ai)          |
|      - Unified Auth (Bearer Token / api-key)   - Rate Limiting (RPM/TPM per API Key)    |
|      - Native Vision & Multimodal Streaming    - Sovereign Routing (VN / JP / Resell)   |
+-----------------------------------------------------------------------------------------+
                        /                                     \
                       /                                       \
                      v                                         v
+------------------------------------------+  +-------------------------------------------+
|       HOSTED BY FPT (19 MODELS)          |  |       PARTNER RESELL (15 MODELS)          |
|  FPT AI Factory GPU Clusters (VN & JP)   |  |  Enterprise Resell qua Azure/Alibaba/Z.ai |
|  - 100% Data Residency (VN / JP)         |  |  - Azure: gpt-5.6-sol, gpt-5.6-terra,...   |
|  - DeepSeek-V4.1-Flash (1M Context)      |  |  - Google: Gemini-3.5-Flash, Gemini-3.1... |
|  - GLM-5.2 (1M Context), DeepSeek-V4     |  |  - Alibaba: Qwen3.8-Max, Kimi-K3, DeepSeek |
|  - Saola-Small-32B, gpt-oss-120b         |  |  - Z.ai: GLM-5.3, GLM-5.3-Flash, GLM-5.2   |
|  - FPT.TTS-ultra, FPT.TTS-pro, FPT-ViTs  |  |  - MiniMax: Minimax-M3 (1M Context)        |
|  - Vietnamese_Embedding, bge-reranker    |  |  - Topup Credit Only billing tag           |
+------------------------------------------+  +-------------------------------------------+
```

### 🌟 Điểm nổi bật kiến trúc
- **Tương thích hoàn toàn chuẩn OpenAI API**: Mọi mô hình (từ text, vision đến speech) đều hỗ trợ giao tiếp qua các endpoint chuẩn `/v1/chat/completions`, `/v1/embeddings`, `/v1/audio/speech`, `/v1/audio/transcriptions`.
- **Cấu hình Model ID linh hoạt**: Các API nhận diện thông qua mã kỹ thuật (`code`, ví dụ `deepseek-v4.1-flash`, `fci-glm-5-2`, `saola-small-32b`, `fpt-tts-pro`) hoặc tên hiển thị (`name`).
- **Chủ quyền Dữ liệu (Sovereign AI)**: 19 mô hình Hosted by FPT đặt tại Việt Nam (`region: VN`) và Nhật Bản (`region: JP`), tuân thủ các chứng chỉ an ninh cấp cao nhất: SOC 2 Type II, ISO 27001, PCI-DSS.
- **Hạ tầng Text-to-Speech (TTS) siêu thực**: FPT.AI cung cấp trực tiếp 3 mô hình lồng tiếng độc quyền (`FPT.TTS-ultra` với 24kHz Maskian Decoder, `FPT.TTS-pro`, `FPT.AI-VITs`) tính phí theo ký tự (`character`).

---

## 2. Cơ chế Xác thực & Quản lý API Key

### 2.1. Đăng ký và sinh khóa API
1. Đăng nhập cổng quản trị: [FPT Cloud AI Marketplace - My API Key](https://marketplace.fptcloud.com/en/my-account#my-api-key).
2. Tạo mới API Key và cấp quyền truy cập các model cần sử dụng.
3. Lưu trữ khóa an toàn vào file `.env` phía server.

### 2.2. Header xác thực
```http
Authorization: Bearer <FPT_AI_API_KEY>
# Hoặc
api-key: <FPT_AI_API_KEY>
```

> [!WARNING]
> Tuân thủ nghiêm ngặt **Nguyên tắc VIII của Hiến chương dự án**:
> - File `.env` thực tế: Lưu khóa riêng tư `FPT_AI_API_KEY=fpt_live_xxxxxxxx`.
> - File `.env.example`: Tuyệt đối CHỈ lưu giá trị giả định mẫu `FPT_AI_API_KEY=your_fpt_ai_api_key_placeholder`.

---

## 3. Danh mục Toàn diện 34 Mô hình AI (Chuẩn hóa từ API Catalog)

Dữ liệu dưới đây được trích xuất trực tiếp từ file dữ liệu gốc [fpt-ai-list-model.json](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-list-model.json):

### 3.1. Cơ cấu Hạ tầng & Data Residency (Hosted by FPT vs Partner Resell)

- **Hosted by FPT (19 mô hình)**: Vận hành trực tiếp trên hạ tầng cụm GPU của FPT AI Factory tại trung tâm dữ liệu Việt Nam (`region: VN`) và Nhật Bản (`region: JP`). Các mô hình này có mã kỹ thuật độc lập (không có hậu tố `-resell`), tốc độ cực nhanh, hỗ trợ Serverless.
- **Partner Resell (15 mô hình)**: Các mô hình Frontier Model toàn cầu từ OpenAI (qua Azure), Google Cloud, Alibaba Cloud, Moonshot (Kimi), Zhipu AI (Z.ai) và MiniMax được FPT phân phối lại qua cổng tập trung bảo mật (có mã kỹ thuật kết thúc bằng `-resell` và mang tag `Topup credit only`).

---

### 3.2. Bảng Chi Tiết Toàn Bộ 34 Mô Hình Live Cấp Sản Xuất

| STT | Tên hiển thị (Model Name) | Mã kỹ thuật (`code` / Model ID gọi qua API) | Nhà cung cấp (Provider) | Phân loại (Category) | Hạ tầng / Nguồn | Region | Context Window | Max Output | Bảng giá Token / Ký tự (Cached / In / Out per 1M) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **DeepSeek-V4.1-Flash** | `deepseek-v4.1-flash` | DeepSeek | Vision Language Model | Hosted by FPT | **JP** | 1,048,576 (1M) | 393,216 | Cached: \$0.003 / In: \$0.28 / Out: \$1.2 |
| **2** | **GLM-5.2** | `fci-glm-5-2` | Z.ai | Large Language Model | Hosted by FPT | **VN** | 1,000,000 (1M) | 128,000 | Cached: \$0.26 / In: \$1.4 / Out: \$4.4 |
| **3** | **DeepSeek-V4-Flash** | `deepseek-v4-flash` | DeepSeek | Large Language Model | Hosted by FPT | **JP** | 500,000 (500k) | 200,000 | Cached: \$0.05 / In: \$0.14 / Out: \$0.28 |
| **4** | **bge-reranker-v2-m3** | `bge-reranker-v2-m3` | BAAI | ReRanking | Hosted by FPT | **VN** | 512 | - | Cached: - / In: \$0.022 / Out: \$0 |
| **5** | **gemma-4-31B-it** | `gemma-4-31b-it` | Google | Vision Language Model | Hosted by FPT | **VN** | 65,536 (65k) | 65,536 | Cached: \$0.09 / In: \$0.15 / Out: \$0.45 |
| **6** | **Qwen3.8-27B** | `qwen3.8-27b-fp8` | Qwen | Vision Language Model | Hosted by FPT | **VN** | 262,144 (262k) | 131,072 | Cached: \$0.05 / In: \$0.45 / Out: \$3.2 |
| **7** | **gemma-4-26B-A4B-it** | `gemma-4-26b-a4b-it` | Google | Vision Language Model | Hosted by FPT | **VN** | 128,000 (128k) | 128,000 | Cached: \$0.05 / In: \$0.14 / Out: \$0.4 |
| **8** | **Llama-3.3-70B-Instruct** | `llama-3.3-70b-instruct` | Meta | Large Language Model | Hosted by FPT | **VN** | 32,000 (32k) | 32,000 | Cached: \$0.15 / In: \$0.209 / Out: \$0.451 |
| **9** | **multilingual-e5-large** | `multilingual-e5-large` | intfloat | Text Embeddings | Hosted by FPT | **VN** | 512 | 1,024 | Cached: - / In: \$0.022 / Out: \$0 |
| **10** | **gpt-oss-120b** | `gpt-oss-120b` | Open.AI | Large Language Model | Hosted by FPT | **VN** | 65,000 (65k) | 65,000 | Cached: \$0.03 / In: \$0.143 / Out: \$0.605 |
| **11** | **gemma-3-27b-it** | `gemma-3-27b-it` | Google | Vision Language Model | Hosted by FPT | **VN** | 32,768 (32k) | 32,768 | Cached: - / In: \$0.11 / Out: \$0.165 |
| **12** | **Qwen3.6-27B** | `qwen3.6-27b` | Qwen | Large Language Model | Hosted by FPT | **JP** | 262,000 (262k) | 262,000 | Cached: \$0.15 / In: \$0.3 / Out: \$3.25 |
| **13** | **Vietnamese_Embedding** | `vietnamese-embedding` | AITeamVN | Text Embeddings | Hosted by FPT | **VN** | 8,000 (8k) | 1,024 | Cached: - / In: \$0.011 / Out: \$0 |
| **14** | **Qwen2.5-VL-7B-Instruct** | `qwen2.5-vl-7b-instruct` | Qwen | Vision Language Model | Hosted by FPT | **VN** | 32,768 (32k) | 32,768 | Cached: - / In: \$0.77 / Out: \$0.77 |
| **15** | **Minimax:Minimax-M3** | `minimax-m3-resell` | MiniMax | Vision Language Model | Partner Resell | **VN** | 1,048,576 (1M) | 512,048 | Cached: \$0.06 / In: \$0.3 / Out: \$1.2 |
| **16** | **Quyet-1.0-Large** | `quyet-1.0-large` | chinhnc | System One | Hosted by FPT | **VN** | 10,000 | 1 | Cached: - / In: \$0.08 / Out: \$0 |
| **17** | **Google:Gemini-3.5-Flash** | `gemini-3.5-flash-resell` | Google | Vision Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 65,536 | Cached: \$0.15 / In: \$1.5 / Out: \$9.0 |
| **18** | **Alibaba:Qwen3.8-Max** | `qwen3.8-max-resell` | Qwen | Vision Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 131,072 | Cached: \$0.25 / In: \$2.0 / Out: \$6.0 |
| **19** | **Azure:gpt-5.6-terra** | `gpt-5.6-terra-resell` | Open.AI | Large Language Model | Partner Resell | **VN** | 1,050,000 (1.05M) | 128,000 | Cached: \$0.2 / In: \$2.0 / Out: \$12.0 |
| **20** | **Azure:gpt-5.6-luna** | `gpt-5.6-luna-resell` | Open.AI | Large Language Model | Partner Resell | **VN** | 1,050,000 (1.05M) | 128,000 | Cached: \$0.02 / In: \$0.2 / Out: \$1.2 |
| **21** | **Saola-Small-32B** | `saola-small-32b` | FPT.AI | Large Language Model | Hosted by FPT | **VN** | 32,000 (32k) | 32,000 | Cached: - / In: \$0.132 / Out: \$0.154 |
| **22** | **Z.ai:GLM-5.3** | `glm-5.3-resell` | Z.ai | Large Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 128,000 | Cached: \$0.26 / In: \$1.4 / Out: \$4.4 |
| **23** | **Google:Gemini-3.1-Pro-Preview-Custom-Tool** | `gemini-3.1-pro-preview-custom-tool-resell` | Google | Vision Language Model | Partner Resell | **VN** | 1,048,576 (1M) | 65,536 | Cached: \$0.02 / In: \$2.0 / Out: \$12.0 |
| **24** | **Alibaba:Qwen3.8-Omni-Flash** | `qwen3.8-omni-flash-resell` | Qwen | Vision Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 131,072 | Cached: \$0.016 / In: \$0.15 / Out: \$0.47 |
| **25** | **Alibaba:DeepSeek-V4.1-Flash** | `deepseek-v4.1-flash-resell` | DeepSeek | Large Language Model | Partner Resell | **VN** | 1,048,576 (1M) | 393,216 | Cached: \$0.03 / In: \$0.3 / Out: \$1.2 |
| **26** | **Azure:gpt-5.6-sol** | `gpt-5.6-sol-resell` | Open.AI | Large Language Model | Partner Resell | **VN** | 1,050,000 (1.05M) | 128,000 | Cached: \$0.5 / In: \$5.0 / Out: \$30.0 |
| **27** | **Alibaba:Deepseek-V4-Pro-0813** | `deepseek-v4-pro-0813-resell` | DeepSeek | Large Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 393,216 | Cached: \$0.132 / In: \$1.32 / Out: \$3.96 |
| **28** | **Z.ai:GLM-5.3-Flash** | `glm-5.3-flash-resell` | Z.ai | Large Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 131,072 | Cached: \$0.03 / In: \$0.15 / Out: \$0.5 |
| **29** | **Alibaba:Kimi-K3** | `kimi-k3-resell` | Moonshot | Large Language Model | Partner Resell | **VN** | 1,048,576 (1M) | 131,072 | Cached: \$0.3 / In: \$3.0 / Out: \$15.0 |
| **30** | **Azure:gpt-4.1-nano** | `gpt-4.1-nano-resell` | Open.AI | Large Language Model | Partner Resell | **VN** | 1,047,576 (1.04M) | 32,768 | Cached: \$0.03 / In: \$0.1 / Out: \$0.4 |
| **31** | **FPT.TTS-ultra** | `fpt-tts-ultra` | FPT.AI | Text to Speech | Hosted by FPT | **VN** | 10,000 chars | - | In: **\$99.0 / 1M ký tự** (24kHz Maskian) |
| **32** | **FPT.TTS-pro** | `fpt-tts-pro` | FPT.AI | Text to Speech | Hosted by FPT | **VN** | 10,000 chars | - | In: **\$16.5 / 1M ký tự** (5 giọng cao cấp) |
| **33** | **Z.ai:GLM-5.2** | `glm-5.2-resell` | Z.ai | Large Language Model | Partner Resell | **VN** | 1,000,000 (1M) | 131,072 | Cached: \$0.26 / In: \$1.4 / Out: \$4.4 |
| **34** | **FPT.AI-VITs** | `fpt-ai-vits` | FPT.AI | Text to Speech | Hosted by FPT | **VN** | 10,000 chars | - | In: **\$16.5 / 1M ký tự** (9 giọng đa vùng miền) |

---

### 3.3. Các Tính Năng & Năng Lực Nâng Cao (Capabilities Matrix)

Theo cấu trúc metadata `capabilities` trong catalog:
- **Hỗ trợ Streaming thời gian thực (`supports_stream: true`)**: Hầu hết toàn bộ 34 mô hình (bao gồm cả các mô hình TTS và VLM) đều hỗ trợ streaming.
- **Hỗ trợ Thị giác Đa phương thức (`supports_vision: true`)**:
  - `deepseek-v4.1-flash`, `gemma-4-31b-it`, `qwen3.8-27b-fp8`, `gemma-4-26b-a4b-it`, `gemma-3-27b-it`, `qwen2.5-vl-7b-instruct`.
  - Các mô hình Resell: `minimax-m3-resell`, `gemini-3.5-flash-resell`, `qwen3.8-max-resell`, `gemini-3.1-pro-preview-custom-tool-resell`, `qwen3.8-omni-flash-resell`, `gpt-5.6-terra-resell`, `gpt-5.6-luna-resell`, `gpt-5.6-sol-resell`, `glm-5.3-flash-resell`, `kimi-k3-resell`, `gpt-4.1-nano-resell`.
- **Hỗ trợ Function Calling & AI Agent Tool Use (`supports_function_call: true`)**: Tất cả các mô hình LLM và VLM chính đều hỗ trợ gọi hàm ngoại vi và trả về JSON Schema.

---

### 3.4. Khuyến Nghị Lựa Chọn Mô Hình Cho Hệ Thống Makvid Studio

```
+------------------------------------------------------------------------------------------------+
|                        MA TRẬN LỰA CHỌN MÔ HÌNH MAKVID STUDIO                                  |
+------------------------------------------------------------------------------------------------+
| Nghiệp vụ                               | Model ID Khuyến nghị 1       | Model ID Khuyến nghị 2       |
|-----------------------------------------+------------------------------+-------------------------------|
| 1. Soạn thảo kịch bản video tiếng Việt  | deepseek-v4.1-flash          | saola-small-32b               |
| 2. Đọc bài viết dài thành kịch bản      | fci-glm-5-2 (1M context)     | gemini-3.5-flash-resell (1M)  |
| 3. Suy luận cốt truyện chuyên sâu       | deepseek-v4-pro-0813-resell  | gpt-5.6-sol-resell            |
| 4. Phân tích ảnh bài viết & góc máy     | deepseek-v4.1-flash          | qwen3.8-27b-fp8               |
| 5. Lồng tiếng video tự động (Voiceover) | fpt-tts-pro ($16.5/1M chars) | fpt-tts-ultra ($99/1M chars)  |
| 6. Lưu trữ & tìm kiếm ngữ nghĩa (RAG)   | vietnamese-embedding         | bge-reranker-v2-m3            |
+------------------------------------------------------------------------------------------------+
```

---

## 4. Tích hợp Large Language Models (LLM)

### 4.1. Endpoint kỹ thuật
- **URL**: `https://mkp-api.fptcloud.com/chat/completions` (hoặc `/v1/chat/completions`)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_API_KEY`

### 4.2. Mã nguồn mẫu cURL với `deepseek-v4.1-flash`
```bash
curl --location 'https://mkp-api.fptcloud.com/chat/completions' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "model": "deepseek-v4.1-flash",
    "messages": [
      {
        "role": "system",
        "content": "Bạn là chuyên gia biên kịch video ngắn TikTok/Reels của Makvid Studio. Luôn tạo câu mở đầu Hook giật gân trong 3 giây đầu và chia bảng phân cảnh kèm timeline."
      },
      {
        "role": "user",
        "content": "Hãy lên kịch bản video 60 giây giới thiệu các mô hình AI mới trên FPT Token Factory."
      }
    ],
    "temperature": 0.7,
    "stream": false
  }'
```

### 4.3. Mã nguồn TypeScript với `fci-glm-5-2` (1M Context)
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.FPT_AI_API_KEY,
  baseURL: "https://mkp-api.fptcloud.com",
});

async function generateScriptFromLongArticle(articleContent: string) {
  const stream = await client.chat.completions.create({
    model: "fci-glm-5-2",
    messages: [
      {
        role: "system",
        content: "Bạn là biên tập viên video chuyên nghiệp. Hãy đọc toàn bộ bài báo dài và chuyển đổi thành kịch bản sản xuất video 3 phút.",
      },
      {
        role: "user",
        content: `Nội dung bài viết:\n${articleContent}\n\nYêu cầu: Viết kịch bản phân cảnh chi tiết có timeline, visual prompt, lời dẫn và phụ đề.`,
      },
    ],
    temperature: 0.5,
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}
```

---

## 5. Tích hợp Vision Language Models (VLM) & Đa Phương Thức

Mô hình như `deepseek-v4.1-flash`, `qwen3.8-27b-fp8`, `gemma-4-31b-it` có khả năng đọc ảnh minh họa trong kho S3 của bài viết và đề xuất góc máy tương thích:

```python
#!/usr/bin/env python3
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("FPT_AI_API_KEY"),
    base_url="https://mkp-api.fptcloud.com"
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": "https://s3-storage.domain/content-resources/sample-image.jpg"}
                },
                {
                    "type": "text",
                    "text": "Hãy phân tích hình ảnh này để gợi ý: (1) Mô tả cảnh quay Visual Prompt cho video; (2) Câu thoại thuyết minh phù hợp."
                }
            ]
        }
    ],
    temperature=0.3
)

print(response.choices[0].message.content)
```

---

## 6. Tích hợp Mô hình Embedding (Vector hóa văn bản)

Cổng FPT Token Factory cung cấp 2 mô hình Embedding chính thức:
1. `vietnamese-embedding` (Provider: `AITeamVN`): 8,000 context length, vector 768 chiều, chi phí siêu rẻ (\$0.011 / 1M token).
2. `multilingual-e5-large` (Provider: `intfloat`): 512 context length, vector 1024 chiều (\$0.022 / 1M token).

```bash
curl --location 'https://mkp-api.fptcloud.com/v1/embeddings' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "model": "vietnamese-embedding",
    "input": ["Giải pháp sản xuất video tự động bằng trí tuệ nhân tạo trên nền tảng Makvid Studio."]
  }'
```

---

## 7. Tích hợp Mô hình Reranker (Tối ưu kết quả RAG)

Mô hình `bge-reranker-v2-m3` (Provider: `BAAI`) chấm điểm ngữ nghĩa tương quan giữa câu hỏi của người dùng và các tài liệu trích xuất:

```bash
curl --location 'https://mkp-api.fptcloud.com/v1/rerank' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "model": "bge-reranker-v2-m3",
    "query": "Các mô hình TTS của FPT AI giá bao nhiêu?",
    "documents": [
      "FPT.TTS-pro có giá 16.5 USD trên 1 triệu ký tự.",
      "Mô hình DeepSeek-V4.1-Flash có context 1 triệu token.",
      "FPT.TTS-ultra sử dụng 24kHz Maskian Decoder với giá 99 USD trên 1 triệu ký tự."
    ],
    "top_n": 2
  }'
```

---

## 8. Tích hợp Chuyển Văn Bản Thành Giọng Nói (Text-to-Speech - TTS)

> [!IMPORTANT]
> **Đặc biệt quan trọng cho quy trình dựng video tự động**:
> FPT AI cung cấp 3 mô hình TTS cấp doanh nghiệp có mã kỹ thuật:
> - `fpt-tts-ultra` (\$99.0 / 1M ký tự): Định dạng chuẩn phát thanh **24 kHz**, chất giọng tự nhiên siêu thực với Maskian Decoder.
> - `fpt-tts-pro` (\$16.5 / 1M ký tự): Cung cấp 5 giọng đọc cao cấp tuyển chọn (2 nữ, 3 nam).
> - `fpt-ai-vits` (\$16.5 / 1M ký tự): Cung cấp 9 giọng đọc tiếng Việt 3 miền Bắc, Trung, Nam.

### 8.1. Danh mục Voice ID tiếng Việt tiêu chuẩn
| Voice ID | Tên giọng | Giới tính | Vùng miền | Ứng dụng khuyên dùng trong Video |
| :---: | :--- | :---: | :---: | :--- |
| `banmai` | Ban Mai | Nữ | Miền Bắc | Bản tin thời sự, phóng sự, video tri thức, giáo dục. |
| `thuminh` | Thu Minh | Nữ | Miền Bắc | Kể chuyện, podcast, video tâm sự, truyền cảm hứng. |
| `myan` | Mỹ An | Nữ | Miền Nam | Video ngắn TikTok/Reels, review công nghệ, quảng cáo. |
| `lananh` | Lan Anh | Nữ | Miền Bắc | Video hướng dẫn (tutorial), tài liệu đào tạo. |
| `giahuy` | Gia Huy | Nam | Miền Trung | Giọng nam miền Trung đĩnh đạc, ấm áp, sâu lắng. |
| `leminh` | Lê Minh | Nam | Miền Bắc | Phóng sự tài liệu khoa học, giọng đọc đĩnh đạc. |
| `minhquang` | Minh Quang | Nam | Miền Nam | Giọng nam trẻ trung, năng động, review sản phẩm. |

---

### 8.2. Gọi API sinh file MP3 lồng tiếng (cURL)
```bash
curl --location 'https://mkp-api.fptcloud.com/v1/audio/speech' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --output voiceover_scene_1.mp3 \
  --data '{
    "model": "fpt-tts-pro",
    "input": "Chào mừng bạn đến với kênh Makvid Studio. Hôm nay chúng ta sẽ tìm hiểu về các công nghệ AI mới nhất.",
    "voice": "banmai",
    "speed": 1.0,
    "response_format": "mp3"
  }'
```

### 8.3. Tích hợp TypeScript / NestJS lưu file audio vào S3 MinIO
```typescript
import axios from "axios";
import { Injectable, Logger } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class VideoVoiceoverService {
  private readonly logger = new Logger(VideoVoiceoverService.name);

  constructor(private readonly storageService: StorageService) {}

  async generateAndSaveVoiceover(
    scriptId: string,
    sceneOrder: number,
    text: string,
    voice = "banmai"
  ): Promise<string> {
    const response = await axios.post(
      "https://mkp-api.fptcloud.com/v1/audio/speech",
      {
        model: "fpt-tts-pro",
        input: text,
        voice: voice,
        speed: 1.0,
        response_format: "mp3",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FPT_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    const buffer = Buffer.from(response.data);
    const s3Key = `video-scripts/${scriptId}/audio/scene_${sceneOrder}.mp3`;
    
    // Lưu vào MinIO S3 cục bộ
    const savedUrl = await this.storageService.uploadBuffer(s3Key, buffer, "audio/mpeg");
    return savedUrl;
  }
}
```

---

## 9. Tích hợp Responses API & Xây dựng AI Agent

Dành cho các tác vụ phân rã kế hoạch (Planner Agent) chia nhỏ việc dựng video thành các giai đoạn:
```bash
curl --location 'https://mkp-api.fptcloud.com/v1/responses' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
    "model": "saola-small-32b",
    "input": "Hãy lập dàn ý 5 bước sản xuất video ngắn triệu view từ bài báo này."
  }'
```

---

## 10. Hướng dẫn Fine-tuning Mô hình với Kỹ thuật LoRA

Fine-tuning thích ứng mô hình nền tảng cho văn phong kênh video của bạn với các siêu tham số chuẩn:
| Kiến trúc Mô hình | Model Code | GPU Đề xuất | Learning Rate | Số Epochs |
| :--- | :--- | :--- | :--- | :--- |
| **Qwen3.8-27B** | `qwen3.8-27b-fp8` | 1-2 GPU H100 | `2e-5` đến `5e-5` | 3 - 5 |
| **Google Gemma 4** | `gemma-4-31b-it` | 2 GPU H100 | `1e-5` đến `3e-5` | 3 |
| **Saola Small 32B** | `saola-small-32b` | 1-2 GPU A100/H100 | `2e-5` đến `4e-5` | 3 - 4 |

---

## 11. Đo lường Token & Bảng Giá Chi Phí (Tokenizer & Pricing Guide)

### 11.1. Các nhóm đơn giá theo catalog chính thức
- **Nhóm Siêu Tiết Kiệm (Ultra Low Cost)**:
  - `deepseek-v4-flash`: Cached \$0.05 / In \$0.14 / Out \$0.28 (Context 500k)
  - `azure:gpt-4.1-nano-resell`: Cached \$0.03 / In \$0.10 / Out \$0.40 (Context 1.04M)
  - `gemma-4-26b-a4b-it`: Cached \$0.05 / In \$0.14 / Out \$0.40 (Context 128k)
- **Nhóm Giá Trị Tốt Nhất (Best Value - Khuyên Dùng)**:
  - `deepseek-v4.1-flash`: Cached \$0.003 / In \$0.28 / Out \$1.20 (Context 1.04M, VLM)
  - `saola-small-32b`: In \$0.132 / Out \$0.154 (Context 32k, tiếng Việt tối ưu)
  - `gpt-oss-120b`: Cached \$0.03 / In \$0.143 / Out \$0.605 (Context 65k)
- **Nhóm Ngữ Cảnh Khổng Lồ 1M Token (Long Context Frontier)**:
  - `fci-glm-5-2`: Cached \$0.26 / In \$1.40 / Out \$4.40 (Context 1M)
  - `minimax-m3-resell`: Cached \$0.06 / In \$0.30 / Out \$1.20 (Context 1.04M)
  - `kimi-k3-resell`: Cached \$0.30 / In \$3.00 / Out \$15.00 (Context 1.04M)
  - `azure:gpt-5.6-sol-resell`: Cached \$0.50 / In \$5.00 / Out \$30.00 (Context 1.05M)
- **Nhóm Text-to-Speech (Ký tự)**:
  - `fpt-tts-pro` & `fpt-ai-vits`: \$16.5 / 1M ký tự.
  - `fpt-tts-ultra`: \$99.0 / 1M ký tự.

---

## 12. Xử lý Lỗi, Mã phản hồi HTTP & Best Practices

| Mã lỗi HTTP | Tên lỗi | Nguyên nhân thường gặp | Khắc phục |
| :---: | :--- | :--- | :--- |
| **400** | Bad Request | Gõ sai cấu trúc JSON hoặc model code không tồn tại. | Kiểm tra mã `code` chính xác trong [Bảng danh mục 34 mô hình](#32-bảng-chi-tiết-toàn-bộ-34-mô-hình-live-cấp-sản-xuất). |
| **401** | Unauthorized | Thiếu header `Authorization: Bearer <key>` hoặc API Key sai. | Đối chiếu lại key trên cổng [My API Key](https://marketplace.fptcloud.com/en/my-account#my-api-key). |
| **403** | Forbidden | Mô hình Resell mang tag `Topup credit only` nhưng tài khoản hết tiền. | Nạp thêm tín dụng vào tài khoản FPT Token Factory. |
| **429** | Rate Limited | Vượt ngưỡng RPM (Requests/phút) hoặc TPM (Tokens/phút). | Kích hoạt cơ chế **Exponential Backoff with Jitter**. |
| **500** | Internal Error | Quá tải tính toán GPU. | Thử lại sau 1-3 giây. |

---

## 13. Tổng kết & Tài nguyên liên kết

- **Tệp dữ liệu API Model gốc**: [fpt-ai-list-model.json](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-list-model.json)
- **Cổng thông tin FPT AI Marketplace / Token Factory**: [https://marketplace.fptcloud.com/en](https://marketplace.fptcloud.com/en)
- **Hướng dẫn Khởi động Nhanh 5 phút**: [fpt-ai-quickstart.md](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-quickstart.md)
- **Đặc tả Tính năng Kịch bản Video**: [specs/003-video-production-scripts/spec.md](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/specs/003-video-production-scripts/spec.md)
