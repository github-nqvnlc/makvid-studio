// Pure helpers (no Node APIs) shared by the compiler and the browser brand editor.
/** Colour tokens a brand may override (same names as the packs' tokens.json). */
export const BRAND_COLOR_KEYS = [
  "bg",
  "fg",
  "muted",
  "accent",
  "accentInk",
  "surface",
  "line",
  "captionBg",
  "captionFg",
] as const;
export type BrandColorKey = (typeof BRAND_COLOR_KEYS)[number];

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Colour pairs a brand must keep readable (text on background); minimum ratio per pair. */
export const BRAND_CONTRAST_RULES: Array<{ text: BrandColorKey; on: BrandColorKey; min: number }> = [
  { text: "fg", on: "bg", min: 4.5 },
  { text: "muted", on: "bg", min: 3 },
  { text: "accent", on: "bg", min: 3 },
  { text: "accentInk", on: "accent", min: 4.5 },
  { text: "fg", on: "surface", min: 4.5 },
];

/** Pairs that are too low in contrast ("accent/bg"); only pairs whose two colours are both set are checked. */
export function brandContrastIssues(colors: Partial<Record<BrandColorKey, string>>): string[] {
  return BRAND_CONTRAST_RULES.filter((r) => {
    const t = colors[r.text];
    const o = colors[r.on];
    return (
      t &&
      o &&
      COLOR.test(t) &&
      COLOR.test(o) &&
      t.length === 7 &&
      o.length === 7 &&
      contrastRatio(t, o) < r.min
    );
  }).map((r) => `${r.text}/${r.on}`);
}
