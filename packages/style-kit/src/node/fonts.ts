// Font metrics at compile time (fontkit, MIT). Faces are split by unicode-range like the browser
// does with @font-face subsets, so the measured width matches what Chrome lays out.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as fontkit from "fontkit";
import type { Measure } from "../text";

export interface FontFaceEntry {
  family: string;
  weight: number;
  style: "normal" | "italic";
  subset: string;
  file: string; // relative to the pack's fonts/ dir
  unicodeRange: string; // CSS unicode-range
}

export interface FontsManifest {
  license: string; // file name of the license in fonts/
  faces: FontFaceEntry[];
}

interface LoadedFace extends FontFaceEntry {
  font: fontkit.Font;
  ranges: Array<[number, number]>;
}

export function parseUnicodeRange(range: string): Array<[number, number]> {
  return range
    .split(",")
    .map((r) => r.trim().replace(/^U\+/i, ""))
    .filter(Boolean)
    .map((r) => {
      if (r.includes("?")) return [parseInt(r.replace(/\?/g, "0"), 16), parseInt(r.replace(/\?/g, "F"), 16)];
      const [a, b] = r.split("-");
      const lo = parseInt(a ?? "0", 16);
      return [lo, b ? parseInt(b, 16) : lo];
    }) as Array<[number, number]>;
}

const inRanges = (cp: number, ranges: Array<[number, number]>) => ranges.some(([a, b]) => cp >= a && cp <= b);

export class FontBook {
  private faces: LoadedFace[];
  constructor(
    readonly manifest: FontsManifest,
    readonly dir: string,
  ) {
    this.faces = manifest.faces.map((f) => {
      const font = fontkit.create(readFileSync(join(dir, f.file))) as fontkit.Font;
      return { ...f, font, ranges: parseUnicodeRange(f.unicodeRange) };
    });
  }

  /** Faces of one family/weight in reverse declaration order (later @font-face wins on overlap). */
  private facesFor(family: string, weight: number): LoadedFace[] {
    const list = this.faces.filter((f) => f.family === family && f.weight === weight && f.style === "normal");
    if (!list.length) throw new Error(`font ${family} ${weight} not in pack fonts.json`);
    return [...list].reverse();
  }

  /** Width measure; `features` are OpenType tags matching CSS (e.g. ["tnum"] for tabular-nums). */
  measure(family: string, weight: number, features: string[] = []): Measure {
    const faces = this.facesFor(family, weight);
    const cache = new Map<string, number>(); // width at 1 px
    const pick = (cp: number) => faces.find((f) => inRanges(cp, f.ranges)) ?? faces[faces.length - 1]!;
    const unitWidth = (text: string): number => {
      const hit = cache.get(text);
      if (hit !== undefined) return hit;
      let total = 0;
      let run = "";
      let runFace: LoadedFace | undefined;
      const flush = () => {
        if (run && runFace)
          total += runFace.font.layout(run, features).advanceWidth / runFace.font.unitsPerEm;
        run = "";
      };
      for (const ch of text) {
        const face = pick(ch.codePointAt(0) ?? 32);
        if (face !== runFace) {
          flush();
          runFace = face;
        }
        run += ch;
      }
      flush();
      cache.set(text, total);
      return total;
    };
    return (text, fontSize) => unitWidth(text.normalize("NFC")) * fontSize;
  }

  /** Code points from `required` that no face of the family/weight can render. */
  missingGlyphs(family: string, weight: number, required: string): string[] {
    const faces = this.facesFor(family, weight);
    const missing = new Set<string>();
    for (const ch of required.normalize("NFC")) {
      const cp = ch.codePointAt(0)!;
      if (/\s/.test(ch)) continue;
      const ok = faces.some((f) => inRanges(cp, f.ranges) && f.font.hasGlyphForCodePoint(cp));
      if (!ok) missing.add(ch);
    }
    return [...missing];
  }
}

/** Every Vietnamese letter (both cases, all tones) plus digits and common punctuation. */
export const VIETNAMESE_CHARSET = (() => {
  const base = "aăâbcdđeêghiklmnoôơpqrstuưvxy";
  const vowels = "aăâeêioôơuưy";
  const tones = ["̀", "́", "̃", "̉", "̣"];
  let s = base;
  for (const v of vowels) for (const t of tones) s += (v + t).normalize("NFC");
  s += "fjwz0123456789.,;:!?\"'()-–—%/&+₫";
  return s + s.toUpperCase();
})();
