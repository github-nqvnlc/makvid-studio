// Freeform scene linter (T077). Freeform HTML/CSS/JS written by the model must be deterministic, offline,
// sandboxed and use style tokens only. M2 storyboards use templates (freeform share 0% < 20% target);
// this gate is what any freeform scene must pass before it can be compiled.
import { lintMarkup, lintScript, type LintIssue } from "@makvid/style-kit/node";

const FORBIDDEN_APIS =
  /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|importScripts|eval|Function|Worker|localStorage|sessionStorage|indexedDB|document\.cookie)\b/;

export function lintFreeform(f: { html: string; css: string; js: string }): LintIssue[] {
  const issues: LintIssue[] = [
    ...lintMarkup(f.html, "freeform.html"),
    ...lintMarkup(f.css, "freeform.css"),
    ...lintScript(f.js, "freeform.js"),
  ];
  f.js.split(/\r?\n/).forEach((l, i) => {
    const m = FORBIDDEN_APIS.exec(l);
    if (m)
      issues.push({
        file: "freeform.js",
        line: i + 1,
        rule: "sandbox",
        message: `${m[1]} is not allowed in freeform scenes`,
      });
  });
  if (/<(iframe|object|embed|link|base|meta)\b/i.test(f.html))
    issues.push({
      file: "freeform.html",
      line: 0,
      rule: "sandbox",
      message: "embedded/linked documents are not allowed",
    });
  if (/\son\w+\s*=/i.test(f.html))
    issues.push({
      file: "freeform.html",
      line: 0,
      rule: "sandbox",
      message: "inline event handlers are not allowed",
    });
  f.css.split(/\r?\n/).forEach((l, i) => {
    if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(l))
      issues.push({
        file: "freeform.css",
        line: i + 1,
        rule: "style-tokens",
        message: "use style tokens (var(--c-*), var(--accent)) instead of raw colors",
      });
    if (/font-family\s*:(?![^;]*var\(--f-)/i.test(l))
      issues.push({
        file: "freeform.css",
        line: i + 1,
        rule: "style-tokens",
        message: "use font tokens (var(--f-*))",
      });
  });
  return issues;
}
