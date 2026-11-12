# Hướng Dẫn Khởi Động Nhanh (Quickstart Cheat Sheet) - FPT AI Marketplace

> Bản tóm tắt thực hành nhanh trong 5 phút để kết nối vào **FPT AI Marketplace / Token Factory** (`https://mkp-api.fptcloud.com`).  
> Cổng sản xuất chính thức: [https://marketplace.fptcloud.com/en](https://marketplace.fptcloud.com/en)  
> Danh mục model tham chiếu: [fpt-ai-list-model.json](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-list-model.json)

---

## 🚀 1. Cấu hình biến môi trường (`.env`)

Tạo hoặc bổ sung vào file `.env` (hoặc `backend/.env`) trong dự án của bạn:

```env
# Khóa API FPT lấy từ https://marketplace.fptcloud.com/en/my-account#my-api-key
FPT_AI_API_KEY="your_fpt_api_key_here"

# Cổng Gateway chuẩn OpenAI-compatible
FPT_AI_BASE_URL="https://mkp-api.fptcloud.com"

# Mã định danh kỹ thuật (Model Code) khuyến nghị từ fpt-ai-list-model.json
FPT_MODEL_FAST="deepseek-v4.1-flash"
FPT_MODEL_CHAT="saola-small-32b"
FPT_MODEL_LONG_CONTEXT="fci-glm-5-2"
FPT_MODEL_REASONING="deepseek-v4-pro-0813-resell"
FPT_MODEL_VISION="deepseek-v4.1-flash"
FPT_MODEL_EMBEDDING="vietnamese-embedding"
FPT_MODEL_RERANK="bge-reranker-v2-m3"
FPT_MODEL_TTS="fpt-tts-pro"
```

---

## ⚡ 2. Kiểm tra nhanh bằng cURL (1 dòng lệnh)

Mở Terminal và thực thi lệnh sau để kiểm tra mô hình `deepseek-v4.1-flash`:

```bash
curl -s -X POST "https://mkp-api.fptcloud.com/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Xin chào FPT Token Factory! Bạn có thể hỗ trợ tôi những gì?"}]
  }'
```

---

## 💻 3. Tích hợp Python (Chỉ 5 dòng code)

Cài đặt thư viện:
```bash
pip install openai
```

Mã nguồn Python:
```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://mkp-api.fptcloud.com"
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Tóm tắt ưu điểm của FPT AI Token Factory trong 3 gạch đầu dòng."}]
)

print(response.choices[0].message.content)
```

---

## 🌐 4. Tích hợp Node.js / TypeScript

Cài đặt thư viện:
```bash
npm install openai
```

Mã nguồn thực thi:
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.FPT_AI_API_KEY,
  baseURL: "https://mkp-api.fptcloud.com",
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "deepseek-v4.1-flash",
    messages: [
      { role: "system", content: "Bạn là chuyên gia biên kịch video ngắn của Makvid Studio." },
      { role: "user", content: "Viết 1 câu Hook 3 giây cho video về công nghệ AI." }
    ],
  });

  console.log(completion.choices[0]?.message?.content);
}

main();
```

---

## 🎙️ 5. Sinh Giọng Nói Lồng Tiếng (TTS - Text to Speech)

Tạo file âm thanh MP3 lồng tiếng cho video từ văn bản chỉ với một dòng lệnh cURL (sử dụng model code `fpt-tts-pro`):

```bash
curl --location 'https://mkp-api.fptcloud.com/v1/audio/speech' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --output voiceover.mp3 \
  --data '{
    "model": "fpt-tts-pro",
    "input": "Chào mừng bạn đến với kênh Makvid Studio. Hãy cùng khám phá thế giới video AI.",
    "voice": "banmai",
    "speed": 1.0,
    "response_format": "mp3"
  }'
```

---

## 🛠️ 6. Cấu hình vào Cursor IDE / Cline / VS Code

Cấu hình các Model ID từ FPT Token Factory vào IDE:
- `deepseek-v4.1-flash`
- `fci-glm-5-2`
- `saola-small-32b`
- `deepseek-v4-pro-0813-resell`

---

## 📖 7. Xem hướng dẫn chi tiết
Xem cẩm nang đầy đủ về 34 models, VLM, Rerank, Embedding, TTS, LoRA Fine-tuning và Tokenizer tại:  
👉 [fpt-ai-marketplace-guide.md](file:///c:/Users/Admin/Documents/2.%20locnv/platform-makvid-studio/docs/fpt.ai/fpt-ai-marketplace-guide.md)
