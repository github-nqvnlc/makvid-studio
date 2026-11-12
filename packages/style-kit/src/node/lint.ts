// Style pack lint (contracts/style-pack.md "Quy tắc bắt buộc"). Script rules use the TypeScript AST,
// so comments and strings never cause false positives; HTML/CSS rules scan markup.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { ASPECTS, TEMPLATE_IDS } from "../template";
import { LAYOUT_FILE, TemplateSchema } from "./loader";

export interface LintIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
}

const FORBIDDEN_MEMBERS: Record<string, string[]> = {
  Math: ["random"],
  Date: ["now"],
  performance: ["now"],
};
const FORBIDDEN_CALLS = new Set(["setTimeout", "setInterval", "requestAnimationFrame", "setImmediate"]);

/** Lint TS/JS source text; returns issues with 1-based line numbers. */
export function lintScript(source: string, file: string): LintIssue[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const issues: LintIssue[] = [];
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n)) {
      const obj = n.expression.getText(sf).replace(/^(window|globalThis|self)\./, "");
      const prop = n.name.text;
      if (FORBIDDEN_MEMBERS[obj]?.includes(prop))
        issues.push({
          file,
          line: at(n),
          rule: "no-nondeterminism",
          message: `${obj}.${prop} is forbidden; use rng(seed) / timeline time`,
        });
      if (/^(window|globalThis|self)$/.test(n.expression.getText(sf)) && FORBIDDEN_CALLS.has(prop))
        issues.push({
          file,
          line: at(n),
          rule: "no-timers",
          message: `${prop} is forbidden; animate on the timeline`,
        });
    }
    if (ts.isElementAccessExpression(n) && ts.isStringLiteral(n.argumentExpression)) {
      const obj = n.expression.getText(sf);
      if (FORBIDDEN_MEMBERS[obj]?.includes(n.argumentExpression.text))
        issues.push({
          file,
          line: at(n),
          rule: "no-nondeterminism",
          message: `${obj}["${n.argumentExpression.text}"] is forbidden`,
        });
    }
    if (ts.isIdentifier(n) && FORBIDDEN_CALLS.has(n.text) && !ts.isPropertyAccessExpression(n.parent))
      issues.push({
        file,
        line: at(n),
        rule: "no-timers",
        message: `${n.text} is forbidden; animate on the timeline`,
      });
    if (ts.isNewExpression(n) && n.expression.getText(sf) === "Date" && !(n.arguments && n.arguments.length))
      issues.push({
        file,
        line: at(n),
        rule: "no-nondeterminism",
        message: "new Date() without arguments is forbidden",
      });
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /^\s*https?:\/\//i.test(n.text))
      issues.push({
        file,
        line: at(n),
        rule: "no-remote-url",
        message: "absolute http(s) URLs are forbidden; ship assets in the pack",
      });
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword)
      issues.push({ file, line: at(n), rule: "no-dynamic-import", message: "dynamic import() is forbidden" });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return issues;
}

/** Lint HTML/CSS text for remote resources and inline scripts. */
export function lintMarkup(source: string, file: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((l, i) => {
    const line = i + 1;
    if (/@import\s+(url\()?\s*["']?(https?:)?\/\//i.test(l))
      issues.push({ file, line, rule: "no-remote-import", message: "remote @import is forbidden" });
    else if (/https?:\/\//i.test(l) && !/xmlns(:\w+)?=["']http:\/\/www\.w3\.org\//.test(l))
      issues.push({ file, line, rule: "no-remote-url", message: "absolute http(s) URLs are forbidden" });
    if (/<script\b/i.test(l))
      issues.push({
        file,
        line,
        rule: "no-script-in-layout",
        message: "layouts must not contain <script>; use template.ts",
      });
    if (
      /\b(Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame)\b/.test(l) &&
      /on\w+=|style=/.test(l)
    )
      issues.push({ file, line, rule: "no-nondeterminism", message: "non-deterministic code in markup" });
  });
  return issues;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "golden" || name === "demo" || name === "node_modules") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Lint a whole pack folder: structure (8 templates × 4 layouts), slot schemas, scripts and markup. */
export function lintPack(dir: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const rel = (p: string) => relative(dir, p).replace(/\\/g, "/");
  for (const t of TEMPLATE_IDS) {
    const tdir = join(dir, "templates", t);
    if (!existsSync(tdir)) {
      issues.push({
        file: `templates/${t}`,
        line: 0,
        rule: "missing-template",
        message: `template ${t} is required`,
      });
      continue;
    }
    for (const a of ASPECTS)
      if (!existsSync(join(tdir, LAYOUT_FILE[a])))
        issues.push({
          file: `templates/${t}/${LAYOUT_FILE[a]}`,
          line: 0,
          rule: "missing-layout",
          message: `layout for ${a} is required`,
        });
    if (!existsSync(join(tdir, "template.ts")))
      issues.push({
        file: `templates/${t}/template.ts`,
        line: 0,
        rule: "missing-template",
        message: "template.ts is required",
      });
    const sfile = join(tdir, "schema.json");
    if (!existsSync(sfile)) {
      issues.push({ file: rel(sfile), line: 0, rule: "missing-schema", message: "schema.json is required" });
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(sfile, "utf8"));
    } catch (e) {
      issues.push({ file: rel(sfile), line: 0, rule: "invalid-schema", message: (e as Error).message });
      continue;
    }
    const slots =
      (raw as { slots?: Record<string, { type?: string; maxLength?: unknown; itemMaxLength?: unknown }> })
        ?.slots ?? {};
    for (const [name, s] of Object.entries(slots)) {
      if (s.type === "text" && typeof s.maxLength !== "number")
        issues.push({
          file: rel(sfile),
          line: 0,
          rule: "slot-max-length",
          message: `text slot "${name}" needs maxLength`,
        });
      if (s.type === "list" && typeof s.itemMaxLength !== "number")
        issues.push({
          file: rel(sfile),
          line: 0,
          rule: "slot-max-length",
          message: `list slot "${name}" needs itemMaxLength`,
        });
    }
    const parsed = TemplateSchema.safeParse(raw);
    if (!parsed.success)
      for (const i of parsed.error.issues)
        issues.push({
          file: rel(sfile),
          line: 0,
          rule: "invalid-schema",
          message: `${i.path.join(".")}: ${i.message}`,
        });
  }
  if (existsSync(dir))
    for (const f of walk(dir)) {
      if (/\.(ts|js|mjs)$/.test(f) && !/\.d\.ts$/.test(f))
        issues.push(...lintScript(readFileSync(f, "utf8"), rel(f)));
      else if (/\.(html|css)$/.test(f)) issues.push(...lintMarkup(readFileSync(f, "utf8"), rel(f)));
    }
  return issues;
}
