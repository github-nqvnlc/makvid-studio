// Whiteboard effects: words written one by one with a hand-held marker that follows the writing, and SVG
// strokes (underline, circle, tick, sketch box) drawn with stroke-dashoffset. Everything is placed on the scene
// timeline; wobble in the hand-drawn shapes comes from the seeded rng.
import { svg, type Rng, type Timeline } from "@makvid/style-kit";

/** Original hand + marker drawing (project-owned art), pen tip at (8, 8) in a 220×220 box. */
const HAND_SVG = `<svg viewBox="0 0 220 220" width="220" height="220" aria-hidden="true">
<g stroke="#1f2a44" stroke-width="3" stroke-linejoin="round">
<path d="M8 8 L22 14 L120 112 L104 128 L6 30 Z" fill="#c8102e"/>
<path d="M8 8 L22 14 L14 22 Z" fill="#1f2a44"/>
<path d="M60 52 L72 64" stroke="#ffffff" stroke-width="4" fill="none"/>
<path d="M96 104 C110 84 140 82 160 96 C186 112 210 140 214 176 L214 220 L132 220 C120 200 104 188 98 168 C92 150 90 124 96 104 Z" fill="var(--c-skin)"/>
<path d="M96 104 C84 112 80 128 92 136 C104 144 118 136 122 120" fill="var(--c-skin)"/>
<path d="M118 150 C130 156 146 154 156 144" fill="none" stroke="var(--c-skinShade)"/>
</g></svg>`;

export interface Board {
  hand: HTMLElement;
  root: HTMLElement;
  width: number;
  height: number;
  /** Words to write, in order, with their writing window (scene seconds). */
  plan: Array<{ el: HTMLElement; start: number; end: number }>;
}

export function board(root: HTMLElement, width: number, height: number): Board {
  const hand = root.ownerDocument.createElement("div");
  hand.className = "wb-hand";
  hand.setAttribute("aria-hidden", "true");
  hand.innerHTML = HAND_SVG;
  hand.style.opacity = "0";
  root.appendChild(hand);
  return { hand, root, width, height, plan: [] };
}

/**
 * Write the words of `els` one after another starting at `at`, `perWord` seconds each. Returns the time the
 * last word is finished. The hand follows through drive().
 */
export function write(
  tl: Timeline,
  b: Board | null,
  els: HTMLElement[],
  at: number,
  perWord: number,
): number {
  let t = at;
  for (const w of els) {
    tl.fromTo(w, { opacity: 0 }, { opacity: 1 }, { duration: perWord * 0.8, ease: "power1.out" }, t);
    b?.plan.push({ el: w, start: t, end: t + perWord });
    t += perWord;
  }
  return t;
}

/**
 * Move the hand along the plan. Positions are read from the live layout when a frame is sought (web fonts are
 * loaded by then), so the hand always sits on the word being written. After the last word it slides away.
 */
export function drive(tl: Timeline, b: Board, duration: number): void {
  if (!b.plan.length) return;
  const last = b.plan[b.plan.length - 1]!;
  const leave = last.end + 0.25;
  tl.progress(0, { duration, ease: "none" }, (p) => {
    const t = p * duration;
    if (t < b.plan[0]!.start || t > leave + 0.6) {
      b.hand.style.opacity = "0";
      return;
    }
    const rr = b.root.getBoundingClientRect();
    const k = rr.width ? b.width / rr.width : 1;
    const at = (el: Element, fx: number) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - rr.left + r.width * fx) * k, y: (r.top - rr.top + r.height * 0.78) * k };
    };
    let x: number;
    let y: number;
    if (t >= last.end) {
      const s = at(last.el, 1);
      const q = Math.min(1, (t - leave) / 0.6);
      const e = q <= 0 ? 0 : q * q;
      x = s.x + (b.width + 60 - s.x) * e;
      y = s.y + (b.height + 60 - s.y) * e;
    } else {
      const cur = [...b.plan].reverse().find((w) => w.start <= t) ?? b.plan[0]!;
      const f = Math.min(1, (t - cur.start) / (cur.end - cur.start));
      const s = at(cur.el, 0.15 + 0.8 * f);
      x = s.x;
      y = s.y;
    }
    b.hand.style.opacity = "1";
    b.hand.style.transform = `translate(${Math.round(x - 8)}px, ${Math.round(y - 8)}px)`;
  });
}

