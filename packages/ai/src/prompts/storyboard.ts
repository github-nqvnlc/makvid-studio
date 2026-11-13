// Prompt + schema for the `storyboard` step (T076): assign every narration sentence to a templated scene
// and fill the template slots within the real style-pack limits.
import { z } from "zod";
import type { ChatMessage } from "../types";

export type SlotDef =
  | { type: "text"; required: boolean; maxLength: number }
  | { type: "number"; required: boolean }
  | { type: "list"; required: boolean; maxItems: number; itemMaxLength: number }
  | { type: "series"; required: boolean; maxItems: number };
export type TemplateSchemas = Record<string, Record<string, SlotDef>>;

export const StoryboardOutput = z.object({
  scenes: z
    .array(
      z.object({
        templateId: z.string(),
        /** Only when style mixing is allowed: one of the allowed style ids (absent = primary style). */
        styleId: z.string().optional(),
        sentences: z.array(z.number().int().min(1)).min(1).max(3),
        slots: z.record(z.string(), z.unknown()),
      }),
    )
    .min(3)
    .max(14),
});
export type StoryboardOutput = z.infer<typeof StoryboardOutput>;

function describe(schemas: TemplateSchemas): string {
  return Object.entries(schemas)
    .map(([id, slots]) => {
      const parts = Object.entries(slots).map(([k, d]) => {
        const req = d.required ? "bắt buộc" : "tuỳ chọn";
        if (d.type === "text") return `${k} (chuỗi, ${req}, ≤ ${d.maxLength} ký tự)`;
        if (d.type === "number") return `${k} (số, ${req})`;
        if (d.type === "list")
          return `${k} (mảng chuỗi, ${req}, ≤ ${d.maxItems} mục, mỗi mục ≤ ${d.itemMaxLength} ký tự)`;
        return `${k} ({"series":[{"label":chuỗi,"value":số}]}, ${req}, ≤ ${d.maxItems} điểm)`;
      });
      return `- ${id}: ${parts.join("; ")}`;
    })
    .join("\n");
}

/** Style mixing (T160): the primary style plus other styles a scene may use. */
export interface StyleMix {
  primary: { id: string; label: string };
  others: Array<{ id: string; label: string }>;
}

/** Most style switches allowed in one video (each excursion to another style = 2 switches). */
export const MAX_STYLE_SWITCHES = 4;

function mixRules(mix: StyleMix): string {
  const list = mix.others.map((o) => `"${o.id}" (${o.label})`).join(", ");
  return `
- Phối phong cách: phong cách chính là "${mix.primary.id}" (${mix.primary.label}). Có thể gán "styleId" cho cảnh bằng một trong: ${list}.
  Cảnh đầu và cảnh cuối dùng phong cách chính (bỏ trống "styleId"). Chỉ đổi phong cách khi nội dung cảnh đổi hẳn sắc thái
  (ví dụ một con số gây sốc, một trích dẫn), mỗi lần đổi giữ 1–2 cảnh liền nhau rồi quay về phong cách chính,
  tối đa ${MAX_STYLE_SWITCHES} lần chuyển trong cả video.`;
}

