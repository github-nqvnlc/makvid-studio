// Filter/sort/page shape shared by the projects list UI and GET/POST /api/projects (contracts/internal-api.md).
import { z } from "zod";

export const STATUS_GROUPS = {
  processing: ["ingesting", "scripting", "styling", "storyboarding", "producing_audio", "compiling", "qa", "rendering"],
  review: ["awaiting_script_review", "awaiting_storyboard_review"],
  ready: ["ready"],
  attention: ["needs_attention"],
  failed: ["failed"],
  draft: ["draft"],
} as const;
export type StatusGroup = keyof typeof STATUS_GROUPS;
export const STATUS_GROUP_KEYS = Object.keys(STATUS_GROUPS) as StatusGroup[];

const ALL_STATUSES = Object.values(STATUS_GROUPS).flat() as string[];
export const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;
export const SOURCES = ["prompt", "script", "url", "github", "table", "media"] as const;
export const PAGE_SIZES = [12, 24, 48, 96] as const;
export const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

/** Group names and raw statuses may be mixed; the result is the set of raw statuses. */
export function expandStatuses(values: string[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (v in STATUS_GROUPS) for (const s of STATUS_GROUPS[v as StatusGroup]) out.add(s);
    else if (ALL_STATUSES.includes(v)) out.add(v);
  }
  return [...out];
}

/** Status group of a raw status (used by the UI for badges and counts). */
export function groupOf(status: string): StatusGroup {
  for (const g of STATUS_GROUP_KEYS) if ((STATUS_GROUPS[g] as readonly string[]).includes(status)) return g;
  return "draft";
}

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(values)).max(values.length).optional());

const statusCsv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined))
  .pipe(
    z
      .array(z.string().refine((v) => v in STATUS_GROUPS || ALL_STATUSES.includes(v)))
      .max(30)
      .optional(),
  );

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const preset = z.enum(["today", "7d", "30d", "custom"]);
const tz = z
  .string()
  .max(64)
  .refine((t) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: t });
      return true;
    } catch {
      return false;
    }
  });

/** Everything that selects projects (also the body of "delete everything matching"). */
export const FilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: statusCsv,
  aspect: csv(ASPECTS),
  source: csv(SOURCES),
  mode: z.enum(["auto", "review"]).optional(),
  createdBy: z.string().uuid().optional(),
  created: preset.optional(),
  updated: preset.optional(),
  createdFrom: day.optional(),
  createdTo: day.optional(),
  updatedFrom: day.optional(),
  updatedTo: day.optional(),
  tz: tz.default(DEFAULT_TZ),
});
export type ProjectFilter = z.infer<typeof FilterSchema>;

export const ListSchema = FilterSchema.extend({
  sort: z.enum(["updated", "created", "title"]).default("updated"),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type ProjectListQuery = z.infer<typeof ListSchema>;

export function parseListQuery(p: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [k, v] of p.entries()) if (v !== "") raw[k] = v;
  return ListSchema.safeParse(raw);
}

/** Query-string form of the filter state (UI keeps filters in the URL). Defaults are omitted. */
export interface UiFilters {
  q?: string;
  status?: string[];
  aspect?: string[];
  source?: string[];
  mode?: string;
  createdBy?: string;
  created?: string;
  updated?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

const LISTS = ["status", "aspect", "source"] as const;
const SCALARS = ["q", "mode", "createdBy", "created", "updated", "createdFrom", "createdTo", "updatedFrom", "updatedTo", "sort", "dir"] as const;

export function toSearchParams(f: UiFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of LISTS) if (f[k]?.length) p.set(k, f[k]!.join(","));
  for (const k of SCALARS) if (f[k]) p.set(k, f[k]!);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  if (f.pageSize && f.pageSize !== 24) p.set("pageSize", String(f.pageSize));
  return p;
}

export function fromSearchParams(p: URLSearchParams): UiFilters {
  const f: UiFilters = {};
  for (const k of LISTS) {
    const v = p.get(k);
    if (v) f[k] = v.split(",").filter(Boolean);
  }
  for (const k of SCALARS) {
    const v = p.get(k);
    if (v) f[k] = v;
  }
  const page = Number(p.get("page"));
  if (page > 1) f.page = page;
  const size = Number(p.get("pageSize"));
  if (size) f.pageSize = size;
  return f;
}

/** Number of active filters (not counting search, sort and paging). */
export function activeFilterCount(f: UiFilters): number {
  let n = 0;
  for (const k of LISTS) if (f[k]?.length) n++;
  for (const k of ["mode", "createdBy", "created", "updated"] as const) if (f[k]) n++;
  return n;
}
