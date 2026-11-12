// Tiny layout template language used by style-pack layout.<aspect>.html files.
//
//   {{fit PATH w=1500 h=400 max=120 min=64 lh=1.15 font=display lines=3 group=items balance=false}}
//   {{text PATH}}            escaped text
//   {{num PATH decimals=1}}  Vietnamese number format (21,6)
//   {{attr PATH}}            escaped attribute value
//   {{#each PATH}} ... {{item}} {{item.label}} {{@index}} {{@num}} {{@count}} ... {{/each}}
//   {{#if PATH}} ... {{else}} ... {{/if}}
//
// `fit` measures text with the pack's real font metrics at compile time and emits explicit lines,
// so line breaks are identical in every render (never mid-word, see style-kit fitText).
import { fitText, formatNumberVi, splitWords, type FitResult, type Measure } from "@makvid/style-kit";

export type Scope = Record<string, unknown>;

type Node =
  | { kind: "text"; value: string }
  | { kind: "tag"; name: string; path: string; args: Record<string, string> }
  | { kind: "each"; path: string; body: Node[] }
  | { kind: "if"; path: string; then: Node[]; else: Node[] };

export interface FitRequest {
  text: string;
  w: number;
  h: number;
  max: number;
  min: number;
  lh: number;
  font: string;
  lines?: number;
  balance: boolean;
  group?: string;
  features: string[];
}

export interface FitIssue {
  path: string;
  text: string;
  fontSize: number;
  overflow: boolean;
}

export interface RenderEnv {
  /** Returns a width measure for a token font role (e.g. "display"). */
  measureFor(font: string, features?: string[]): Measure;
  /** Phrases (as word-key sequences) whose words get class "em": highlight slot + emphasis words. */
  emphasis: string[][];
  fits: FitIssue[];
}

