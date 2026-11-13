// Template variables (US5, T126/T130): `{{name}}` placeholders in narration (script) and text slots, plus
// `{ var: "name" }` slot values. A template is a frozen VideoSpec with placeholders; a batch row fills them in.
// Narration words/timing are dropped on substitution: the voice is generated again for every row.
import type { SlotValue, VideoSpec } from "./schema";

export interface VariableDef {
  name: string;
  type: "text" | "number";
  required: boolean;
  maxLength: number;
}

/** Variable names: lowercase ASCII letters, digits and "_" (CSV headers are matched case-insensitively). */
export const VARIABLE_NAME = /^[a-z_][a-z0-9_]{0,39}$/;
const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
export const DEFAULT_MAX_LENGTH = 80;

/** Variable names used in a text, in order of first appearance. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!.toLowerCase()))];
}

export interface VariableUse {
  name: string;
  /** "script" (narration) or "slot" (on-screen text) */
  where: "script" | "slot";
  sceneIndex?: number;
  slot?: string;
  /** The text around the placeholder (its length counts toward the slot's limit). */
  text: string;
}

/** Every place a variable is used. */
export function variableUses(spec: VideoSpec): VariableUse[] {
  const uses: VariableUse[] = [];
  for (const p of spec.script)
    for (const name of placeholdersIn(p.text)) uses.push({ name, where: "script", text: p.text });
  spec.scenes.forEach((s, sceneIndex) => {
    for (const [slot, v] of Object.entries(s.slots)) {
      const texts = typeof v === "string" ? [v] : Array.isArray(v) ? v : [];
      for (const t of texts)
        for (const name of placeholdersIn(t)) uses.push({ name, where: "slot", sceneIndex, slot, text: t });
      if (v && typeof v === "object" && !Array.isArray(v) && "var" in v)
        uses.push({ name: v.var.toLowerCase(), where: "slot", sceneIndex, slot, text: `{{${v.var}}}` });
    }
  });
  return uses;
}

/**
 * Variables of a template. `slotLimit` gives a slot's maxLength (style-pack schema); a variable's own limit is
 * then the room left in the tightest slot it appears in. Declared `spec.variables` add the type.
 */
export function extractVariables(
  spec: VideoSpec,
  slotLimit?: (sceneIndex: number, slot: string) => number | undefined,
): VariableDef[] {
  const defs = new Map<string, VariableDef>();
  for (const u of variableUses(spec)) {
    const declared = spec.variables[u.name];
    const d = defs.get(u.name) ?? {
      name: u.name,
      type: declared?.type === "number" ? ("number" as const) : ("text" as const),
      required: true,
      maxLength: DEFAULT_MAX_LENGTH,
    };
    if (u.where === "slot" && slotLimit && u.sceneIndex !== undefined && u.slot) {
      const limit = slotLimit(u.sceneIndex, u.slot);
      if (limit !== undefined) {
        const fixed = [...u.text.replace(PLACEHOLDER, "")].length;
        const count = placeholdersIn(u.text).length || 1;
        d.maxLength = Math.max(1, Math.min(d.maxLength, Math.floor((limit - fixed) / count)));
      }
    }
    defs.set(u.name, d);
  }
  return [...defs.values()];
}

/** Replace every occurrence of `find` (exact, NFC) by `{{name}}` in narration and text slots ("save as template"). */
export function templatize(spec: VideoSpec, replacements: Array<{ find: string; name: string }>): VideoSpec {
  const out = structuredClone(spec);
  const sub = (t: string) =>
    replacements.reduce(
      (acc, r) => (r.find ? acc.split(r.find.normalize("NFC")).join(`{{${r.name}}}`) : acc),
      t,
    );
  for (const r of replacements)
    if (!VARIABLE_NAME.test(r.name)) throw new Error(`invalid variable name "${r.name}"`);
  out.script = out.script.map((p) => ({ ...p, text: sub(p.text) }));
  for (const s of out.scenes)
    for (const [k, v] of Object.entries(s.slots))
      if (typeof v === "string") s.slots[k] = sub(v);
      else if (Array.isArray(v)) s.slots[k] = v.map(sub);
  delete out.audio.narration;
  return out;
}

