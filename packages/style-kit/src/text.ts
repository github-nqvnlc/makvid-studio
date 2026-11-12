// Text utilities shared by the compiler (fitting at compile time) and templates (split effects).
// Vietnamese words are space-separated syllables; we only ever break lines at spaces.

/** Split into user-perceived characters (grapheme clusters) on the NFC string: a diacritic never leaves its base. */
export function splitGraphemes(text: string): string[] {
  const seg = new Intl.Segmenter("vi", { granularity: "grapheme" });
  return Array.from(seg.segment(text.normalize("NFC")), (s) => s.segment);
}

/** Split into words on whitespace (NFC). Punctuation stays attached to its word. */
export function splitWords(text: string): string[] {
  return text.normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

/** Width in px of `text` at `fontSize` px. */
export type Measure = (text: string, fontSize: number) => number;

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  maxFontSize: number;
  minFontSize: number;
  /** Line height as a multiple of font size. */
  lineHeight: number;
  maxLines?: number;
  /** Balance lines (avoid a lone last word), like CSS text-wrap: balance. Default true. */
  balance?: boolean;
  measure: Measure;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  /** True when even minFontSize cannot fit; lines are still word-wrapped (never split mid-word). */
  overflow: boolean;
  width: number;
  height: number;
}

/** Greedy word wrap at `width`. A single word wider than `width` gets its own line. */
export function wrapWords(words: string[], width: number, fontSize: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (!line || measure(candidate, fontSize) <= width) line = candidate;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function layout(words: string[], size: number, o: FitOptions, balance: boolean) {
  let lines = wrapWords(words, o.maxWidth, size, o.measure);
  if (balance && lines.length > 1) {
    // Smallest width that keeps the same line count (binary search) -> visually balanced lines.
    const widest = Math.max(...words.map((w) => o.measure(w, size)));
    let lo = widest;
    let hi = o.maxWidth;
    for (let i = 0; i < 18 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      if (wrapWords(words, mid, size, o.measure).length <= lines.length) hi = mid;
      else lo = mid;
    }
    lines = wrapWords(words, hi, size, o.measure);
  }
  const width = Math.max(0, ...lines.map((l) => o.measure(l, size)));
  const height = lines.length * size * o.lineHeight;
  const fits =
    width <= o.maxWidth + 0.01 &&
    height <= o.maxHeight + 0.01 &&
    (o.maxLines === undefined || lines.length <= o.maxLines);
  return { lines, width, height, fits };
}

/**
 * Fit text into a box: shrink the font from maxFontSize down to minFontSize (1 px steps), wrapping only at
 * spaces. Returns the largest size that fits; if none fits, minFontSize with overflow = true.
 */
export function fitText(text: string, o: FitOptions): FitResult {
  const words = splitWords(text);
  const balance = o.balance ?? true;
  if (!words.length) return { fontSize: o.maxFontSize, lines: [], overflow: false, width: 0, height: 0 };
  const max = Math.floor(o.maxFontSize);
  const min = Math.ceil(o.minFontSize);
  for (let size = max; size >= min; size--) {
    const r = layout(words, size, o, balance);
    if (r.fits) return { fontSize: size, lines: r.lines, overflow: false, width: r.width, height: r.height };
  }
  const r = layout(words, min, o, balance);
  return { fontSize: min, lines: r.lines, overflow: true, width: r.width, height: r.height };
}

/** Fit several texts that must share one font size (e.g. list items): the smallest of their best sizes. */
export function fitGroup(texts: string[], o: FitOptions): FitResult[] {
  const sizes = texts.map((t) => fitText(t, o).fontSize);
  const shared = Math.min(o.maxFontSize, ...sizes);
  return texts.map((t) => fitText(t, { ...o, maxFontSize: shared }));
}