const TOKEN = /\{\{\s*([#/]?)(\w+|@\w+)([^}]*)\}\}/g;

export function parseLayout(src: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ node: Node & { kind: "each" | "if" }; inElse: boolean; list: Node[] }> = [];
  const target = () => (stack.length ? stack[stack.length - 1]!.list : root);
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const [whole, sigil, name, rest] = m as unknown as [string, string, string, string];
    if (m.index! > last) target().push({ kind: "text", value: src.slice(last, m.index) });
    last = m.index! + whole.length;
    const parts = rest.trim().split(/\s+/).filter(Boolean);
    if (sigil === "#") {
      const path = parts[0] ?? "";
      const node: Node & { kind: "each" | "if" } =
        name === "each" ? { kind: "each", path, body: [] } : { kind: "if", path, then: [], else: [] };
      if (name !== "each" && name !== "if") throw new Error(`unknown block {{#${name}}}`);
      target().push(node);
      stack.push({ node, inElse: false, list: node.kind === "each" ? node.body : node.then });
    } else if (sigil === "/") {
      const top = stack.pop();
      if (!top || top.node.kind !== name) throw new Error(`unexpected {{/${name}}}`);
    } else if (name === "else") {
      const top = stack[stack.length - 1];
      if (!top || top.node.kind !== "if") throw new Error("{{else}} outside {{#if}}");
      top.inElse = true;
      top.list = top.node.else;
    } else if (name.startsWith("@") || name === "item") {
      target().push({ kind: "tag", name: "text", path: name + (rest.trim() ? rest.trim() : ""), args: {} });
    } else {
      const [path = "", ...kv] = parts;
      const args: Record<string, string> = {};
      for (const p of kv) {
        const [k, v = "true"] = p.split("=");
        if (k) args[k] = v;
      }
      target().push({ kind: "tag", name, path, args });
    }
  }
  if (stack.length) throw new Error(`unclosed {{#${stack[stack.length - 1]!.node.kind}}}`);
  if (last < src.length) root.push({ kind: "text", value: src.slice(last) });
  return root;
}

export function lookup(scope: Scope, path: string): unknown {
  let cur: unknown = scope;
  for (const key of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truthy = (v: unknown) =>
  !(v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && !v.length));

function fitRequest(text: string, args: Record<string, string>): FitRequest {
  const num = (k: string, d?: number) => {
    const v = args[k];
    if (v === undefined) {
      if (d === undefined) throw new Error(`{{fit}} needs ${k}=`);
      return d;
    }
    return Number(v);
  };
  const req: FitRequest = {
    text,
    w: num("w"),
    h: num("h"),
    max: num("max"),
    min: num("min"),
    lh: num("lh", 1.15),
    font: args.font ?? "body",
    balance: args.balance !== "false",
    features: args.features ? args.features.split(",") : [],
  };
  if (args.lines) req.lines = Number(args.lines);
  if (args.group) req.group = args.group;
  return req;
}

export const wordKey = (w: string) =>
  w
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:"“”()…]/g, "");

/** Indexes of words to emphasize: every occurrence of each emphasis phrase (matched as a word sequence). */
export function emphasisIndexes(words: string[], phrases: string[][]): Set<number> {
  const keys = words.map(wordKey);
  const hit = new Set<number>();
  for (const p of phrases) {
    if (!p.length) continue;
    for (let i = 0; i + p.length <= keys.length; i++)
      if (p.every((w, j) => keys[i + j] === w)) for (let j = 0; j < p.length; j++) hit.add(i + j);
  }
  return hit;
}

/** Emit fitted lines; each word is a span (class "w", plus "em" for emphasized phrases). */
export function fittedHtml(
  r: FitResult,
  lh: number,
  env: RenderEnv,
  maxWidth: number,
  wordClass = "w",
): string {
  const em = emphasisIndexes(
    r.lines.flatMap((l) => splitWords(l)),
    env.emphasis,
  );
  let k = 0;
  const lines = r.lines.map(
    (l) =>
      `<span class="ln">${splitWords(l)
        .map((w) => `<span class="${wordClass}${em.has(k++) ? " em" : ""}">${escapeHtml(w)}</span>`)
        .join(" ")}</span>`,
  );
  return `<span class="fit" data-w="${Math.round(maxWidth)}" style="font-size:${r.fontSize}px;line-height:${lh}">${lines.join("")}</span>`;
}

/** Render a parsed layout. Group fits (same `group=`) share the smallest fitting size. */
export function renderLayout(nodes: Node[], scope: Scope, env: RenderEnv): string {
  // Pass 1: collect group sizes.
  const groupSizes = new Map<string, number>();
  const collect = (ns: Node[], sc: Scope) => {
    for (const n of ns) {
      if (n.kind === "tag" && n.name === "fit" && n.args.group) {
        const v = lookup(sc, n.path);
        if (typeof v === "string" && v) {
          const q = fitRequest(v, n.args);
          const r = fitText(v, {
            maxWidth: q.w,
            maxHeight: q.h,
            maxFontSize: q.max,
            minFontSize: q.min,
            lineHeight: q.lh,
            ...(q.lines ? { maxLines: q.lines } : {}),
            balance: q.balance,
            measure: env.measureFor(q.font, q.features),
          });
          groupSizes.set(n.args.group, Math.min(groupSizes.get(n.args.group) ?? Infinity, r.fontSize));
        }
      } else if (n.kind === "each") {
        const list = lookup(sc, n.path);
        if (Array.isArray(list))
          list.forEach((item, i) =>
            collect(n.body, { ...sc, item, "@index": i, "@num": i + 1, "@count": list.length }),
          );
      } else if (n.kind === "if") collect(truthy(lookup(sc, n.path)) ? n.then : n.else, sc);
    }
  };
  collect(nodes, scope);

  const render = (ns: Node[], sc: Scope): string =>
    ns
      .map((n) => {
        switch (n.kind) {
          case "text":
            return n.value;
          case "each": {
            const list = lookup(sc, n.path);
            if (!Array.isArray(list)) return "";
            return list
              .map((item, i) =>
                render(n.body, { ...sc, item, "@index": i, "@num": i + 1, "@count": list.length }),
              )
              .join("");
          }
          case "if":
            return render(truthy(lookup(sc, n.path)) ? n.then : n.else, sc);
          case "tag": {
            const v = lookup(sc, n.path);
            if (n.name === "text" || n.name === "attr")
              return v === undefined || v === null ? "" : escapeHtml(String(v));
            if (n.name === "num") {
              if (typeof v !== "number") return "";
              return escapeHtml(
                formatNumberVi(v, n.args.decimals !== undefined ? Number(n.args.decimals) : undefined),
              );
            }
            if (n.name === "fit") {
              if (v === undefined || v === null || v === "") return "";
              const text = String(v);
              const q = fitRequest(text, n.args);
              const max = q.group ? Math.min(q.max, groupSizes.get(q.group) ?? q.max) : q.max;
              const r = fitText(text, {
                maxWidth: q.w,
                maxHeight: q.h,
                maxFontSize: max,
                minFontSize: Math.min(q.min, max),
                lineHeight: q.lh,
                ...(q.lines ? { maxLines: q.lines } : {}),
                balance: q.balance,
                measure: env.measureFor(q.font, q.features),
              });
              env.fits.push({ path: n.path, text, fontSize: r.fontSize, overflow: r.overflow });
              return fittedHtml(r, q.lh, env, q.w);
            }
            throw new Error(`unknown tag {{${n.name}}}`);
          }
        }
      })
      .join("");
  return render(nodes, scope);
}
