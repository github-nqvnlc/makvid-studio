// Compiler: VideoSpec + style pack -> one self-contained directory per scene (index.html, local fonts,
// bundled runtime, no external URLs). Same inputs -> byte-identical output (constitution III).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  ASPECT_SIZES,
  aspectSlug,
  type AspectRatio,
  type Scene,
  type VideoSpec,
  type Word,
} from "@makvid/spec";
import {
  formatNumberVi,
  safeAreaPx,
  splitWords,
  type Measure,
  type RuntimeId,
  type SceneData,
  type SlotData,
} from "@makvid/style-kit";
import { loadPack, type LoadedPack, type TemplateSchema } from "@makvid/style-kit/node";
import { bundlePack, vendorFiles } from "./bundle";
import { primaryCaptionCss, primaryCaptionFaces, splitCaptionCss, transitionFor } from "./mix-styles";
import { applyBrand, fontFormat, logoHtml, servedFontName, type BrandKit } from "./brand";
import { captionsHtml, layoutCaptions, type CaptionChunkOut, type CaptionStyle } from "./captions";
import { hashDir, sceneCacheKey } from "./hash";
import { escapeHtml, parseLayout, renderLayout, wordKey, type FitIssue } from "./layout";
import { sceneTimings, wordsByScene } from "./timing";

export const COMPILER_VERSION = "0.1.0";

export interface CompileOptions {
  aspect: AspectRatio;
  stylesRoot: string;
  outDir: string;
  /** Animation runtime; default = the pack manifest's runtime (ADR 0001). */
  runtime?: RuntimeId;
  /** Renderer id + version, part of the cache key. */
  engine: string;
  fps?: number;
  /** Workspace brand kit (US8): colours, fonts and logo override the style pack. */
  brand?: BrandKit;
}

export interface CompiledScene {
  sceneId: string;
  index: number;
  dir: string;
  startMs: number;
  durationMs: number;
  cacheKey: string;
  fits: FitIssue[];
  captions: CaptionChunkOut[];
  words: Word[];
}

export interface CompiledVideo {
  aspect: AspectRatio;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  scenes: CompiledScene[];
}

export class CompileError extends Error {
  constructor(readonly issues: string[]) {
    super(`compile failed:\n  - ${issues.join("\n  - ")}`);
    this.name = "CompileError";
  }
}

/** Validate scene slots against the template schema (required, maxLength, maxItems). */
export function validateSlots(scene: Scene, schema: TemplateSchema): string[] {
  const issues: string[] = [];
  const at = (k: string) => `scene "${scene.id}" slot "${k}"`;
  for (const [k, def] of Object.entries(schema.slots)) {
    const v = scene.slots[k];
    if (v === undefined || v === "") {
      if (def.required) issues.push(`${at(k)} is required`);
      continue;
    }
    if (def.type === "text") {
      if (typeof v !== "string") issues.push(`${at(k)} must be text`);
      else if ([...v].length > def.maxLength) issues.push(`${at(k)} exceeds maxLength ${def.maxLength}`);
    } else if (def.type === "number") {
      if (typeof v !== "number") issues.push(`${at(k)} must be a number`);
    } else if (def.type === "list") {
      if (!Array.isArray(v)) issues.push(`${at(k)} must be a list`);
      else {
        if (v.length > def.maxItems) issues.push(`${at(k)} has more than ${def.maxItems} items`);
        v.forEach((item, i) => {
          if ([...item].length > def.itemMaxLength)
            issues.push(`${at(k)} item ${i} exceeds ${def.itemMaxLength}`);
        });
      }
    } else if (def.type === "series") {
      const s = (v as { series?: unknown[] }).series;
      if (!Array.isArray(s)) issues.push(`${at(k)} must be a series`);
      else if (s.length > def.maxItems) issues.push(`${at(k)} has more than ${def.maxItems} points`);
    }
  }
  for (const k of Object.keys(scene.slots))
    if (!schema.slots[k]) issues.push(`${at(k)} is not defined by template "${scene.templateId}"`);
  return issues;
}

