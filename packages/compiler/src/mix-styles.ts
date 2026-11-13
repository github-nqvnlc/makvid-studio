// Per-scene style mixing (T160, ADR 0012). A video has one primary style; scenes may use other packs. To keep the
// video coherent: captions (font, colours, box) always come from the primary pack, the brand logo is global, and
// every scene whose style differs from the previous one opens with a "bridge" — the previous style's background
// colour fading out while the new scene enters — instead of a hard cut between two backgrounds.
import type { LoadedPack } from "@makvid/style-kit/node";
import type { Scene } from "@makvid/spec";

/** Default transition at a style change when the scene has none of its own. */
export const STYLE_BRIDGE = { presetId: "fade", durationMs: 500 } as const;

/** Top-level CSS rules whose selector mentions #captions (packs keep caption rules flat, no nesting). */
// Lookbehind (not a capture) for the previous rule's "}", so back-to-back caption rules all match.
const CAPTION_RULE = /(?<=^|\})(\s*)([^{}@]*#captions[^{}]*)\{([^{}]*)\}/g;

/** Split a pack stylesheet into its caption rules and everything else. */
export function splitCaptionCss(css: string): { captions: string; rest: string } {
  const captions: string[] = [];
  const rest = css.replace(CAPTION_RULE, (_m, ws: string, sel: string, body: string) => {
    captions.push(`${sel.trim()}{${body.trim()}}`);
    return ws;
  });
  return { captions: captions.join("\n"), rest };
}

/**
 * CSS that makes #captions look like the primary pack inside a scene of another pack: the primary pack's
 * colour/font tokens re-declared on #captions (so its caption rules resolve to its own values) and its caption
 * rules. The scene pack's caption rules must be removed from the scene CSS (splitCaptionCss().rest).
 */
export function primaryCaptionCss(primary: LoadedPack, accent?: string): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(primary.tokens.colors)) vars.push(`--c-${k}:${v}`);
  for (const [k, f] of Object.entries(primary.tokens.fonts))
    vars.push(`--f-${k}:"${f.family}",sans-serif`, `--fw-${k}:${f.weight}`);
  vars.push(`--accent:${accent ?? primary.tokens.colors.accent ?? "#ff5a5f"}`);
  return `#captions{${vars.join(";")}}\n${splitCaptionCss(primary.css).captions}`;
}

/** Font faces of the primary pack needed by its captions (the caption family only). */
export function primaryCaptionFaces(primary: LoadedPack): LoadedPack["fontsManifest"]["faces"] {
  const family = primary.tokens.fonts.caption?.family;
  return primary.fontsManifest.faces.filter((f) => f.family === family);
}

/** Transition for scene `i`: its own, or the bridge when the style changes from the previous scene. */
export function transitionFor(
  scenes: readonly Scene[],
  i: number,
): { presetId: string; durationMs: number; styleChange: boolean } | undefined {
  const s = scenes[i]!;
  const prev = i > 0 ? scenes[i - 1] : undefined;
  const styleChange = !!prev && prev.styleId !== s.styleId;
  if (s.transitionIn) return { ...s.transitionIn, styleChange };
  return styleChange ? { ...STYLE_BRIDGE, styleChange } : undefined;
}

/** Ids of the distinct styles a spec uses, primary first. */
export function stylesUsed(primaryStyleId: string, scenes: readonly Scene[]): string[] {
  return [...new Set([primaryStyleId, ...scenes.map((s) => s.styleId)])];
}
