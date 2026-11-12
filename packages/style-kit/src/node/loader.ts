// Style pack loader + validator (contracts/style-pack.md). Any contract violation is a hard error.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ASPECTS, TEMPLATE_IDS, type TemplateId, type Tokens } from "../template";
import type { Aspect } from "../safe-area";
import { FontBook, VIETNAMESE_CHARSET, type FontsManifest } from "./fonts";

const Localized = z.object({ vi: z.string().min(1), en: z.string().min(1) });
const Insets = z
  .object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
  .partial();

export const Manifest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: Localized,
  description: Localized,
  contentTypes: z.array(z.string()).min(1),
  aspectRatios: z.array(z.enum(["16:9", "9:16", "1:1", "4:5"])).min(1),
  templates: z.array(z.enum(TEMPLATE_IDS as [TemplateId, ...TemplateId[]])),
  runtime: z.enum(["gsap", "mkv"]),
  libraries: z.array(z.object({ name: z.string(), version: z.string(), license: z.string() })),
  musicMoods: z.array(z.string()),
  safeArea: z.record(z.string(), Insets).optional(),
  perfBudget: z.object({ maxMsPerFrame: z.number().positive() }),
});
export type Manifest = z.infer<typeof Manifest>;

const TokensSchema = z
  .object({
    colors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i)),
    fonts: z.record(z.string(), z.object({ family: z.string(), weight: z.number().int() })),
  })
  .passthrough();

const SlotSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), required: z.boolean(), maxLength: z.number().int().positive() }),
  z.object({ type: z.literal("number"), required: z.boolean() }),
  z.object({
    type: z.literal("list"),
    required: z.boolean(),
    maxItems: z.number().int().positive(),
    itemMaxLength: z.number().int().positive(),
  }),
  z.object({ type: z.literal("series"), required: z.boolean(), maxItems: z.number().int().positive() }),
]);
export const TemplateSchema = z.object({ slots: z.record(z.string(), SlotSchema) });
export type TemplateSchema = z.infer<typeof TemplateSchema>;

const CaptionStyle = z.object({
  font: z.string(),
  maxFontSize: z.number(),
  minFontSize: z.number(),
  lineHeight: z.number(),
  maxWords: z.number().int().positive(),
  boxWidth: z.number().gt(0).lte(1),
  bottom: z.number().gte(0).lt(1),
});
export const CaptionsSchema = z.object({ default: CaptionStyle });

const FontsSchema = z.object({
  license: z.string(),
  faces: z.array(
    z.object({
      family: z.string(),
      weight: z.number().int(),
      style: z.enum(["normal", "italic"]),
      subset: z.string(),
      file: z.string(),
      unicodeRange: z.string(),
    }),
  ),
});

export const LAYOUT_FILE: Record<Aspect, string> = {
  "16:9": "layout.16x9.html",
  "9:16": "layout.9x16.html",
  "1:1": "layout.1x1.html",
  "4:5": "layout.4x5.html",
};

export interface LoadedTemplate {
  id: TemplateId;
  dir: string;
  schema: TemplateSchema;
  layouts: Record<Aspect, string>;
  entry: string; // template.ts path
}

export interface LoadedPack {
  id: string;
  dir: string;
  manifest: Manifest;
  tokens: Tokens;
  css: string;
  captions: z.infer<typeof CaptionsSchema>;
  fontsManifest: FontsManifest;
  fonts: FontBook;
  templates: Record<TemplateId, LoadedTemplate>;
}

export class PackError extends Error {
  constructor(
    readonly packId: string,
    readonly issues: string[],
  ) {
    super(`style pack "${packId}" is invalid:\n  - ${issues.join("\n  - ")}`);
    this.name = "PackError";
  }
}