function slotsData(scene: Scene): Record<string, SlotData> {
  const out: Record<string, SlotData> = {};
  for (const [k, v] of Object.entries(scene.slots)) {
    if (typeof v === "string" || typeof v === "number" || Array.isArray(v)) out[k] = v;
    else if (v && typeof v === "object" && "series" in v) out[k] = { series: v.series };
  }
  return out;
}

function fontFaceCss(pack: LoadedPack, extra: LoadedPack["fontsManifest"]["faces"] = []): string {
  return [...pack.fontsManifest.faces, ...extra]
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url("assets/fonts/${servedFontName(f.file)}") format("${fontFormat(f.file)}");unicode-range:${f.unicodeRange};}`,
    )
    .join("\n");
}

function tokensCss(pack: LoadedPack, aspect: AspectRatio, accent?: string): string {
  const { width, height } = ASPECT_SIZES[aspect];
  const override = pack.manifest.safeArea?.[aspect];
  const s = safeAreaPx(aspect, override);
  const vars: string[] = [
    `--w:${width}px`,
    `--h:${height}px`,
    `--safe-top:${s.top}px`,
    `--safe-right:${s.right}px`,
    `--safe-bottom:${s.bottom}px`,
    `--safe-left:${s.left}px`,
    `--safe-w:${s.width}px`,
    `--safe-h:${s.height}px`,
  ];
  for (const [k, v] of Object.entries(pack.tokens.colors)) vars.push(`--c-${k}:${v}`);
  for (const [k, f] of Object.entries(pack.tokens.fonts))
    vars.push(`--f-${k}:"${f.family}",sans-serif`, `--fw-${k}:${f.weight}`);
  vars.push(`--accent:${accent ?? pack.tokens.colors.accent ?? "#ff5a5f"}`);
  return `:root{${vars.join(";")}}`;
}

const BASE_CSS = `html,body{margin:0;padding:0;background:var(--c-bg);}
#root{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:var(--c-bg);color:var(--c-fg);font-family:var(--f-body);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
#scene{position:absolute;inset:0;}
#stage{position:absolute;inset:0;}
#content{position:absolute;inset:0;}
.fit{display:block;}
.ln{display:block;white-space:nowrap;}
.w,.cap-w{display:inline-block;}
#captions{position:absolute;left:var(--safe-left);right:var(--safe-right);display:flex;justify-content:center;pointer-events:none;}
.cap-chunk{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;text-align:center;opacity:0;}`;

function captionStyleFor(pack: LoadedPack, aspect: AspectRatio): CaptionStyle {
  const base = pack.captions.default;
  const { width, height } = ASPECT_SIZES[aspect];
  const k = Math.min(width, height) / 1080;
  const portrait = height > width;
  return {
    ...base,
    maxFontSize: Math.round(base.maxFontSize * k * (portrait ? 1.1 : 1)),
    minFontSize: Math.round(base.minFontSize * k),
    maxWords: portrait ? Math.min(base.maxWords, 6) : base.maxWords,
  };
}

/** Compile every scene of `spec` for one aspect ratio into `outDir/<aspect>/scenes/<NN-id>/`. */
export async function compileVideo(spec: VideoSpec, opts: CompileOptions): Promise<CompiledVideo> {
  const { width, height } = ASPECT_SIZES[opts.aspect];
  const fps = opts.fps ?? spec.meta.fps;
  const packs = new Map<string, LoadedPack>();
  const issues: string[] = [];
  const getPack = (id: string) => {
    let p = packs.get(id);
    if (!p) {
      p = loadPack(join(opts.stylesRoot, id));
      if (opts.brand) p = applyBrand(p, opts.brand);
      packs.set(id, p);
    }
    return p;
  };
  for (const s of spec.scenes) {
    if (s.templateId === "freeform") {
      issues.push(`scene "${s.id}": freeform scenes are not supported yet (M3)`);
      continue;
    }
    const pack = getPack(s.styleId);
    const tpl = pack.templates[s.templateId as keyof LoadedPack["templates"]];
    if (!tpl) issues.push(`scene "${s.id}": template "${s.templateId}" not in pack "${s.styleId}"`);
    else issues.push(...validateSlots(s, tpl.schema));
    if (!pack.manifest.aspectRatios.includes(opts.aspect))
      issues.push(`pack "${s.styleId}" does not support ${opts.aspect}`);
  }
  // Captions always use the primary style (ADR 0012); it must load even if no scene uses it.
  let primary: LoadedPack | undefined;
  try {
    primary = getPack(spec.meta.primaryStyleId);
  } catch {
    issues.push(`primary style "${spec.meta.primaryStyleId}" not found`);
  }
  if (issues.length || !primary) throw new CompileError(issues);

  const timings = sceneTimings(spec);
  const words = wordsByScene(spec, timings);
  const vendor = vendorFiles();
  const base = join(opts.outDir, aspectSlug(opts.aspect), "scenes");
  rmSync(base, { recursive: true, force: true });
  const scenes: CompiledScene[] = [];

  for (const [i, scene] of spec.scenes.entries()) {
    const pack = getPack(scene.styleId);
    const mixed = pack.id !== primary.id;
    const capPack = mixed ? primary : pack;
    const runtime: RuntimeId = opts.runtime ?? pack.manifest.runtime;
    const tpl = pack.templates[scene.templateId as keyof LoadedPack["templates"]];
    const timing = timings[i]!;
    const dir = join(base, `${String(i + 1).padStart(2, "0")}-${scene.id}`);
    mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
    mkdirSync(join(dir, "assets", "vendor"), { recursive: true });

    const measureCache = new Map<string, Measure>();
    const measureFor = (role: string, features: string[] = [], from: LoadedPack = pack): Measure => {
      const key = `${from.id}|${role}|${features.join(",")}`;
      let m = measureCache.get(key);
      if (!m) {
        const f = from.tokens.fonts[role];
        if (!f) throw new CompileError([`pack "${from.id}" has no font role "${role}"`]);
        const raw = from.fonts.measure(f.family, f.weight, features);
        m = (t, s) => raw(t, s) * 1.02; // 2% safety margin vs browser shaping
        measureCache.set(key, m);
      }
      return m;
    };
    const emphasis: string[][] = [];
    const hl = scene.slots.highlight;
    if (typeof hl === "string") emphasis.push(splitWords(hl).map(wordKey));
    for (const w of scene.tuning?.emphasisWords ?? []) emphasis.push(splitWords(w).map(wordKey));
    const fits: FitIssue[] = [];
    // Number slots also get a formatted "<slot>Text" (Vietnamese format) so layouts can fit the final value.
    const derived: Record<string, string> = {};
    for (const [k, v] of Object.entries(scene.slots))
      if (typeof v === "number") derived[`${k}Text`] = formatNumberVi(v);
    const layoutHtml = renderLayout(
      parseLayout(tpl.layouts[opts.aspect]),
      { ...scene.slots, ...derived, aspect: opts.aspect },
      { measureFor, emphasis, fits },
    );

    const sceneWords = words[i]!;
    let chunks: CaptionChunkOut[] = [];
    let capHtml = "";
    if (spec.captions.enabled && sceneWords.length) {
      const style = captionStyleFor(capPack, opts.aspect);
      chunks = layoutCaptions(
        sceneWords,
        style,
        opts.aspect,
        measureFor(style.font, [], capPack),
        spec.captions.maxLines,
        timing.startMs + timing.durationMs,
      );
      capHtml = captionsHtml(chunks, style, Math.round(safeAreaPx(opts.aspect).width * style.boxWidth));
    }
    const capBottom = Math.round(
      safeAreaPx(opts.aspect, capPack.manifest.safeArea?.[opts.aspect]).bottom +
        height * capPack.captions.default.bottom,
    );

    const capFaces = mixed ? primaryCaptionFaces(primary) : [];
    for (const [p, faces] of [
      [pack, pack.fontsManifest.faces],
      [primary, capFaces],
    ] as const)
      for (const f of faces)
        copyFileSync(
          isAbsolute(f.file) ? f.file : join(p.dir, "fonts", f.file),
          join(dir, "assets", "fonts", servedFontName(f.file)),
        );
    const transition = transitionFor(spec.scenes, i);
    const prevPack = i > 0 ? getPack(spec.scenes[i - 1]!.styleId) : undefined;
    const logo = logoHtml(opts.brand);
    if (logo.file && opts.brand?.logo) {
      mkdirSync(join(dir, "assets", "brand"), { recursive: true });
      copyFileSync(opts.brand.logo.file, join(dir, "assets", "brand", logo.file));
    }
    if (runtime === "gsap") copyFileSync(vendor.gsap, join(dir, "assets", "vendor", "gsap.min.js"));
    copyFileSync(vendor.hyperframesRuntime, join(dir, "assets", "vendor", "hyperframe.runtime.iife.js"));
    writeFileSync(join(dir, "assets", "pack.js"), await bundlePack(pack));

    const durationSec = timing.durationMs / 1000;
    const isLast = i === spec.scenes.length - 1;
    const data: SceneData = {
      sceneId: scene.id,
      templateId: scene.templateId,
      aspect: opts.aspect,
      width,
      height,
      duration: durationSec,
      seed: spec.meta.seed,
      runtime,
      slots: slotsData(scene),
      tokens: pack.tokens,
      speed: scene.tuning?.speed ?? 1,
      emphasisWords: emphasis.map((p) => p.join(" ")),
      ...(scene.tuning?.accentColor ? { accentColor: scene.tuning.accentColor } : {}),
      ...(transition
        ? {
            transitionIn: {
              presetId: transition.presetId,
              duration: transition.durationMs / 1000,
              ...(transition.styleChange && prevPack?.tokens.colors.bg
                ? { fromColor: prevPack.tokens.colors.bg }
                : {}),
            },
          }
        : {}),
      exit: isLast ? 0.5 : 0.25,
      captions: chunks.map((c) => ({
        start: (c.startMs - timing.startMs) / 1000,
        end: (c.endMs - timing.startMs) / 1000,
        words: c.words.map((w) => ({ start: (w.startMs - timing.startMs) / 1000 })),
      })),
      narration: chunks.flatMap((c) =>
        c.words.map((w) => ({ text: w.text, start: (w.startMs - timing.startMs) / 1000 })),
      ),
    };
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width},height=${height}">
<title>${escapeHtml(scene.id)}</title>
<style>
${fontFaceCss(pack, capFaces)}
${tokensCss(pack, opts.aspect, scene.tuning?.accentColor)}
${BASE_CSS}
#captions{bottom:${capBottom}px;}
${
  mixed
    ? `${splitCaptionCss(pack.css).rest}
