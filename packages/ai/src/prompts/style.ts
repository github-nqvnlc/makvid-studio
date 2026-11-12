// Prompt + schema for `style_suggest` (T075): 2–3 style packs with short reasons; auto mode picks #1.
import { z } from "zod";
import type { ChatMessage } from "../types";

export interface StyleOption {
  id: string;
  name: string;
  description: string;
  contentTypes: string[];
}

export const StyleOutput = z.object({
  suggestions: z
    .array(z.object({ styleId: z.string(), reason: z.string().min(3).max(160) }))
    .min(1)
    .max(3),
});
export type StyleOutput = z.infer<typeof StyleOutput>;

export function styleMessages(title: string, script: string[], options: StyleOption[]): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Bạn là đạo diễn hình ảnh. Chọn 2–3 phong cách phù hợp nhất cho video, xếp theo mức phù hợp giảm dần.
Chỉ dùng các styleId sau:
${options.map((o) => `- ${o.id}: ${o.name}. ${o.description} (hợp với: ${o.contentTypes.join(", ")})`).join("\n")}

Trả về DUY NHẤT JSON: {"suggestions": [{"styleId": chuỗi, "reason": "một câu ngắn tiếng Việt"}]}`,
    },
    { role: "user", content: `Tiêu đề: ${title}\nLời đọc:\n${script.join("\n")}` },
  ];
}

export function validateStyle(out: StyleOutput, options: StyleOption[]): string[] {
  const ids = new Set(options.map((o) => o.id));
  const bad = out.suggestions.filter((s) => !ids.has(s.styleId)).map((s) => s.styleId);
  return bad.length ? [`styleId không hợp lệ: ${bad.join(", ")}; chỉ dùng ${[...ids].join(", ")}`] : [];
}
