// Brand kit override (T123, US8): the workspace's colours replace the pack's colour tokens, the brand fonts
// replace the display / body / caption roles (fitted text is measured with the brand font, so every
// compile-time fit guarantee still holds), and the logo is placed in a top corner of the frame margin,
// outside the content region, in every aspect.
import { basename, extname } from "node:path";
import { BRAND_COLOR_KEYS, type BrandColorKey } from "./contrast";
import {
  FontBook,
  unicodeRangeOf,
  VIETNAMESE_CHARSET,
  type FontsManifest,
  type LoadedPack,
} from "@makvid/style-kit/node";

export interface BrandFont {
  family: string;
  weight: number;
  /** One full font file, or several subset files of the same face (absolute paths: .woff2 / .woff / .ttf / .otf). */
  files: string[];
}

export interface BrandKit {
  colors?: Partial<Record<BrandColorKey, string>>;
  fonts?: Partial<Record<"display" | "body" | "caption", BrandFont>>;
  logo?: { file: string; position?: "top-left" | "top-right" };
}

export class BrandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandError";
  }
}

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FAMILY = /^[\p{L}\p{N} _-]{1,60}$/u;

/** Faces of a brand font family, with unicode ranges read from each file. */
function brandFaces(f: BrandFont): FontsManifest["faces"] {
  return f.files.map((file, i) => ({
    family: f.family,
    weight: f.weight,
    style: "normal" as const,
    subset: `brand-${i}`,
    file,
    unicodeRange: unicodeRangeOf(file),
  }));
}

/** Check a brand font can render Vietnamese (all letters, tones, "₫"); returns missing characters. */
export function brandFontMissingGlyphs(f: BrandFont): string[] {
  const manifest: FontsManifest = { license: "", faces: brandFaces(f) };
  return new FontBook(manifest, "/").missingGlyphs(f.family, f.weight, VIETNAMESE_CHARSET);
}

/** A copy of the pack with the brand applied (the original pack is never mutated). */
export function applyBrand(pack: LoadedPack, brand: BrandKit): LoadedPack {
  const colors = { ...pack.tokens.colors };
  for (const [k, v] of Object.entries(brand.colors ?? {})) {
    if (!(BRAND_COLOR_KEYS as readonly string[]).includes(k) || !v) continue;
    if (!COLOR.test(v)) throw new BrandError(`invalid colour "${v}" for ${k}`);
    colors[k] = v;
  }
  const fonts = { ...pack.tokens.fonts };
  const extra: FontsManifest["faces"] = [];
  for (const [role, f] of Object.entries(brand.fonts ?? {})) {
    if (!f || !(role in fonts)) continue;
    if (!FAMILY.test(f.family)) throw new BrandError(`invalid font family "${f.family}"`);
    fonts[role] = { family: f.family, weight: f.weight };
    if (!extra.some((e) => e.family === f.family && e.weight === f.weight)) extra.push(...brandFaces(f));
  }
  const fontsManifest: FontsManifest = {
    ...pack.fontsManifest,
    faces: [...pack.fontsManifest.faces, ...extra],
  };
  return {
    ...pack,
    tokens: { ...pack.tokens, colors, fonts },
    fontsManifest,
    fonts: extra.length ? new FontBook(fontsManifest, `${pack.dir}/fonts`) : pack.fonts,
  };
}

/** File name a font face is served under inside the scene's assets/fonts. */
export function servedFontName(file: string): string {
  return basename(file);
}

export function fontFormat(file: string): string {
  const ext = extname(file).toLowerCase();
  return ext === ".woff2" ? "woff2" : ext === ".woff" ? "woff" : ext === ".otf" ? "opentype" : "truetype";
}

/** Logo markup + CSS (top margin corner; height scales with the aspect's top safe margin). */
export function logoHtml(brand: BrandKit | undefined): { html: string; css: string; file?: string } {
  if (!brand?.logo) return { html: "", css: "" };
  const name = `logo${extname(brand.logo.file).toLowerCase()}`;
  const side = brand.logo.position === "top-left" ? "left" : "right";
  return {
    file: name,
    html: `<img class="brand-logo" src="assets/brand/${name}" alt="" aria-hidden="true">`,
    css: `.brand-logo{position:absolute;z-index:20;top:calc(var(--safe-top) * 0.22);${side}:var(--safe-${side});height:max(44px,calc(var(--safe-top) * 0.56));max-width:30%;object-fit:contain;object-position:${side} top;}`,
  };
}

export * from "./contrast";
