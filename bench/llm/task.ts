// The benchmark task: turn a Vietnamese topic into a short-video storyboard (JSON) that must respect
// the real template slot limits (scripts/scaffold-schemas.mjs). Same prompt for every model.
import { SCHEMAS } from "../../scripts/scaffold-schemas.mjs";

export const TOPICS = [
  "Lãi kép là gì và vì sao nên tiết kiệm sớm",
  "5 mẹo ngủ ngon cho dân văn phòng",
  "Cách nhận biết tin nhắn lừa đảo ngân hàng",
  "Vì sao nên uống đủ nước mỗi ngày",
  "Giới thiệu tính năng mới: xuất video 4 tỷ lệ cùng lúc",
  "Lịch sử ngắn gọn của Phở Hà Nội",
  "So sánh xe máy điện và xe máy xăng khi đi trong thành phố",
  "3 sai lầm phổ biến khi học tiếng Anh",
  "Biến đổi khí hậu ảnh hưởng thế nào đến Đồng bằng sông Cửu Long",
  "Hướng dẫn bảo mật tài khoản mạng xã hội trong 30 giây",
];

type SlotDef =
  | { type: "text"; required: boolean; maxLength: number }
  | { type: "number"; required: boolean }
  | { type: "list"; required: boolean; maxItems: number; itemMaxLength: number }
  | { type: "series"; required: boolean; maxItems: number };
export const TEMPLATES = SCHEMAS as Record<string, Record<string, SlotDef>>;

function describeTemplates(): string {
  return Object.entries(TEMPLATES)
    .map(([id, slots]) => {
      const parts = Object.entries(slots).map(([k, d]) => {
        const req = d.required ? "bắt buộc" : "tuỳ chọn";
        if (d.type === "text") return `${k} (chuỗi, ${req}, tối đa ${d.maxLength} ký tự)`;
        if (d.type === "number") return `${k} (số, ${req})`;
        if (d.type === "list") return `${k} (mảng chuỗi, ${req}, tối đa ${d.maxItems} mục, mỗi mục tối đa ${d.itemMaxLength} ký tự)`;
        return `${k} (đối tượng {"series":[{"label":chuỗi,"value":số}]}, ${req}, tối đa ${d.maxItems} điểm)`;
      });
      return `- ${id}: ${parts.join("; ")}`;
    })
    .join("\n");
}

export const SYSTEM_PROMPT = `Bạn là biên kịch video ngắn tiếng Việt (TikTok/Reels/YouTube Shorts) cho nền tảng MakVid Studio.
Nhiệm vụ: từ một chủ đề, viết storyboard cho video 30–45 giây.

Trả về DUY NHẤT một đối tượng JSON hợp lệ (không markdown, không giải thích) với dạng:
{"title": chuỗi, "scenes": [{"templateId": chuỗi, "narration": chuỗi, "slots": {...}}]}

Quy tắc:
- 6 đến 8 cảnh. Cảnh đầu tiên là "hook", cảnh cuối là "cta".
- "narration" là lời đọc của cảnh, tiếng Việt tự nhiên, có dấu đầy đủ, tối đa 30 từ.
- Chữ trên màn hình (slots) ngắn gọn, tối đa khoảng 12 từ mỗi cảnh, không lặp nguyên văn lời đọc.
- Chỉ dùng các template và slot dưới đây, tuân thủ đúng giới hạn ký tự:
${describeTemplates()}
- Số liệu phải hợp lý; nếu không chắc chắn thì không bịa số liệu cụ thể.`;

export const userPrompt = (topic: string) => `Chủ đề: ${topic}`;
