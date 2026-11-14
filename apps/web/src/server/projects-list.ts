// Filtered, sorted, paginated project list and the shared filter -> SQL mapping (also used by "delete all matching").
// Search is accent- and case-insensitive through mkv_fold() (migration 0007).
import "server-only";
import { and, asc, desc, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { projects, users, withWorkspace, type Db } from "@makvid/db";
import type { ObjectStore } from "@makvid/storage";
import {
  expandStatuses,
  groupOf,
  STATUS_GROUPS,
  type ProjectFilter,
  type ProjectListQuery,
} from "@/lib/project-query";

type ProjectStatusValue = (typeof projects.$inferSelect)["status"];

function dayRange(col: SQL, preset: string | undefined, from: string | undefined, to: string | undefined, tz: string): SQL[] {
  const out: SQL[] = [];
  const startOfToday = sql`(date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;
  if (preset === "today") out.push(sql`${col} >= ${startOfToday}`);
  else if (preset === "7d") out.push(sql`${col} >= ${startOfToday} - interval '6 days'`);
  else if (preset === "30d") out.push(sql`${col} >= ${startOfToday} - interval '29 days'`);
  else if (preset === "custom") {
    if (from) out.push(sql`${col} >= (${from}::date::timestamp AT TIME ZONE ${tz})`);
    // Inclusive last day: strictly before the next local midnight.
    if (to) out.push(sql`${col} < ((${to}::date + 1)::timestamp AT TIME ZONE ${tz})`);
  }
  return out;
}

/** WHERE conditions for a filter. Always excludes tombstoned projects. */
export function filterConditions(f: ProjectFilter): SQL[] {
  const c: SQL[] = [isNull(projects.deletedAt)];
  if (f.q) {
    // Escape LIKE wildcards in the folded search text, then match the folded title.
    c.push(
      sql`mkv_fold(${projects.title}) LIKE '%' || replace(replace(replace(mkv_fold(${f.q}), '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' ESCAPE '\\'`,
    );
  }
  if (f.status?.length) {
    const s = expandStatuses(f.status) as ProjectStatusValue[];
    c.push(s.length ? inArray(projects.status, s) : sql`false`);
  }
  if (f.aspect?.length) c.push(inArray(projects.primaryAspect, f.aspect));
  if (f.mode) c.push(sql`${projects.mode} = ${f.mode}`);
  if (f.source?.length)
    c.push(
      sql`${projects.sourceMaterialId} IN (SELECT id FROM source_materials WHERE kind IN (${sql.join(
        f.source.map((s) => sql`${s}`),
        sql`, `,
      )}))`,
    );
  if (f.createdBy) c.push(sql`${projects.createdBy} = ${f.createdBy}`);
  c.push(...dayRange(sql`${projects.createdAt}`, f.created, f.createdFrom, f.createdTo, f.tz));
  c.push(...dayRange(sql`${projects.updatedAt}`, f.updated, f.updatedFrom, f.updatedTo, f.tz));
  return c;
}

export interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  statusGroup: string;
  aspect: string;
  mode: string;
  source: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  progress: { messageKey: string | null; params: Record<string, unknown> | null; fraction: number } | null;
}

export interface ProjectListResult {
  projects: ProjectListItem[];
  page: number;
  pageSize: number;
  total: number;
}

const PROCESSING = STATUS_GROUPS.processing as readonly string[];

export async function listProjects(
  db: Db,
  store: ObjectStore,
  workspaceId: string,
  q: ProjectListQuery,
): Promise<ProjectListResult> {
  const dir = q.dir ?? (q.sort === "title" ? "asc" : "desc");
  const order = dir === "asc" ? asc : desc;
  const sortCol =
    q.sort === "title" ? sql`mkv_fold(${projects.title})` : q.sort === "created" ? projects.createdAt : projects.updatedAt;
  const rows = await withWorkspace(db, workspaceId, (tx) =>
    tx
      .select({
        id: projects.id,
        title: projects.title,
        status: projects.status,
        aspect: projects.primaryAspect,
        mode: projects.mode,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        total: sql<number>`count(*) over ()`.mapWith(Number),
        source: sql<string | null>`(SELECT kind::text FROM source_materials s WHERE s.id = ${projects.sourceMaterialId})`,
        thumbnailKey: sql<string | null>`(SELECT ro.thumbnail_key FROM render_outputs ro WHERE ro.project_id = ${projects.id} AND ro.thumbnail_key IS NOT NULL ORDER BY ro.created_at DESC LIMIT 1)`,
        progress: sql<{ messageKey: string | null; fraction: number; params: Record<string, unknown> | null } | null>`CASE WHEN ${projects.status}::text IN (${sql.join(
          PROCESSING.map((s) => sql`${s}`),
          sql`, `,
        )}) THEN (SELECT json_build_object('messageKey', j.user_message_key, 'fraction', j.progress, 'params', j.output->'params') FROM jobs j WHERE j.project_id = ${projects.id} ORDER BY j.created_at DESC LIMIT 1) ELSE NULL END`,
      })
      .from(projects)
      .where(and(...filterConditions(q)))
      .orderBy(order(sortCol), order(projects.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
  );

  // A page past the end still reports the real total (one extra count).
  let total = rows[0]?.total ?? 0;
  if (!rows.length && q.page > 1) {
    const [c] = await withWorkspace(db, workspaceId, (tx) =>
      tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(projects).where(and(...filterConditions(q))),
    );
    total = c?.n ?? 0;
  }

  const creatorIds = [...new Set(rows.flatMap((r) => (r.createdBy ? [r.createdBy] : [])))];
  const names = creatorIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds))
    : [];

  const items = await Promise.all(
    rows.map(
      async (r): Promise<ProjectListItem> => ({
        id: r.id,
        title: r.title,
        status: r.status,
        statusGroup: groupOf(r.status),
        aspect: r.aspect,
        mode: r.mode,
        source: r.source,
        createdBy: r.createdBy ? { id: r.createdBy, name: names.find((n) => n.id === r.createdBy)?.name ?? "" } : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        thumbnailUrl: r.thumbnailKey ? await store.signedGetUrl(r.thumbnailKey, 300).catch(() => null) : null,
        progress: r.progress,
      }),
    ),
  );
  return { projects: items, page: q.page, pageSize: q.pageSize, total };
}

/** Ids matching a filter, in chunks (for "delete everything that matches"). */
export async function matchingIds(db: Db, workspaceId: string, f: ProjectFilter, limit: number): Promise<string[]> {
  const rows = await withWorkspace(db, workspaceId, (tx) =>
    tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(...filterConditions(f)))
      .orderBy(asc(projects.id))
      .limit(limit),
  );
  return rows.map((r) => r.id);
}