export interface RowIssue {
  row: number; // 1-based data row (header excluded)
  column: string;
  code: "required" | "too_long" | "not_a_number";
  maxLength?: number;
}

export interface TableCheck {
  /** Lowercased header -> column index. */
  columns: Map<string, number>;
  missingColumns: string[];
  extraColumns: string[];
  issues: RowIssue[];
  rows: Array<Record<string, string>>;
}

const MAX_ISSUES = 200;
/** 1234 · 1234,5 · 1.234.567 · 1,234.5 · 1 234 (Vietnamese and English writing). */
const NUMBER = /^-?(\d{1,3}([.,\s]\d{3})+|\d+)([.,]\d+)?$/;

/** Check a parsed table (first row = header) against a template's variables before anything runs. */
export function checkTable(table: string[][], vars: VariableDef[]): TableCheck {
  const [header = [], ...data] = table;
  const columns = new Map<string, number>();
  header.forEach((h, i) => {
    const k = h.normalize("NFC").trim().toLowerCase();
    if (k && !columns.has(k)) columns.set(k, i);
  });
  const names = new Set(vars.map((v) => v.name));
  const missingColumns = vars.filter((v) => v.required && !columns.has(v.name)).map((v) => v.name);
  const extraColumns = [...columns.keys()].filter((k) => !names.has(k));
  const issues: RowIssue[] = [];
  const rows = data.map((cells, r) => {
    const row: Record<string, string> = {};
    for (const v of vars) {
      const i = columns.get(v.name);
      const raw = (i === undefined ? "" : (cells[i] ?? "")).normalize("NFC").trim();
      const push = (code: RowIssue["code"]) =>
        issues.length < MAX_ISSUES &&
        issues.push({
          row: r + 1,
          column: v.name,
          code,
          ...(code === "too_long" ? { maxLength: v.maxLength } : {}),
        });
      if (!raw) {
        if (v.required && i !== undefined) push("required");
      } else if ([...raw].length > v.maxLength) push("too_long");
      else if (v.type === "number" && !NUMBER.test(raw)) push("not_a_number");
      row[v.name] = raw;
    }
    return row;
  });
  return { columns, missingColumns, extraColumns, issues, rows };
}

/** Fill a template's placeholders with one row's values. Throws on a missing required value. */
export function substituteVariables(spec: VideoSpec, values: Record<string, string>): VideoSpec {
  const val = (name: string) => {
    const v = values[name.toLowerCase()];
    if (v === undefined) throw new Error(`missing value for variable "${name}"`);
    return v.normalize("NFC");
  };
  const sub = (t: string) => t.replace(PLACEHOLDER, (_, n: string) => val(n));
  const out = structuredClone(spec);
  out.script = out.script.map((p) => ({ ...p, text: sub(p.text) }));
  for (const s of out.scenes)
    for (const [k, v] of Object.entries(s.slots) as Array<[string, SlotValue]>) {
      if (typeof v === "string") s.slots[k] = sub(v);
      else if (Array.isArray(v)) s.slots[k] = v.map(sub);
      else if (v && typeof v === "object" && "var" in v) {
        const raw = val(v.var);
        const declared = out.variables[v.var.toLowerCase()];
        const n = Number(raw.replace(/\s/g, "").replace(",", "."));
        s.slots[k] = declared?.type === "number" && Number.isFinite(n) ? n : raw;
      }
    }
  for (const [name, def] of Object.entries(out.variables))
    if (values[name] !== undefined) out.variables[name] = { ...def, value: values[name] };
  delete out.audio.narration;
  return out;
}
