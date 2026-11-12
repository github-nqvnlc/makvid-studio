// Prompt + schema for `chat_edit` (T099): turn one user chat message into a small, targeted edit of the
// video. The model answers with constrained edit operations addressed by scene id (never array indexes);
// the pipeline converts them to an RFC 6902 patch, validates it with zod + the style-pack limits, and
// compiles it before anything is saved. Ambiguous requests get exactly one clarifying question.
import { z } from "zod";
import type { ChatMessage } from "../types";
import type { TemplateSchemas } from "./storyboard";

const SlotValue = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.object({ series: z.array(z.object({ label: z.string(), value: z.number() })) }),
]);

export const ChatEdit = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_slot"), sceneId: z.string(), slot: z.string(), value: SlotValue }),
  z.object({ op: z.literal("set_sentence"), scriptId: z.string(), text: z.string().min(1).max(400) }),
  z.object({ op: z.literal("remove_scene"), sceneId: z.string() }),
  z.object({ op: z.literal("set_style"), styleId: z.string() }),
]);
export type ChatEdit = z.infer<typeof ChatEdit>;

export const ChatOutput = z.object({
  kind: z.enum(["edit", "clarify", "info"]),
  /** Short Vietnamese reply shown in the chat (what was changed, the question, or the explanation). */
  reply: z.string().min(1).max(400),
  edits: z.array(ChatEdit).max(8).default([]),
});
export type ChatOutput = z.infer<typeof ChatOutput>;

export interface ChatScene {
  id: string;
  templateId: string;
  slots: Record<string, unknown>;
  /** Narration sentences of this scene: [scriptId, text]. */
  narration: Array<[string, string]>;
}

function describeScenes(scenes: ChatScene[]): string {
  return scenes
    .map(
      (s, i) =>
        `Cảnh ${i + 1} (sceneId "${s.id}", template "${s.templateId}")\n  chữ trên màn hình: ${JSON.stringify(s.slots)}\n` +
        s.narration.map(([id, t]) => `  lời đọc [scriptId "${id}"]: ${t}`).join("\n"),
    )
    .join("\n");
}

function describeSchemas(schemas: TemplateSchemas): string {
  return Object.entries(schemas)
    .map(
      ([id, slots]) =>
        `- ${id}: ` +
        Object.entries(slots)
          .map(([k, d]) =>
            d.type === "text"
              ? `${k} (chuỗi ≤ ${d.maxLength} ký tự)`
              : d.type === "list"
                ? `${k} (mảng ≤ ${d.maxItems} mục, mỗi mục ≤ ${d.itemMaxLength} ký tự)`
                : d.type === "number"
                  ? `${k} (số)`
                  : `${k} (series ≤ ${d.maxItems} điểm)`,
          )
          .join("; "),
    )
    .join("\n");
}

export function chatMessages(opts: {
  scenes: ChatScene[];
  schemas: TemplateSchemas;
  styles: Array<{ id: string; name: string }>;
  currentStyleId: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Bạn là trợ lý chỉnh sửa video ngắn. Người dùng không biết kỹ thuật: KHÔNG nhắc tới JSON, id, slot, template hay tên công cụ trong "reply".

Video hiện có ${opts.scenes.length} cảnh (phong cách hiện tại: "${opts.currentStyleId}"):
${describeScenes(opts.scenes)}

Trả về DUY NHẤT JSON: {"kind": "edit" | "clarify" | "info", "reply": "câu trả lời ngắn tiếng Việt", "edits": [...]}
Các thao tác được phép trong "edits":
- {"op":"set_slot","sceneId":..., "slot":..., "value":...}: đổi chữ trên màn hình của một cảnh.
- {"op":"set_sentence","scriptId":..., "text":...}: đổi một câu lời đọc.
- {"op":"remove_scene","sceneId":...}: bỏ một cảnh (bỏ luôn lời đọc của cảnh đó).
- {"op":"set_style","styleId":...}: đổi phong cách cả video; chỉ dùng: ${opts.styles.map((s) => `"${s.id}" (${s.name})`).join(", ")}.

Quy tắc:
- Chỉ sửa đúng điều người dùng yêu cầu, giữ nguyên mọi thứ khác. Dùng đúng sceneId/scriptId ở trên.
- Người dùng gọi cảnh theo số thứ tự (Cảnh 1 … Cảnh ${opts.scenes.length}).
- Nếu yêu cầu mơ hồ (không rõ cảnh nào hoặc muốn gì): kind "clarify", hỏi ĐÚNG MỘT câu, edits rỗng.
- Nếu yêu cầu nhắc tới cảnh không tồn tại hoặc không làm được: kind "info", giải thích ngắn, edits rỗng.
- Giữ đúng giới hạn ký tự của từng ô chữ:
${describeSchemas(opts.schemas)}`,
    },
    ...opts.history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: opts.message },
  ];
}

/** Rule check of the model output against the current video (returned as repair feedback). */
export function validateChat(
  out: ChatOutput,
  scenes: ChatScene[],
  schemas: TemplateSchemas,
  styleIds: string[],
): string[] {
  const errors: string[] = [];
  if (out.kind === "edit" && !out.edits.length)
    errors.push('kind "edit" cần ít nhất một thao tác trong edits');
  if (out.kind !== "edit" && out.edits.length) errors.push(`kind "${out.kind}" phải có edits rỗng`);
  if (out.kind === "clarify" && (out.reply.match(/\?/g) ?? []).length !== 1)
    errors.push('kind "clarify" phải hỏi đúng một câu (một dấu "?")');
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const scriptIds = new Set(scenes.flatMap((s) => s.narration.map(([id]) => id)));
  const removed = out.edits.filter((e) => e.op === "remove_scene").length;
  if (removed >= scenes.length) errors.push("không được bỏ hết các cảnh");
  for (const e of out.edits) {
    if (e.op === "set_slot") {
      const sc = byId.get(e.sceneId);
      if (!sc) {
        errors.push(`sceneId "${e.sceneId}" không tồn tại`);
        continue;
      }
      const def = schemas[sc.templateId]?.[e.slot];
      if (!def) {
        errors.push(`cảnh "${e.sceneId}" không có ô chữ "${e.slot}"`);
        continue;
      }
      if (def.type === "text" && (typeof e.value !== "string" || [...e.value].length > def.maxLength))
        errors.push(`"${e.slot}" phải là chuỗi ≤ ${def.maxLength} ký tự`);
      if (
        def.type === "list" &&
        (!Array.isArray(e.value) ||
          e.value.length > def.maxItems ||
          e.value.some((x) => [...x].length > def.itemMaxLength))
      )
        errors.push(`"${e.slot}" phải là mảng ≤ ${def.maxItems} mục, mỗi mục ≤ ${def.itemMaxLength} ký tự`);
      if (def.type === "number" && typeof e.value !== "number") errors.push(`"${e.slot}" phải là số`);
    } else if (e.op === "set_sentence") {
      if (!scriptIds.has(e.scriptId)) errors.push(`scriptId "${e.scriptId}" không tồn tại`);
    } else if (e.op === "remove_scene") {
      if (!byId.has(e.sceneId)) errors.push(`sceneId "${e.sceneId}" không tồn tại`);
    } else if (!styleIds.includes(e.styleId)) errors.push(`styleId "${e.styleId}" không hợp lệ`);
  }
  return errors;
}
