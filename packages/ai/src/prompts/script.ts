// Prompt + schema for the `script` step (T074): Vietnamese narration split into short sentences.
import { z } from "zod";
import type { ChatMessage } from "../types";

/**
 * Measured on 10 produced videos (M2 acceptance, FPT vits:banmai): 4.32 words/s including the pauses between
 * sentences; the video adds ~1.5 s (lead-in + tail).
 */
export const WORDS_PER_SECOND = 4.3;
export const VIDEO_OVERHEAD_SEC = 1.5;

export function targetWords(durationSec: number): number {
  return Math.round(Math.max(10, durationSec - VIDEO_OVERHEAD_SEC) * WORDS_PER_SECOND);
}

export function estimateSeconds(parts: string[]): number {
  const words = parts.reduce((n, p) => n + p.trim().split(/\s+/).filter(Boolean).length, 0);
  return words / WORDS_PER_SECOND + VIDEO_OVERHEAD_SEC;
}

export const ScriptOutput = z.object({
  title: z.string().min(3).max(80),
  sentences: z.array(z.string().min(2).max(220)).min(4).max(16),
});
export type ScriptOutput = z.infer<typeof ScriptOutput>;

export function scriptMessages(source: string, durationSec: number): ChatMessage[] {
  const sentences = Math.max(5, Math.min(12, Math.round(durationSec / 5)));
  const words = targetWords(durationSec);
  return [
    {
      role: "system",
      content: `Bạn là biên kịch video ngắn tiếng Việt (TikTok/Reels/Shorts). Viết LỜI ĐỌC cho một video dài khoảng ${durationSec} giây.

Trả về DUY NHẤT JSON: {"title": chuỗi, "sentences": [chuỗi, ...]}

Quy tắc bắt buộc:
- Khoảng ${sentences} câu, tổng cộng khoảng ${words} từ (sai lệch tối đa 10%).
- Câu đầu tiên là HOOK: tối đa 14 từ, gây tò mò ngay từ giây đầu tiên.
- Câu cuối là lời kêu gọi hành động ngắn.
- Mỗi câu tối đa 30 từ, tiếng Việt tự nhiên, có dấu đầy đủ, giọng nói chuyện.
- KHÔNG dùng chữ số, ký hiệu hay viết tắt trong lời đọc: viết bằng chữ (ví dụ "mười triệu", "tám phần trăm", "ô tê pê").
- Không dùng emoji, không markdown, không ghi chú sân khấu.
- Chỉ nêu số liệu khi chắc chắn; nếu không chắc thì diễn đạt định tính.`,
    },
    { role: "user", content: `Ý tưởng / nội dung nguồn:\n${source}` },
  ];
}

/** Semantic checks for the script (sent back for repair when they fail). */
export function validateScript(out: ScriptOutput, durationSec: number): string[] {
  const problems: string[] = [];
  const hookWords = out.sentences[0]!.split(/\s+/).length;
  if (hookWords > 15) problems.push(`câu đầu (hook) có ${hookWords} từ, cần tối đa 14 từ`);
  out.sentences.forEach((s, i) => {
    if (/\d/.test(s)) problems.push(`câu ${i + 1} có chữ số; hãy viết số bằng chữ`);
    if (s.split(/\s+/).length > 30) problems.push(`câu ${i + 1} dài quá 30 từ`);
  });
  const est = estimateSeconds(out.sentences);
  if (est > durationSec * 1.1)
    problems.push(
      `lời đọc quá dài (khoảng ${Math.round(est)} giây, mục tiêu ${durationSec} giây): hãy rút gọn`,
    );
  if (est < durationSec * 0.9)
    problems.push(
      `lời đọc quá ngắn (khoảng ${Math.round(est)} giây, mục tiêu ${durationSec} giây): hãy viết thêm`,
    );
  return problems;
}
