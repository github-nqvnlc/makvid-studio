// Theme tokens must stay readable in both themes (spec FR-003, SC-006): text pairs >= 4.5:1, input outlines >= 3:1.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "../src/app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const end = css.indexOf("\n}", start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*(oklch\([^)]*\))/g)) out[m[1]!] = m[2]!;
  return out;
}

/** oklch(L C h) -> relative luminance (CSS Color 4 oklab -> linear sRGB, clipped). */
function luminance(oklch: string): number {
  const [L, C, h = 0] = oklch
    .replace(/oklch\(|\)/g, "")
    .trim()
    .split(/\s+/)
    .map(Number) as [number, number, number?];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s theme", (_name, selector) => {
  const t = block(selector);
  it.each(TEXT_PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["background", "card"])("input outline on %s is at least 3:1", (surface) => {
    expect(ratio(t["input"]!, t[surface]!)).toBeGreaterThanOrEqual(3);
  });
});
