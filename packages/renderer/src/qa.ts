// Visual QA rules over captured DOM metrics (SC-013 / FR QA): overflow, overlap, safe area, contrast,
// and no external requests. Pure functions so worker-render (M2) can reuse them.
import { insideSafeArea, type Aspect, type Insets } from "@makvid/style-kit";
import type { DomMetrics, QaElement, Rect } from "./types";

export type QaRule = "overflow" | "overlap" | "safe-area" | "contrast" | "network";

export interface QaIssue {
  rule: QaRule;
  atMs: number;
  elements: string[];
  detail: string;
}

const area = (r: Rect) => Math.max(0, r.width) * Math.max(0, r.height);
function intersection(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const contains = (a: Rect, b: Rect) =>
  b.x >= a.x - 1 &&
  b.y >= a.y - 1 &&
  b.x + b.width <= a.x + a.width + 1 &&
  b.y + b.height <= a.y + a.height + 1;

export interface QaOptions {
  aspect: Aspect;
  safeArea?: Partial<Insets>;
  /** Elements fainter than this are mid-animation and ignored (default 0.6). */
  minOpacity?: number;
  /** Overlap tolerance as a fraction of the smaller element (default 0.03). */
  overlapTolerance?: number;
}

/** Minimum WCAG contrast: 3:1 for large text (>= 24 px), 4.5:1 otherwise. */
export const minContrast = (fontSize: number) => (fontSize >= 24 ? 3 : 4.5);

export function checkFrame(dom: DomMetrics, atMs: number, o: QaOptions): QaIssue[] {
  const issues: QaIssue[] = [];
  const minOpacity = o.minOpacity ?? 0.6;
  const visible = dom.elements.filter((e) => e.opacity >= minOpacity && area(e.rect) > 0);
  for (const e of visible) {
    if (e.overflow)
      issues.push({
        rule: "overflow",
        atMs,
        elements: [e.qa],
        detail: `"${e.text.slice(0, 60)}" exceeds its box`,
      });
    if (!insideSafeArea(e.rect, o.aspect, o.safeArea))
      issues.push({
        rule: "safe-area",
        atMs,
        elements: [e.qa],
        detail: `rect ${fmt(e.rect)} leaves the ${o.aspect} safe area`,
      });
    if (e.contrast !== null && e.contrast < minContrast(e.fontSize))
      issues.push({
        rule: "contrast",
        atMs,
        elements: [e.qa],
        detail: `contrast ${e.contrast.toFixed(2)} < ${minContrast(e.fontSize)} (${e.color} on ${e.background})`,
      });
  }
  const tol = o.overlapTolerance ?? 0.03;
  for (let i = 0; i < visible.length; i++)
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i]!;
      const b = visible[j]!;
      if (contains(a.rect, b.rect) || contains(b.rect, a.rect)) {
        if (a.qa === "caption" || b.qa === "caption") issues.push(overlap(a, b, atMs));
        continue; // nested blocks (e.g. a label inside a card) are layout, not collisions
      }
      const inter = intersection(a.rect, b.rect);
      if (inter > tol * Math.min(area(a.rect), area(b.rect))) issues.push(overlap(a, b, atMs));
    }
  if (dom.blockedRequests.length)
    issues.push({
      rule: "network",
      atMs,
      elements: [],
      detail: `external requests: ${dom.blockedRequests.join(", ")}`,
    });
  return issues;
}

const fmt = (r: Rect) =>
  `[${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
const overlap = (a: QaElement, b: QaElement, atMs: number): QaIssue => ({
  rule: "overlap",
  atMs,
  elements: [a.qa, b.qa],
  detail: `${a.qa} ${fmt(a.rect)} overlaps ${b.qa} ${fmt(b.rect)}`,
});
