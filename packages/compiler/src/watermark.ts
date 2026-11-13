// Free-plan watermark (US6, T141; FR-050). Drawn into every scene when spec.meta.watermark is set: a small
// "MakVid Studio" mark in the top margin (outside the safe area, like the brand logo), on the side the logo
// does not use. Uses the pack's own body font, so nothing is fetched and frames stay deterministic.
import type { BrandKit } from "./brand";

export const WATERMARK_TEXT = "MakVid Studio";

export function watermarkHtml(enabled: boolean | undefined, brand?: BrandKit): { html: string; css: string } {
  if (!enabled) return { html: "", css: "" };
  const side = brand?.logo?.position === "top-left" ? "right" : "left";
  return {
    html: `<div class="mkv-watermark" aria-hidden="true"><span class="mkv-wm-dot"></span>${WATERMARK_TEXT}</div>`,
    css:
      `.mkv-watermark{position:absolute;z-index:21;top:calc(var(--safe-top) * 0.3);${side}:var(--safe-${side});` +
      `display:flex;align-items:center;gap:.45em;padding:.3em .7em;border-radius:999px;` +
      `font:600 max(22px,calc(var(--safe-top) * 0.3))/1 var(--f-body,sans-serif);letter-spacing:.02em;` +
      `color:#fff;background:rgba(0,0,0,.42);opacity:.85;white-space:nowrap;pointer-events:none;}` +
      `.mkv-wm-dot{width:.55em;height:.55em;border-radius:50%;background:#ff5a36;}`,
  };
}
