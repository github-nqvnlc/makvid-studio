// RFC 6902 JSON Patch (add, remove, replace, move, copy, test) + VideoSpec post-validation.
import { normalizeDeep } from "./text/nfc";
import { parseVideoSpec, type VideoSpec } from "./schema";

export type PatchOp =
  | { op: "add" | "replace" | "test"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move" | "copy"; from: string; path: string };

export class PatchError extends Error {
  constructor(
    message: string,
    readonly opIndex: number,
  ) {
    super(message);
    this.name = "PatchError";
  }
}

type Json = unknown;
type Container = Record<string, Json> | Json[];

/** RFC 6901 pointer -> tokens. */
export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`invalid JSON pointer "${pointer}"`);
  return pointer
    .slice(1)
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}

const clone = <T>(v: T): T => structuredClone(v);
const isContainer = (v: Json): v is Container => v !== null && typeof v === "object";

function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (!isContainer(a) || !isContainer(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => deepEqual((a as Record<string, Json>)[k], (b as Record<string, Json>)[k]))
  );
}

function arrayIndex(arr: Json[], token: string, forAdd: boolean): number {
  if (forAdd && token === "-") return arr.length;
  if (!/^(0|[1-9]\d*)$/.test(token)) throw new Error(`invalid array index "${token}"`);
  const i = Number(token);
  if (i > arr.length || (!forAdd && i === arr.length)) throw new Error(`array index ${i} out of range`);
  return i;
}

function child(cur: Json, token: string): Json {
  if (!isContainer(cur)) throw new Error(`path not found at "${token}"`);
  const next = Array.isArray(cur) ? cur[arrayIndex(cur, token, false)] : (cur as Record<string, Json>)[token];
  if (next === undefined) throw new Error(`path not found at "${token}"`);
  return next;
}

function resolveParent(doc: Json, tokens: string[]): { parent: Container; key: string } {
  let cur = doc;
  for (const t of tokens.slice(0, -1)) cur = child(cur, t);
  if (!isContainer(cur)) throw new Error("parent is not a container");
  return { parent: cur, key: tokens[tokens.length - 1] ?? "" };
}

function get(doc: Json, pointer: string): Json {
  let cur = doc;
  for (const t of parsePointer(pointer)) cur = child(cur, t);
  return cur;
}

function add(doc: Json, pointer: string, value: Json): Json {
  const tokens = parsePointer(pointer);
  if (!tokens.length) return value;
  const { parent, key } = resolveParent(doc, tokens);
  if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, true), 0, value);
  else parent[key] = value;
  return doc;
}

function remove(doc: Json, pointer: string): Json {
  const tokens = parsePointer(pointer);
  if (!tokens.length) throw new Error("cannot remove the document root");
  const { parent, key } = resolveParent(doc, tokens);
  if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, false), 1);
  else {
    if (!(key in parent)) throw new Error(`path "${pointer}" not found`);
    delete parent[key];
  }
  return doc;
}

function replace(doc: Json, pointer: string, value: Json): Json {
  const tokens = parsePointer(pointer);
  if (!tokens.length) return value;
  get(doc, pointer); // must exist
  const { parent, key } = resolveParent(doc, tokens);
  if (Array.isArray(parent)) parent[arrayIndex(parent, key, false)] = value;
  else parent[key] = value;
  return doc;
}

/** Apply a JSON Patch to a deep copy of `doc`. Throws PatchError; the input is never mutated. */
export function applyJsonPatch<T>(doc: T, ops: PatchOp[]): T {
  let out: Json = clone(doc);
  ops.forEach((op, i) => {
    try {
      switch (op.op) {
        case "add":
          out = add(out, op.path, clone(op.value));
          break;
        case "remove":
          out = remove(out, op.path);
          break;
        case "replace":
          out = replace(out, op.path, clone(op.value));
          break;
        case "move": {
          if (op.path.startsWith(op.from + "/")) throw new Error("cannot move a value into its own child");
          const v = get(out, op.from);
          out = add(remove(out, op.from), op.path, v);
          break;
        }
        case "copy":
          out = add(out, op.path, clone(get(out, op.from)));
          break;
        case "test":
          if (!deepEqual(get(out, op.path), op.value)) throw new Error(`test failed at "${op.path}"`);
          break;
        default:
          throw new Error(`unknown op ${(op as { op: string }).op}`);
      }
    } catch (e) {
      throw new PatchError(`op ${i} (${op.op} ${op.path}): ${(e as Error).message}`, i);
    }
  });
  return out as T;
}

export type ApplyResult =
  { ok: true; spec: VideoSpec; affectedScenes: string[] } | { ok: false; issues: string[] };

/** Apply a patch to a VideoSpec, NFC-normalize, re-validate. A failed patch never yields a spec. */
export function applySpecPatch(spec: VideoSpec, ops: PatchOp[]): ApplyResult {
  let next: unknown;
  try {
    next = normalizeDeep(applyJsonPatch(spec, normalizeDeep(ops)));
  } catch (e) {
    return { ok: false, issues: [(e as Error).message] };
  }
  const parsed = parseVideoSpec(next);
  if (!parsed.ok) return parsed;
  return { ok: true, spec: parsed.spec, affectedScenes: affectedScenes(spec, parsed.spec, ops) };
}

/** Fields of meta that only affect the final mux, not any scene's frames. */
const MUX_ONLY_META = new Set(["music", "watermark"]);

/**
 * Scene ids that must be re-rendered after `ops` (contracts/videospec.md):
 * touched scenes; neighbours when transitionIn/timing change or a scene is inserted/removed;
 * all scenes when voice, script or other global settings change (audio must be redone).
 */
export function affectedScenes(before: VideoSpec, after: VideoSpec, ops: PatchOp[]): string[] {
  const all = after.scenes.map((s) => s.id);
  const out = new Set<string>();
  const addAround = (i: number) => {
    for (const n of [i - 1, i, i + 1]) {
      const id = after.scenes[n]?.id;
      if (id) out.add(id);
    }
  };
  const pointers = ops.flatMap((op) =>
    "from" in op
      ? [
          { p: op.from, removed: op.op === "move" },
          { p: op.path, removed: false },
        ]
      : [{ p: op.path, removed: op.op === "remove" }],
  );
  for (const { p, removed } of pointers) {
    const t = parsePointer(p);
    const [root, idx, field] = t;
    if (
      root === undefined ||
      root === "script" ||
      root === "audio" ||
      root === "captions" ||
      root === "variables"
    )
      return all;
    if (root === "meta") {
      if (t[1] !== undefined && MUX_ONLY_META.has(t[1])) continue;
      return all;
    }
    if (root !== "scenes") return all;
    if (idx === undefined) return all;
    if (idx === "-") {
      addAround(after.scenes.length - 1);
      continue;
    }
    const i = Number(idx);
    if (t.length === 2) {
      // whole scene removed: the scenes now on both sides of the gap change
      if (removed) {
        for (const n of [i - 1, i]) {
          const id = after.scenes[n]?.id;
          if (id) out.add(id);
        }
        continue;
      }
      // whole scene added / replaced: it and its neighbours change
      addAround(i);
      continue;
    }
    const id = after.scenes[i]?.id;
    if (id) out.add(id);
    if (field === "transitionIn" || field === "timing") addAround(i);
  }
  return all.filter((id) => out.has(id));
}

/** Resolve a scene id to its current array index (patches are authored by id, applied by index). */
export function sceneIndex(spec: VideoSpec, sceneId: string): number {
  const i = spec.scenes.findIndex((s) => s.id === sceneId);
  if (i < 0) throw new Error(`scene "${sceneId}" not found`);
  return i;
}
