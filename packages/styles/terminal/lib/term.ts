// Shared helpers of the terminal pack: typing effect, syntax colours and the blinking block cursor.
import { explodeGraphemes, type TemplateContext } from "@makvid/style-kit";

/** Type the words of `sel` grapheme by grapheme from `at`; returns the end time. */
export function typeText(
  tl: TemplateContext["tl"],
  qa: TemplateContext["qa"],
  sel: string,
  at: number,
  perChar: number,
): number {
  const g = explodeGraphemes(qa(`${sel} .w`));
  g.forEach((el, i) => tl.set(el, { opacity: 0 }, 0).set(el, { opacity: 1 }, at + i * perChar));
  return at + g.length * perChar;
}

/** Syntax colours: numbers, quoted strings, shell / code keywords and emphasised words. */
const KEYWORDS = new Set([
  "npm",
  "pnpm",
  "git",
  "docker",
  "const",
  "let",
  "function",
  "return",
  "import",
  "export",
  "async",
  "await",
  "true",
  "false",
  "null",
  "if",
  "else",
  "for",
  "new",
  "api",
  "cli",
]);
export function highlightSyntax(qa: TemplateContext["qa"]): void {
  for (const w of qa<HTMLElement>(".w")) {
    const t = (w.textContent ?? "").trim();
    if (/^["“'].*["”']?$/.test(t)) w.classList.add("tok-str");
    else if (/^[+-]?\d/.test(t)) w.classList.add("tok-num");
    else if (/^[a-z]+$/i.test(t) && KEYWORDS.has(t.toLowerCase())) w.classList.add("tok-kw");
    else if (/[()]|\.[a-z]/i.test(t)) w.classList.add("tok-fn");
  }
}

/** Block cursor after the last line of `sel`, blinking deterministically until the scene ends. */
export function cursor(
  tl: TemplateContext["tl"],
  q: TemplateContext["q"],
  sel: string,
  from: number,
  duration: number,
): void {
  const lines = q(sel)?.querySelectorAll(".ln");
  const last = lines?.[lines.length - 1];
  if (!last) return;
  const c = last.ownerDocument.createElement("span");
  c.className = "cursor";
  last.appendChild(c);
  tl.set(c, { opacity: 0 }, 0);
  for (let t = from, on = true; t < duration - 0.1; t += 0.5, on = !on) tl.set(c, { opacity: on ? 1 : 0 }, t);
}
