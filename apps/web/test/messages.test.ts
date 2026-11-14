// Every message key must exist in both languages with the same ICU placeholders (spec FR-011, SC-005).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Tree = { [k: string]: string | Tree };
const load = (l: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../messages/${l}.json`), "utf8")) as Tree;

function flatten(t: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t))
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{\s*([a-zA-Z0-9_]+)/g)].map((m) => m[1]!).sort();

const vi = flatten(load("vi"));
const en = flatten(load("en"));

describe("messages", () => {
  it("has the same keys in vi and en", () => {
    expect(Object.keys(vi).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in vi))).toEqual([]);
  });
  it("has the same placeholders per key", () => {
    const bad = Object.keys(vi).filter(
      (k) => k in en && placeholders(vi[k]!).join() !== placeholders(en[k]!).join(),
    );
    expect(bad).toEqual([]);
  });
  it("has no empty values", () => {
    expect(Object.entries({ ...vi }).filter(([, v]) => !v.trim())).toEqual([]);
    expect(Object.entries({ ...en }).filter(([, v]) => !v.trim())).toEqual([]);
  });
});