export function storyboardMessages(
  sentences: string[],
  schemas: TemplateSchemas,
  mix?: StyleMix,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Bạn là biên tập viên hình ảnh cho video ngắn. Chia lời đọc thành các cảnh và viết CHỮ TRÊN MÀN HÌNH.

Trả về DUY NHẤT JSON: {"scenes": [{"templateId": chuỗi, "sentences": [số thứ tự câu], "slots": {...}}]}

Quy tắc bắt buộc:
- Mỗi câu lời đọc (đánh số từ 1) thuộc đúng MỘT cảnh, giữ nguyên thứ tự, không bỏ sót. Mỗi cảnh 1–3 câu liên tiếp.
- Cảnh đầu tiên dùng "hook", cảnh cuối dùng "cta". Đa dạng template ở giữa, không lặp một template quá 2 lần liên tiếp.
- Chữ trên màn hình ngắn, tối đa khoảng 12 từ mỗi cảnh, tóm ý chứ không chép nguyên lời đọc.
- Slot "highlight" (nếu có) phải là một cụm từ nằm NGUYÊN VĂN trong slot "text" của cùng cảnh.
- Chỉ dùng "stat" khi lời đọc có con số cụ thể; "value" là số (dùng dấu chấm thập phân), không bịa số liệu.
- Tuân thủ đúng giới hạn ký tự. Chỉ dùng các template và slot sau:
${describe(schemas)}${mix?.others.length ? mixRules(mix) : ""}`,
    },
    { role: "user", content: sentences.map((s, i) => `${i + 1}. ${s}`).join("\n") },
  ];
}

/** Semantic validation against the real slot schemas; problems are sent back to the model for repair. */
export function validateStoryboard(
  out: StoryboardOutput,
  sentenceCount: number,
  schemas: TemplateSchemas,
  mix?: StyleMix,
): string[] {
  const p: string[] = [];
  const allowed = new Set([mix?.primary.id, ...(mix?.others ?? []).map((o) => o.id)].filter(Boolean));
  const styleOf = (s: StoryboardOutput["scenes"][number]) => s.styleId || mix?.primary.id || "";
  out.scenes.forEach((s, i) => {
    if (!s.styleId) return;
    if (!mix?.others.length) p.push(`cảnh ${i + 1}: không được gán "styleId" (video dùng một phong cách)`);
    else if (!allowed.has(s.styleId)) p.push(`cảnh ${i + 1}: phong cách "${s.styleId}" không được phép`);
  });
  if (mix?.others.length) {
    if (out.scenes[0] && styleOf(out.scenes[0]) !== mix.primary.id)
      p.push(`cảnh 1 phải dùng phong cách chính "${mix.primary.id}"`);
    const last = out.scenes.at(-1);
    if (last && styleOf(last) !== mix.primary.id)
      p.push(`cảnh cuối phải dùng phong cách chính "${mix.primary.id}"`);
    const switches = out.scenes.filter((s, i) => i > 0 && styleOf(s) !== styleOf(out.scenes[i - 1]!)).length;
    if (switches > MAX_STYLE_SWITCHES) p.push(`đổi phong cách ${switches} lần, tối đa ${MAX_STYLE_SWITCHES}`);
  }
  const order = out.scenes.flatMap((s) => s.sentences);
  const expected = Array.from({ length: sentenceCount }, (_, i) => i + 1);
  if (order.join(",") !== expected.join(","))
    p.push(
      `các cảnh phải dùng đúng các câu ${expected.join(",")} theo thứ tự, mỗi câu một lần (hiện tại: ${order.join(",")})`,
    );
  if (out.scenes[0]?.templateId !== "hook") p.push(`cảnh 1 phải là "hook"`);
  if (out.scenes.at(-1)?.templateId !== "cta") p.push(`cảnh cuối phải là "cta"`);
  out.scenes.forEach((sc, i) => {
    const at = `cảnh ${i + 1}`;
    const tpl = schemas[sc.templateId];
    if (!tpl) {
      p.push(`${at}: template "${sc.templateId}" không tồn tại`);
      return;
    }
    for (const [k, d] of Object.entries(tpl)) {
      const v = sc.slots[k];
      if (v === undefined || v === null || v === "") {
        if (d.required) p.push(`${at}: thiếu slot bắt buộc "${k}"`);
        continue;
      }
      if (d.type === "text") {
        if (typeof v !== "string") p.push(`${at}: "${k}" phải là chuỗi`);
        else if ([...v].length > d.maxLength)
          p.push(`${at}: "${k}" dài ${[...v].length} ký tự, tối đa ${d.maxLength}`);
      } else if (d.type === "number") {
        if (typeof v !== "number" || !Number.isFinite(v)) p.push(`${at}: "${k}" phải là số`);
      } else if (d.type === "list") {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
          p.push(`${at}: "${k}" phải là mảng chuỗi`);
        else {
          if (v.length > d.maxItems) p.push(`${at}: "${k}" có ${v.length} mục, tối đa ${d.maxItems}`);
          v.forEach(
            (x: string, j: number) =>
              [...x].length > d.itemMaxLength &&
              p.push(`${at}: "${k}" mục ${j + 1} dài quá ${d.itemMaxLength} ký tự`),
          );
        }
      } else if (d.type === "series") {
        const s = (v as { series?: unknown }).series;
        if (
          !Array.isArray(s) ||
          s.some(
            (x) =>
              typeof (x as { value?: unknown }).value !== "number" ||
              typeof (x as { label?: unknown }).label !== "string",
          )
        )
          p.push(`${at}: "${k}" phải có dạng {"series":[{"label":chuỗi,"value":số}]}`);
        else if (s.length > d.maxItems) p.push(`${at}: "${k}" có quá ${d.maxItems} điểm`);
      }
    }
    for (const k of Object.keys(sc.slots))
      if (!(k in tpl)) p.push(`${at}: slot "${k}" không thuộc template "${sc.templateId}"`);
    const text = sc.slots.text;
    const hl = sc.slots.highlight;
    if (
      typeof hl === "string" &&
      hl &&
      typeof text === "string" &&
      !text.toLowerCase().includes(hl.toLowerCase())
    )
      p.push(`${at}: "highlight" ("${hl}") phải nằm nguyên văn trong "text"`);
  });
  return p;
}
