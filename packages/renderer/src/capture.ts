// captureFrames(): PNG + DOM metrics at given times, for QA (overflow, overlap, safe area, contrast).
import type { CapturedFrame, DomMetrics, QaElement } from "./types";
import { openScene } from "./browser";

/** Runs in the page. Kept self-contained (serialized by puppeteer). */
function collectMetrics(): Omit<DomMetrics, "blockedRequests"> {
  const parse = (c: string): [number, number, number, number] | null => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1]!
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  const effectiveOpacity = (el: Element) => {
    let o = 1;
    for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  // Effective background: composite semi-transparent layers (alpha) down to the first opaque one.
  // Returns null under an image/gradient layer (contrast unknown; the pack must keep text off it).
  const backgroundOf = (el: Element): string | null => {
    const layers: Array<[number, number, number, number]> = [];
    let opaque: [number, number, number, number] | null = null;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) {
        if (bg[3] >= 0.999) {
          opaque = bg;
          break;
        }
        layers.push(bg);
      }
      if (cs.backgroundImage && cs.backgroundImage !== "none" && e.id !== "stage") return null;
    }
    let [r, g, b] = (opaque ??
      parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1]) as number[];
    for (const [lr, lg, lb, la] of layers.reverse()) {
      r = lr * la + r! * (1 - la);
      g = lg * la + g! * (1 - la);
      b = lb * la + b! * (1 - la);
    }
    return `rgb(${Math.round(r!)}, ${Math.round(g!)}, ${Math.round(b!)})`;
  };
  // Text elements are measured by their words (ink box), containers marked data-qa-box by their box.
  const contentRect = (
    el: HTMLElement,
  ): DOMRect | { x: number; y: number; width: number; height: number } => {
    if (el.hasAttribute("data-qa-box")) return el.getBoundingClientRect();
    const words = Array.from(el.querySelectorAll<HTMLElement>(".w, .cap-w"));
    if (!words.length) return el.getBoundingClientRect();
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;
    for (const w of words) {
      const r = w.getBoundingClientRect();
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  };
  const els: QaElement[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-qa]"))) {
    const r = contentRect(el);
    const textEl = el.querySelector<HTMLElement>(".fit") ?? el;
    const cs = getComputedStyle(textEl);
    const color = cs.color;
    const bg = backgroundOf(textEl);
    let contrast: number | null = null;
    const fc = parse(color);
    const bc = bg ? parse(bg) : null;
    if (fc && bc) {
      const a = lum(fc);
      const b = lum(bc);
      contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    // Overflow: any fitted line wider than its block, or the element's content exceeds the frame.
    let overflow = false;
    for (const fit of Array.from(el.querySelectorAll<HTMLElement>(".fit"))) {
      const box = fit.parentElement!.getBoundingClientRect();
      // Width the compiler measured against (data-w): the real rendered line must not exceed it,
      // which also catches CSS that changes the font after fitting.
      const declared = Number(fit.dataset.w ?? 0);
      for (const ln of Array.from(fit.querySelectorAll<HTMLElement>(".ln"))) {
        const lr = ln.getBoundingClientRect();
        let left = Infinity;
        let right = -Infinity;
        for (const w of Array.from(ln.children)) {
          const wr = (w as HTMLElement).getBoundingClientRect();
          left = Math.min(left, wr.left);
          right = Math.max(right, wr.right);
        }
        if (!Number.isFinite(left)) continue;
        if (right > box.right + 2 || lr.left < box.left - 2) overflow = true;
        if (declared && right - left > declared + 2) overflow = true;
      }
    }
    els.push({
      qa: el.dataset.qa ?? "",
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      opacity: effectiveOpacity(el),
      fontSize: parseFloat(cs.fontSize),
      color,
      background: bg,
      contrast,
      overflow,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    });
  }
  const fontsLoaded = Array.from(document.fonts)
    .filter((f) => f.status === "loaded")
    .map((f) => `${f.family} ${f.weight}`);
  return { width: innerWidth, height: innerHeight, elements: els, fontsLoaded: [...new Set(fontsLoaded)] };
}

export async function captureFrames(input: {
  sceneDir: string;
  width: number;
  height: number;
  atMs: number[];
}): Promise<CapturedFrame[]> {
  const s = await openScene(input.sceneDir, input.width, input.height);
  try {
    const out: CapturedFrame[] = [];
    for (const atMs of input.atMs) {
      await s.seek(atMs / 1000);
      const png = Buffer.from(
        await s.page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: input.width, height: input.height },
        }),
      );
      const dom = await s.page.evaluate(collectMetrics);
      out.push({ atMs, png, dom: { ...dom, blockedRequests: [...s.blocked] } });
    }
    return out;
  } finally {
    await s.close();
  }
}