${primaryCaptionCss(primary)}`
    : pack.css
}
${logo.css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${durationSec}" data-width="${width}" data-height="${height}">
<div id="scene" class="clip" data-start="0" data-duration="${durationSec}">
<div id="stage" class="pack-${pack.id} t-${scene.templateId} a-${aspectSlug(opts.aspect)}"><div id="content">
${layoutHtml}
</div></div>
${capHtml}
${logo.html}
</div>
</div>
${runtime === "gsap" ? '<script src="assets/vendor/gsap.min.js"></script>\n' : ""}<script src="assets/vendor/hyperframe.runtime.iife.js"></script>
<script src="assets/pack.js"></script>
<script type="application/json" id="scene-data">${json}</script>
<script>MakvidPack.mount(JSON.parse(document.getElementById("scene-data").textContent));</script>
</body>
</html>
`;
    writeFileSync(join(dir, "index.html"), html);
    const cacheKey = sceneCacheKey(
      html,
      hashDir(join(dir, "assets")),
      { width, height, fps, renderer: opts.engine },
      `${opts.engine}+compiler@${COMPILER_VERSION}`,
    );
    scenes.push({
      sceneId: scene.id,
      index: i,
      dir,
      startMs: timing.startMs,
      durationMs: timing.durationMs,
      cacheKey,
      fits,
      captions: chunks,
      words: sceneWords,
    });
  }
  const last = scenes[scenes.length - 1]!;
  return { aspect: opts.aspect, width, height, fps, durationMs: last.startMs + last.durationMs, scenes };
}
