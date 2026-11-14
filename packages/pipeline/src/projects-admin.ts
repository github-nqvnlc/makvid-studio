// Permanent project deletion (spec 002, US5). Two steps so a click is instant and a failure is retryable:
//   1. tombstoneProjects: mark deleted, detach the production run (stale worker steps stop with not_found) and
//      release reserved quota. The project vanishes from every list at once.
//   2. purgeProject (a `purge-project` job on the maintenance queue): remove every object, the work dir and the rows.
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, inArray, isNull, sql } from "drizzle-orm";
import { Queue, type ConnectionOptions } from "bullmq";
import { settle } from "@makvid/billing";
import { projects, withWorkspace, type Db } from "@makvid/db";
import { workspaceKey, type ObjectStore } from "@makvid/storage";
import { workDirOf, type ServiceDeps } from "./service";

/** Same default as the pipeline workers: <repo>/.work (WORK_ROOT overrides it). */
export const defaultWorkRoot = () =>
  process.env.WORK_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".work");

export const MAINTENANCE_QUEUE = "maintenance";
export const PURGE_JOB = "purge-project";
/** One retry later, in case the object store was briefly unavailable. */
export const PURGE_RETRY_MS = 15 * 60_000;

export interface PurgeJobData {
  workspaceId: string;
  projectId: string;
}

/** Hide the projects and stop their production. Returns the ids that were actually deleted by this call. */
export async function tombstoneProjects(deps: ServiceDeps, workspaceId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const done = await withWorkspace(deps.db, workspaceId, (tx) =>
    tx
      .update(projects)
      .set({ deletedAt: new Date(), runId: null, updatedAt: new Date() })
      .where(and(inArray(projects.id, ids), isNull(projects.deletedAt)))
      .returning({ id: projects.id }),
  );
  const deleted = done.map((d) => d.id);
  // A project may hold more than one reservation over its life; release until none is left.
  for (const projectId of deleted) {
    for (let i = 0; i < 5; i++) if (!(await settle(deps.db, workspaceId, { projectId }, false))) break;
  }
  return deleted;
}

/** Queue the purge of tombstoned projects: now, and once more after PURGE_RETRY_MS. */
export async function enqueuePurges(
  connection: ConnectionOptions,
  prefix: string | undefined,
  workspaceId: string,
  projectIds: string[],
): Promise<void> {
  if (!projectIds.length) return;
  const queue = new Queue(MAINTENANCE_QUEUE, { connection, ...(prefix ? { prefix } : {}) });
  try {
    for (const projectId of projectIds) {
      const data: PurgeJobData = { workspaceId, projectId };
      const opts = { removeOnComplete: true, removeOnFail: 100, attempts: 3, backoff: { type: "exponential" as const, delay: 30_000 } };
      await queue.add(PURGE_JOB, data, { ...opts, jobId: `purge-${projectId}` });
      await queue.add(PURGE_JOB, data, { ...opts, jobId: `purge-retry-${projectId}`, delay: PURGE_RETRY_MS });
    }
  } finally {
    await queue.close();
  }
}

/** Delete files, work dir and rows of a tombstoned project. Safe to run twice. */
export async function purgeProject(
  db: Db,
  store: ObjectStore,
  workRoot: string,
  workspaceId: string,
  projectId: string,
): Promise<{ objects: number; rows: number }> {
  // Only ever purge what was tombstoned: a live project is never touched by a stray job.
  const [row] = await withWorkspace(db, workspaceId, (tx) =>
    tx.execute<{ id: string; source_material_id: string | null }>(
      sql`SELECT id, source_material_id FROM projects WHERE id = ${projectId} AND deleted_at IS NOT NULL`,
    ),
  );
  if (!row) return { objects: 0, rows: 0 };
  const objects = await store.deletePrefix(`${workspaceKey(workspaceId, "projects", projectId)}/`);
  rmSync(workDirOf({ workRoot } as ServiceDeps, workspaceId, projectId), { recursive: true, force: true });
  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.execute(sql`DELETE FROM projects WHERE id = ${projectId} AND deleted_at IS NOT NULL`);
    // The source material is only ever referenced by its project (batch rows create their own).
    if (row.source_material_id)
      await tx.execute(
        sql`DELETE FROM source_materials WHERE id = ${row.source_material_id}
            AND NOT EXISTS (SELECT 1 FROM projects WHERE source_material_id = ${row.source_material_id})`,
      );
  });
  return { objects, rows: 1 };
}
