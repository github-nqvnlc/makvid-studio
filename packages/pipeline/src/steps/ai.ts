// AI steps: ingest (T073), script (T074), style_suggest (T075), storyboard (T076).
import { join } from "node:path";
import {
  ScriptOutput,
  scriptMessages,
  StoryboardOutput,
  storyboardMessages,
  StyleOutput,
  styleMessages,
  validateScript,
  validateStoryboard,
  validateStyle,
  type StyleOption,
  type TemplateSchemas,
  type TokenUsage,
} from "@makvid/ai";
import { nfc } from "@makvid/spec";
import { listPacks, loadPack } from "@makvid/style-kit/node";
import type { SourceMaterial } from "@makvid/media";
import type { PipelineContext, Step } from "../context";

export type { SourceMaterial };

export function ingest(prompt: string): SourceMaterial {
  const text = nfc(prompt).replace(/\s+/g, " ").trim();
  if (text.length < 3) throw new Error("prompt is too short");
  return { kind: "prompt", markdown: text.slice(0, 8000), metadata: {} };
}

/** A written script is narrated verbatim: only the title is derived when the user gave none. */
export function scriptFromSource(source: SourceMaterial): ScriptResult {
  const sentences = source.sentences ?? [];
  const first = (sentences[0] ?? "").replace(/[.!?…]+$/, "");
  const title = source.title ?? ([...first].length <= 60 ? first : `${[...first].slice(0, 57).join("")}…`);
  return { title, sentences };
}

export const logUsage = (ctx: Pick<PipelineContext, "onUsage">, step: Step, usage: TokenUsage[]) => {
  for (const u of usage)
    ctx.onUsage({
      step,
      provider: u.provider,
      model: u.model,
      tokensIn: u.inputTokens,
      tokensOut: u.outputTokens,
      costUsd: u.costUsd,
    });
};

export interface ScriptResult {
  title: string;
  sentences: string[];
}

export async function writeScript(
  ctx: PipelineContext,
  source: SourceMaterial,
  durationSec: number,
): Promise<ScriptResult> {
  const r = await ctx.llm.complete({
    step: "script",
    messages: scriptMessages(source.markdown, durationSec),
    schema: ScriptOutput,
    validate: (o) => validateScript(o, durationSec),
  });
  logUsage(ctx, "script", r.usage);
  return { title: r.output.title.trim(), sentences: r.output.sentences.map((s) => s.trim()) };
}

export function styleOptions(stylesRoot: string): StyleOption[] {
  return listPacks(stylesRoot).map((id) => {
    const m = loadPack(join(stylesRoot, id)).manifest;
    return { id, name: m.name.vi, description: m.description.vi, contentTypes: m.contentTypes };
  });
}

export async function suggestStyles(
  ctx: PipelineContext,
  script: ScriptResult,
): Promise<Array<{ styleId: string; reason: string }>> {
  const options = styleOptions(ctx.stylesRoot);
  const r = await ctx.llm.complete({
    step: "style_suggest",
    messages: styleMessages(script.title, script.sentences, options),
    schema: StyleOutput,
    validate: (o) => validateStyle(o, options),
  });
  logUsage(ctx, "style_suggest", r.usage);
  const seen = new Set<string>();
  return r.output.suggestions.filter((s) => !seen.has(s.styleId) && seen.add(s.styleId));
}

export function templateSchemas(stylesRoot: string, styleId: string): TemplateSchemas {
  const pack = loadPack(join(stylesRoot, styleId));
  return Object.fromEntries(
    Object.entries(pack.templates).map(([id, t]) => [id, t.schema.slots]),
  ) as TemplateSchemas;
}

export async function storyboard(
  ctx: PipelineContext,
  script: ScriptResult,
  styleId: string,
): Promise<StoryboardOutput> {
  const schemas = templateSchemas(ctx.stylesRoot, styleId);
  const r = await ctx.llm.complete({
    step: "storyboard",
    messages: storyboardMessages(script.sentences, schemas),
    schema: StoryboardOutput,
    validate: (o) => validateStoryboard(o, script.sentences.length, schemas),
  });
  logUsage(ctx, "storyboard", r.usage);
  return r.output;
}
