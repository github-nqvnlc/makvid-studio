import { z } from "zod";
import { findNonNfc } from "./text/nfc";

export const SPEC_VERSION = "0.1.0";

export const AspectRatio = z.enum(["16:9", "9:16", "1:1", "4:5"]);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/** "16:9" -> "16x9" (file-system safe). */
export const aspectSlug = (a: AspectRatio): string => a.replace(":", "x");

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, "id must be [a-z0-9_-]");

export const Voice = z.union([
  z.object({ voiceId: z.string().min(1), speed: z.number().min(0.5).max(2).optional() }),
  z.object({ recordingAssetId: z.string().min(1) }),
]);

export const Meta = z.object({
  language: z.literal("vi"),
  aspectRatios: z.array(AspectRatio).min(1),
  fps: z.union([z.literal(30), z.literal(60)]),
  resolution: z.enum(["1080p", "2160p"]),
  primaryStyleId: id,
  brandKitId: z.string().optional(),
  voice: Voice,
  music: z
    .object({
      trackId: z.string().optional(),
      assetId: z.string().optional(),
      volumeDb: z.number().optional(),
      mood: z.string().optional(),
    })
    .optional(),
  targetDurationSec: z.number().min(30).max(600),
  seed: z.number().int().nonnegative(),
  watermark: z.boolean().optional(),
});

export const ScriptPart = z.object({ id, text: z.string().min(1) });

export const SlotValue = z.union([
  z.string(),
  z.number(),
  z.object({ assetId: z.string().min(1) }),
  z.object({ series: z.array(z.object({ label: z.string(), value: z.number() })).min(1) }),
  z.object({ var: z.string().min(1) }),
  z.array(z.string()),
]);
export type SlotValue = z.infer<typeof SlotValue>;

export const Scene = z.object({
  id,
  styleId: id,
  templateId: z.string().min(1),
  slots: z.record(z.string(), SlotValue),
  freeform: z.object({ html: z.string(), css: z.string(), js: z.string() }).optional(),
  scriptRefs: z.array(z.string()),
  assets: z.array(z.string()),
  transitionIn: z.object({ presetId: z.string(), durationMs: z.number().int().min(0).max(2000) }).optional(),
  tuning: z
    .object({
      speed: z.number().min(0.25).max(4).optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .optional(),
      emphasisWords: z.array(z.string()).optional(),
    })
    .optional(),
  timing: z.object({ startMs: z.number().int().min(0), durationMs: z.number().int().min(500) }).optional(),
});
export type Scene = z.infer<typeof Scene>;

export const Word = z.object({
  text: z.string().min(1),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  scriptId: z.string(),
});
export type Word = z.infer<typeof Word>;

const VideoSpecBase = z.object({
  specVersion: z.literal(SPEC_VERSION),
  meta: Meta,
  script: z.array(ScriptPart).min(1),
  scenes: z.array(Scene).min(1),
  audio: z.object({
    narration: z.object({ assetKey: z.string(), words: z.array(Word) }).optional(),
    sfx: z.array(z.object({ sfxId: z.string(), atMs: z.number().min(0), gainDb: z.number().optional() })),
    ducking: z.object({ enabled: z.boolean(), reductionDb: z.number() }),
    loudnessTargetLufs: z.number().default(-14),
  }),
  captions: z.object({
    enabled: z.boolean(),
    styleId: z.string().optional(),
    maxLines: z.union([z.literal(1), z.literal(2)]),
  }),
  variables: z.record(
    z.string(),
    z.object({ type: z.enum(["text", "image", "number"]), value: z.unknown().optional() }),
  ),
});

/** VideoSpec with cross-field invariants (contracts/videospec.md). */
export const VideoSpec = VideoSpecBase.superRefine((spec, ctx) => {
  for (const p of findNonNfc(spec))
    ctx.addIssue({ code: "custom", message: `text must be NFC at ${p}`, path: p.split("/").filter(Boolean) });
  const seen = new Set<string>();
  spec.scenes.forEach((s, i) => {
    if (seen.has(s.id))
      ctx.addIssue({ code: "custom", message: `duplicate scene id "${s.id}"`, path: ["scenes", i, "id"] });
    seen.add(s.id);
  });
  const scriptIds = new Set(spec.script.map((p) => p.id));
  if (scriptIds.size !== spec.script.length)
    ctx.addIssue({ code: "custom", message: "duplicate script id", path: ["script"] });
  spec.scenes.forEach((s, i) =>
    s.scriptRefs.forEach((r, j) => {
      if (!scriptIds.has(r))
        ctx.addIssue({
          code: "custom",
          message: `scriptRef "${r}" does not exist`,
          path: ["scenes", i, "scriptRefs", j],
        });
    }),
  );
  spec.scenes.forEach((s, i) => {
    if (s.templateId === "freeform" && !s.freeform)
      ctx.addIssue({ code: "custom", message: "freeform scene needs freeform", path: ["scenes", i] });
  });
  for (const w of spec.audio.narration?.words ?? [])
    if (w.endMs < w.startMs)
      ctx.addIssue({ code: "custom", message: "word endMs < startMs", path: ["audio"] });
});
export type VideoSpec = z.infer<typeof VideoSpec>;

export type ParseResult = { ok: true; spec: VideoSpec } | { ok: false; issues: string[] };

/** Parse unknown input into a VideoSpec; issues are human-readable "path: message" strings. */
export function parseVideoSpec(input: unknown): ParseResult {
  const r = VideoSpec.safeParse(input);
  if (r.success) return { ok: true, spec: r.data };
  return { ok: false, issues: r.error.issues.map((i) => `${i.path.join("/") || "/"}: ${i.message}`) };
}
