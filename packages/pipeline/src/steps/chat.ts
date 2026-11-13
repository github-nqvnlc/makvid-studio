// chat -> patch (T099): one chat message becomes a validated RFC 6902 patch of the VideoSpec, addressed by
// scene id. Flow: LLM (constrained edit ops, rule-checked with one repair round) -> RFC 6902 ops -> zod
// (applySpecPatch) -> compile in every aspect. Nothing is saved here; the caller creates the new version
// (optimistic lock on the head) and re-renders only what changed.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatOutput, chatMessages, validateChat, type ChatEdit, type ChatScene } from "@makvid/ai";
import { compileVideo, CompileError } from "@makvid/compiler";
import { applySpecPatch, type PatchOp, type VideoSpec } from "@makvid/spec";
import type { PipelineContext } from "../context";
import { logUsage, styleOptions, templateSchemas } from "./ai";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatEditResult =
  | { kind: "clarify" | "info"; reply: string }
  | {
      kind: "edit";
      reply: string;
      patch: PatchOp[];
      spec: VideoSpec;
      affectedScenes: string[];
      /** Narration changed (sentence edited or scene removed): voice + timing must be redone. */
      needsAudio: boolean;
      targetSceneId?: string;
    };

export function chatScenes(spec: VideoSpec): ChatScene[] {
  const text = new Map(spec.script.map((s) => [s.id, s.text]));
  return spec.scenes.map((s) => ({
    id: s.id,
    templateId: s.templateId,
    slots: s.slots,
    narration: s.scriptRefs.map((r) => [r, text.get(r) ?? ""] as [string, string]),
  }));
}

/** Constrained edits -> RFC 6902 ops against `spec` (indexes resolved by id, removals last). */
export function editsToPatch(spec: VideoSpec, edits: ChatEdit[]): PatchOp[] {
  const ops: PatchOp[] = [];
  const sceneIdx = (id: string) => spec.scenes.findIndex((s) => s.id === id);
  for (const e of edits) {
    if (e.op === "set_slot")
      ops.push({ op: "add", path: `/scenes/${sceneIdx(e.sceneId)}/slots/${e.slot}`, value: e.value });
    else if (e.op === "set_sentence")
      ops.push({
        op: "replace",
        path: `/script/${spec.script.findIndex((x) => x.id === e.scriptId)}/text`,
        value: e.text,
      });
    else if (e.op === "set_style") {
      ops.push({ op: "replace", path: "/meta/primaryStyleId", value: e.styleId });
      spec.scenes.forEach((_, i) =>
        ops.push({ op: "replace", path: `/scenes/${i}/styleId`, value: e.styleId }),
      );
    }
  }
  const drop = new Set(edits.flatMap((e) => (e.op === "remove_scene" ? [e.sceneId] : [])));
  if (drop.size) {
    const kept = spec.scenes.filter((s) => !drop.has(s.id));
    const used = new Set(kept.flatMap((s) => s.scriptRefs));
    const firstKept = spec.scenes.findIndex((s) => !drop.has(s.id));
    if (firstKept > 0 && spec.scenes[firstKept]!.transitionIn)
      ops.push({ op: "remove", path: `/scenes/${firstKept}/transitionIn` });
    for (let i = spec.scenes.length - 1; i >= 0; i--)
      if (drop.has(spec.scenes[i]!.id)) ops.push({ op: "remove", path: `/scenes/${i}` });
    for (let j = spec.script.length - 1; j >= 0; j--)
      if (!used.has(spec.script[j]!.id)) ops.push({ op: "remove", path: `/script/${j}` });
  }
  return ops;
}

async function compiles(
  ctx: Pick<PipelineContext, "stylesRoot" | "brand">,
  spec: VideoSpec,
): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), "mkv-chat-"));
  try {
    for (const aspect of spec.meta.aspectRatios)
      await compileVideo(spec, {
        aspect,
        stylesRoot: ctx.stylesRoot,
        outDir: dir,
        engine: "chat-check",
        ...(ctx.brand ? { brand: ctx.brand } : {}),
      });
    return [];
  } catch (e) {
    if (e instanceof CompileError) return e.issues;
    throw e;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function chatEdit(
  ctx: Pick<PipelineContext, "llm" | "stylesRoot" | "onUsage" | "brand">,
  spec: VideoSpec,
  message: string,
  history: ChatTurn[] = [],
): Promise<ChatEditResult> {
  const scenes = chatScenes(spec);
  const schemas = templateSchemas(ctx.stylesRoot, spec.meta.primaryStyleId);
  const styles = styleOptions(ctx.stylesRoot);
  const r = await ctx.llm.complete({
    step: "chat_edit",
    messages: chatMessages({
      scenes,
      schemas,
      styles,
      currentStyleId: spec.meta.primaryStyleId,
      history,
      message: message.normalize("NFC").trim(),
    }),
    schema: ChatOutput,
    validate: (o) =>
      validateChat(
        o,
        scenes,
        schemas,
        styles.map((s) => s.id),
      ),
  });
  logUsage(ctx, "chat_edit", r.usage);
  const out = r.output;
  if (out.kind !== "edit") return { kind: out.kind, reply: out.reply };

  const patch = editsToPatch(spec, out.edits);
  const applied = applySpecPatch(spec, patch);
  const failed = {
    kind: "info" as const,
    reply: "Mình chưa áp dụng được thay đổi này. Bạn thử diễn đạt khác nhé.",
  };
  if (!applied.ok) return failed;
  if ((await compiles(ctx, applied.spec)).length) return failed;
  const target = out.edits.find((e) => "sceneId" in e);
  return {
    kind: "edit",
    reply: out.reply,
    patch,
    spec: applied.spec,
    affectedScenes: applied.affectedScenes,
    needsAudio: out.edits.some((e) => e.op === "set_sentence" || e.op === "remove_scene"),
    ...(target && "sceneId" in target ? { targetSceneId: target.sceneId } : {}),
  };
}
