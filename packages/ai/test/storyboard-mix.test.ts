// T160: storyboard style mixing rules (prompt + validator).
import { describe, expect, it } from "vitest";
import {
  MAX_STYLE_SWITCHES,
  storyboardMessages,
  validateStoryboard,
  type StoryboardOutput,
  type StyleMix,
  type TemplateSchemas,
} from "../src";

const schemas: TemplateSchemas = {
  hook: { headline: { type: "text", required: true, maxLength: 48 } },
  highlight: { text: { type: "text", required: true, maxLength: 80 } },
  cta: { headline: { type: "text", required: true, maxLength: 48 } },
};
const mix: StyleMix = {
  primary: { id: "minimal", label: "Tối giản" },
  others: [
    { id: "neon", label: "Neon" },
    { id: "whiteboard", label: "Bảng trắng" },
  ],
};
const scene = (templateId: string, n: number, styleId?: string) => ({
  templateId,
  sentences: [n],
  slots: templateId === "highlight" ? { text: "Một ý" } : { headline: "Tiêu đề" },
  ...(styleId ? { styleId } : {}),
});
const board = (styles: Array<string | undefined>): StoryboardOutput => ({
  scenes: styles.map((s, i) =>
    scene(i === 0 ? "hook" : i === styles.length - 1 ? "cta" : "highlight", i + 1, s),
  ),
});

describe("storyboard style mixing", () => {
  it("prompt lists the allowed styles only when mixing is on", () => {
    const withMix = storyboardMessages(["Câu một."], schemas, mix)[0]!.content;
    expect(withMix).toContain('"neon" (Neon)');
    expect(withMix).toContain('phong cách chính là "minimal"');
    expect(storyboardMessages(["Câu một."], schemas)[0]!.content).not.toContain("Phối phong cách");
  });

  it("accepts an excursion to an allowed style and back", () => {
    expect(validateStoryboard(board([undefined, "neon", "neon", undefined]), 4, schemas, mix)).toEqual([]);
  });

  it("rejects unknown styles, styles without mixing, and a non-primary first/last scene", () => {
    expect(validateStoryboard(board([undefined, "retro-vhs", undefined]), 3, schemas, mix)).toEqual([
      'cảnh 2: phong cách "retro-vhs" không được phép',
    ]);
    expect(validateStoryboard(board([undefined, "neon", undefined]), 3, schemas)).toEqual([
      'cảnh 2: không được gán "styleId" (video dùng một phong cách)',
    ]);
    const p = validateStoryboard(board(["neon", undefined, "whiteboard"]), 3, schemas, mix);
    expect(p).toContain('cảnh 1 phải dùng phong cách chính "minimal"');
    expect(p).toContain('cảnh cuối phải dùng phong cách chính "minimal"');
  });

  it("limits the number of style switches", () => {
    const flip = [undefined, "neon", undefined, "whiteboard", undefined, "neon", undefined];
    const p = validateStoryboard(board(flip), flip.length, schemas, mix);
    expect(p).toContain(`đổi phong cách 6 lần, tối đa ${MAX_STYLE_SWITCHES}`);
  });
});
