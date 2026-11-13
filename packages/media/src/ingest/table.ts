// CSV / JSON ingest (T115): parse, infer column types (Vietnamese and English number formats, dates), and build
// a chart-ready series whose values equal the file's numbers exactly. The series is applied to `stat` scenes
// after the storyboard, so the chart never shows invented numbers.
import { cleanText, type SeriesPoint, type SourceMaterial } from "./types";

/** RFC 4180 CSV (quotes, escaped quotes, CRLF); delimiter auto-detected among , ; and tab. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, ""); // UTF-8 BOM from Excel exports
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

type ColType = "number" | "date" | "text";

/** Parse a number written the Vietnamese way (1.234,5) or the English way (1,234.5); null if not a number. */
export function parseNumber(raw: string, decimalComma: boolean): number | null {
  let s = raw.trim().replace(/[\s\u00a0%₫$€]|đ$|VND$|USD$/gi, "");
  if (!s || !/^[+-]?[\d.,]+$/.test(s)) return null;
  if (decimalComma) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if ((s.match(/\./g) ?? []).length > 1) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A column uses decimal commas when some value ends in ",d" / ",dd" or is "1.234" style with no other dots. */
function usesDecimalComma(values: string[]): boolean {
  if (values.some((v) => /,\d{1,2}$/.test(v.trim()))) return true;
  if (values.some((v) => /\.\d{1,2}$/.test(v.trim()))) return false;
  return values.some((v) => /^\d{1,3}(\.\d{3})+$/.test(v.trim()));
}

function columnType(values: string[]): ColType {
  const vals = values.filter((v) => v.trim());
  if (!vals.length) return "text";
  const dc = usesDecimalComma(vals);
  if (vals.every((v) => parseNumber(v, dc) !== null) && !vals.every((v) => /^(19|20)\d\d$/.test(v.trim())))
    return "number";
  if (
    vals.every((v) =>
      /^(\d{4}([-/]\d{1,2}){0,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|Q[1-4][-/ ]?\d{4})$/i.test(v.trim()),
    )
  )
    return "date";
  return "text";
}

export interface Table {
  columns: string[];
  rows: string[][];
  types: ColType[];
}

export function tableFromCsv(text: string): Table {
  const all = parseCsv(text);
  if (all.length < 2) throw new Error("the table needs a header and at least one row");
  const columns = all[0]!.map((c) => c.trim().normalize("NFC"));
  const rows = all.slice(1).map((r) => columns.map((_, i) => (r[i] ?? "").trim().normalize("NFC")));
  return { columns, rows, types: columns.map((_, i) => columnType(rows.map((r) => r[i]!))) };
}

export function tableFromJson(text: string): Table {
  const data = JSON.parse(text) as unknown;
  const arr = Array.isArray(data) ? data : (Object.values(data as object).find(Array.isArray) as unknown[]);
  if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== "object")
    throw new Error("JSON must be an array of objects");
  const columns = [...new Set(arr.flatMap((o) => Object.keys(o as object)))];
  const rows = arr.map((o) => columns.map((c) => String((o as Record<string, unknown>)[c] ?? "")));
  return { columns, rows, types: columns.map((_, i) => columnType(rows.map((r) => r[i]!))) };
}

/** Label column = first non-number column; value column = first number column (or `valueColumn`). */
export function seriesOf(t: Table, valueColumn?: string, max = 10): { name: string; points: SeriesPoint[] } {
  const vi = valueColumn ? t.columns.indexOf(valueColumn) : t.types.indexOf("number");
  if (vi < 0 || t.types[vi] !== "number") throw new Error("the table has no numeric column");
  const li = Math.max(
    0,
    t.types.findIndex((ty, i) => i !== vi && ty !== "number"),
  );
  const dc = usesDecimalComma(t.rows.map((r) => r[vi]!));
  const points = t.rows
    .map((r) => ({ label: (li === vi ? "" : r[li]!) || "", value: parseNumber(r[vi]!, dc) }))
    .filter((p): p is SeriesPoint => p.value !== null);
  return { name: t.columns[vi]!, points: points.slice(-max) }; // the most recent points when longer
}

function asMarkdown(t: Table, maxRows = 40): string {
  const head = `| ${t.columns.join(" | ")} |\n| ${t.columns.map(() => "---").join(" | ")} |`;
  const body = t.rows
    .slice(0, maxRows)
    .map((r) => `| ${r.join(" | ")} |`)
    .join("\n");
  return `${head}\n${body}${t.rows.length > maxRows ? `\n(… ${t.rows.length - maxRows} dòng nữa)` : ""}`;
}

export function ingestTable(
  text: string,
  opts: { format?: "csv" | "json"; title?: string; valueColumn?: string } = {},
): SourceMaterial {
  const format = opts.format ?? (/^\s*[[{]/.test(text) ? "json" : "csv");
  const t = format === "json" ? tableFromJson(text) : tableFromCsv(text);
  const s = seriesOf(t, opts.valueColumn);
  const intro = opts.title ? `# ${opts.title.normalize("NFC")}\n\n` : "";
  return {
    kind: "table",
    markdown: cleanText(
      `${intro}Bảng dữ liệu (${t.rows.length} dòng, cột: ${t.columns.join(", ")}):\n\n${asMarkdown(t)}\n\n` +
        `Chuỗi số liệu chính "${s.name}": ${s.points.map((p) => `${p.label}: ${p.value}`).join("; ")}.\n` +
        `Chỉ dùng đúng các con số trong bảng, không làm tròn khác đi, không bịa số liệu.`,
    ),
    ...(opts.title ? { title: opts.title.normalize("NFC") } : {}),
    series: s.points,
    seriesName: s.name,
    metadata: { columns: t.columns, types: t.types, rows: t.rows.length },
  };
}