/** Path in host pixels: built once the host has its final layout size. */
export type Shape = (w: number, h: number) => string;

export interface Stroke {
  host: Element;
  box: SVGSVGElement;
  path: SVGPathElement;
  shape: Shape;
  sized: boolean;
}

/** An SVG stroke filling its host (position: absolute; inset given by CSS class). */
export function stroke(host: Element, cls: string, shape: Shape): Stroke {
  const doc = host.ownerDocument;
  const box = svg(doc, "svg", { class: cls, "aria-hidden": "true" });
  const path = svg(doc, "path", { pathLength: 1 });
  path.style.strokeDasharray = "1";
  path.style.strokeDashoffset = "1";
  box.appendChild(path);
  host.appendChild(box);
  return { host, box, path, shape, sized: false };
}

/**
 * Draw a stroke from `at` over `dur` seconds (stroke-dashoffset 1 → 0). The path is laid out in the svg's own
 * pixel size on the first sought frame (fonts are loaded by then), so strokes are never stretched.
 */
export function draw(tl: Timeline, s: Stroke, at: number, dur: number): void {
  tl.progress(at, { duration: dur, ease: "power1.inOut" }, (p) => {
    if (!s.sized) {
      // Layout size in CSS px (not affected by transforms on ancestors).
      const w = Math.max(1, s.box.clientWidth);
      const h = Math.max(1, s.box.clientHeight);
      s.box.setAttribute("viewBox", `0 0 ${w} ${h}`);
      s.path.setAttribute("d", s.shape(w, h));
      s.sized = true;
    }
    s.path.style.strokeDashoffset = String(1 - p);
  });
}

/** Wobbly underline across the box. */
export function underline(rng: Rng): Shape {
  const j = [0, 1, 2, 3].map(() => rng.range(-0.15, 0.15));
  return (w, h) => {
    const y = (i: number) => (h * (0.5 + j[i]!)).toFixed(1);
    return `M2 ${y(0)} C ${w * 0.3} ${y(1)}, ${w * 0.6} ${y(2)}, ${w - 2} ${y(3)}`;
  };
}

/** Hand-drawn ellipse (slightly open, overshooting) around the box. */
export function circle(rng: Rng): Shape {
  const pts = [
    [0.12, 0.3],
    [0.3, 0.04],
    [0.84, 0.06],
    [0.96, 0.44],
    [1, 0.8],
    [0.4, 1],
    [0.12, 0.78],
    [-0.04, 0.62],
    [0.04, 0.32],
    [0.3, 0.16],
  ].map(([x, y]) => [x! + rng.range(-0.03, 0.03), y! + rng.range(-0.03, 0.03)] as const);
  return (w, h) => {
    const P = (i: number) => `${(pts[i]![0] * w).toFixed(1)} ${(pts[i]![1] * h).toFixed(1)}`;
    return `M${P(0)} C ${P(1)}, ${P(2)}, ${P(3)} C ${P(4)}, ${P(5)}, ${P(6)} C ${P(7)}, ${P(8)}, ${P(9)}`;
  };
}

/** Sketchy rectangle around the box (closing stroke overshoots a little). */
export function sketchBox(rng: Rng): Shape {
  const j = Array.from({ length: 10 }, () => rng.range(-3, 3));
  return (w, h) =>
    `M${3 + j[0]!} ${3 + j[1]!} L${w - 3 + j[2]!} ${3 + j[3]!} L${w - 3 + j[4]!} ${h - 3 + j[5]!} L${3 + j[6]!} ${h - 3 + j[7]!} Z M${6 + j[8]!} ${6 + j[9]!} L${w * 0.4} ${5 + j[9]!}`;
}