function readJson(file: string, issues: string[]): unknown {
  if (!existsSync(file)) {
    issues.push(`missing ${file}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    issues.push(`${file}: ${(e as Error).message}`);
    return undefined;
  }
}

function check<T>(schema: z.ZodType<T>, value: unknown, label: string, issues: string[]): T | undefined {
  if (value === undefined) return undefined;
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  for (const i of r.error.issues) issues.push(`${label} ${i.path.join(".")}: ${i.message}`);
  return undefined;
}

/** Load and validate a style pack directory. Throws PackError listing every problem found. */
export function loadPack(dir: string): LoadedPack {
  const issues: string[] = [];
  const id = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
  const manifest = check(Manifest, readJson(join(dir, "manifest.json"), issues), "manifest.json", issues);
  const tokens = check(TokensSchema, readJson(join(dir, "tokens.json"), issues), "tokens.json", issues) as
    Tokens | undefined;
  const captions = check(
    CaptionsSchema,
    readJson(join(dir, "captions.json"), issues),
    "captions.json",
    issues,
  );
  const fontsManifest = check(
    FontsSchema,
    readJson(join(dir, "fonts", "fonts.json"), issues),
    "fonts.json",
    issues,
  );
  const cssFile = join(dir, "pack.css");
  const css = existsSync(cssFile) ? readFileSync(cssFile, "utf8") : (issues.push("missing pack.css"), "");
  if (!existsSync(join(dir, "prompt.md"))) issues.push("missing prompt.md");
  if (manifest && manifest.id !== id)
    issues.push(`manifest id "${manifest.id}" must equal folder name "${id}"`);

  const templates = {} as Record<TemplateId, LoadedTemplate>;
  for (const t of TEMPLATE_IDS) {
    const tdir = join(dir, "templates", t);
    if (!existsSync(tdir)) {
      issues.push(`missing template ${t}`);
      continue;
    }
    if (manifest && !manifest.templates.includes(t)) issues.push(`manifest.templates must list ${t}`);
    const schema = check(
      TemplateSchema,
      readJson(join(tdir, "schema.json"), issues),
      `${t}/schema.json`,
      issues,
    );
    const layouts = {} as Record<Aspect, string>;
    for (const a of ASPECTS) {
      const f = join(tdir, LAYOUT_FILE[a]);
      if (!existsSync(f)) issues.push(`missing ${t}/${LAYOUT_FILE[a]}`);
      else layouts[a] = readFileSync(f, "utf8");
    }
    const entry = join(tdir, "template.ts");
    if (!existsSync(entry)) issues.push(`missing ${t}/template.ts`);
    if (schema) templates[t] = { id: t, dir: tdir, schema, layouts, entry };
  }

  let fonts: FontBook | undefined;
  if (fontsManifest) {
    const fdir = join(dir, "fonts");
    if (!existsSync(join(fdir, fontsManifest.license))) issues.push(`missing fonts/${fontsManifest.license}`);
    const missingFiles = fontsManifest.faces.filter((f) => !existsSync(join(fdir, f.file)));
    for (const f of missingFiles) issues.push(`missing fonts/${f.file}`);
    if (!missingFiles.length) {
      fonts = new FontBook(fontsManifest, fdir);
      for (const [role, f] of Object.entries(tokens?.fonts ?? {})) {
        try {
          const missing = fonts.missingGlyphs(f.family, f.weight, VIETNAMESE_CHARSET);
          if (missing.length)
            issues.push(
              `font "${role}" (${f.family} ${f.weight}) lacks Vietnamese glyphs: ${missing.join(" ")}`,
            );
        } catch (e) {
          issues.push((e as Error).message);
        }
      }
    }
  }
  if (issues.length || !manifest || !tokens || !captions || !fontsManifest || !fonts)
    throw new PackError(id, issues);
  return { id, dir, manifest, tokens, css, captions, fontsManifest, fonts, templates };
}

/** Pack ids available under a styles root (folders with a manifest.json). */
export function listPacks(stylesRoot: string): string[] {
  if (!existsSync(stylesRoot)) return [];
  return readdirSync(stylesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(stylesRoot, d.name, "manifest.json")))
    .map((d) => d.name)
    .sort();
}
