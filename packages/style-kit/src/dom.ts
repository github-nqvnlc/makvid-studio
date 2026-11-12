// DOM helpers for templates (browser). Grapheme-safe: a Vietnamese diacritic never leaves its letter.
import { splitGraphemes } from "./text";

/** Replace the text of each matched word element with one inline-block span per grapheme. */
export function explodeGraphemes(words: Element[], cls = "g"): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const w of words) {
    const text = w.textContent ?? "";
    w.textContent = "";
    for (const g of splitGraphemes(text)) {
      const s = w.ownerDocument.createElement("span");
      s.className = cls;
      s.textContent = g;
      w.appendChild(s);
      out.push(s);
    }
  }
  return out;
}

/** Create an SVG element with attributes. */
export function svg<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = doc.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
