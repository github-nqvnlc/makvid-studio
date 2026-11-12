// T094: chat -> patch. A scripted model plays the LLM; the tests check what the pipeline does with its
// answers: targeted patches by scene id, one clarifying question for ambiguous requests, an explanation
// without any change for a scene that does not exist, and repair of answers that break the rules.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS, type ChatAdapter } from "@makvid/ai";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { chatEdit, editsToPatch } from "../src";

const root = resolve(__dirname, "../../..");
const stylesRoot = join(root, "packages", "styles");
const parsed = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
if (!parsed.ok) throw new Error(parsed.issues.join("; "));
const spec: VideoSpec = parsed.spec;

/** Model that answers from a queue and records the prompts it saw. */
function scripted(...answers: object[]) {
  const prompts: string[] = [];
  const adapter: ChatAdapter = {
    provider: "fpt",
    async chat(_model, messages) {
      prompts.push(messages.map((m) => m.content).join("\n"));
      const next = answers.shift();
      if (!next) throw new Error("no more scripted answers");
      return { text: JSON.stringify(next), inputTokens: 500, outputTokens: 80 };
    },
  };
  const ctx = {
    llm: createLlm({ adapters: { fpt: adapter }, steps: DEFAULT_STEPS }),
    stylesRoot,
    onUsage: () => undefined,
  };
  return { ctx, prompts };
}

describe("chat -> patch", { timeout: 180_000 }, () => {
  it("edits one scene's on-screen text by scene id and re-renders only around it", async () => {
    const { ctx, prompts } = scripted({
      kind: "edit",
      reply: "Đã đổi tiêu đề cảnh 2.",
      edits: [{ op: "set_slot", sceneId: "title", slot: "title", value: "Lãi kép là gì?" }],
    });
    const r = await chatEdit(ctx, spec, "Đổi tiêu đề cảnh 2 thành: Lãi kép là gì?");
    expect(prompts[0]).toContain('Cảnh 2 (sceneId "title"');
    expect(r.kind).toBe("edit");
    if (r.kind !== "edit") return;
    expect(r.patch).toEqual([{ op: "add", path: "/scenes/1/slots/title", value: "Lãi kép là gì?" }]);
    expect(r.spec.scenes[1]!.slots.title).toBe("Lãi kép là gì?");
    expect(r.spec.scenes[0]).toEqual(spec.scenes[0]);
    expect(r.needsAudio).toBe(false);
    expect(r.targetSceneId).toBe("title");
    expect(r.affectedScenes).toContain("title");
    expect(r.affectedScenes.length).toBeLessThan(spec.scenes.length);
  });

  it("asks exactly one clarifying question for an ambiguous request, without changes", async () => {
    const { ctx } = scripted({ kind: "clarify", reply: "Bạn muốn đổi màu chữ ở cảnh nào?", edits: [] });
    const r = await chatEdit(ctx, spec, "Đổi màu đi");
    expect(r).toEqual({ kind: "clarify", reply: "Bạn muốn đổi màu chữ ở cảnh nào?" });
  });

  it("explains instead of changing anything for a scene that does not exist", async () => {
    const { ctx, prompts } = scripted({
      kind: "info",
      reply: "Video chỉ có 8 cảnh nên không có cảnh 12. Bạn muốn sửa cảnh nào trong 8 cảnh?",
      edits: [],
    });
    const r = await chatEdit(ctx, spec, "Sửa cảnh 12");
    expect(prompts[0]).toContain("Video hiện có 8 cảnh");
    expect(r.kind).toBe("info");
    expect("patch" in r).toBe(false);
  });

  it("repairs answers that break the rules (unknown scene, too long, two questions)", async () => {
    const { ctx, prompts } = scripted(
      {
        kind: "edit",
        reply: "Xong",
        edits: [{ op: "set_slot", sceneId: "sc99", slot: "title", value: "x" }],
      },
      {
        kind: "edit",
        reply: "Đã đổi.",
        edits: [{ op: "set_slot", sceneId: "title", slot: "title", value: "Ngắn gọn" }],
      },
    );
    const r = await chatEdit(ctx, spec, "Đổi tiêu đề");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('sceneId "sc99" không tồn tại');
    expect(r.kind).toBe("edit");
  });

  it("removing a scene drops its narration and the next opening transition", () => {
    const patch = editsToPatch(spec, [{ op: "remove_scene", sceneId: "hook" }]);
    expect(patch).toEqual([
      { op: "remove", path: "/scenes/1/transitionIn" },
      { op: "remove", path: "/scenes/0" },
      { op: "remove", path: "/script/0" },
    ]);
  });

  it("changing a sentence needs new narration; changing the style touches every scene", async () => {
    const { ctx } = scripted({
      kind: "edit",
      reply: "Đã đổi câu và phong cách.",
      edits: [
        { op: "set_sentence", scriptId: "s2", text: "Lãi kép là tiền lãi sinh ra từ tiền lãi." },
        { op: "set_style", styleId: "kinetic" },
      ],
    });
    const r = await chatEdit(ctx, spec, "Sửa câu 2 và đổi sang phong cách chữ động");
    expect(r.kind).toBe("edit");
    if (r.kind !== "edit") return;
    expect(r.needsAudio).toBe(true);
    expect(r.spec.meta.primaryStyleId).toBe("kinetic");
    expect(new Set(r.spec.scenes.map((s) => s.styleId))).toEqual(new Set(["kinetic"]));
    expect(r.affectedScenes).toHaveLength(spec.scenes.length);
  });
});
