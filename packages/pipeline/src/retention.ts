// Retention (T166; FR-057): rendered files are kept for the plan's retention_days (render_outputs.expires_at,
// set when the render is stored). Expired files are deleted from object storage, then their rows.
import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { renderOutputs, withService, type Db } from "@makvid/db";
import type { ObjectStore } from "@makvid/storage";

export async function purgeExpiredOutputs(
  db: Db,
  store: ObjectStore,
  opts: { now?: Date; batch?: number } = {},
): Promise<{ outputs: number; files: number }> {
  const now = opts.now ?? new Date();
  let outputs = 0;
  let files = 0;
  for (;;) {
    const rows = await withService(db, (tx) =>
      tx
        .select()
        .from(renderOutputs)
        .where(and(isNotNull(renderOutputs.expiresAt), lt(renderOutputs.expiresAt, now)))
        .limit(opts.batch ?? 200),
    );
    if (!rows.length) break;
    for (const r of rows)
      for (const key of [r.storageKey, r.srtKey, r.thumbnailKey])
        if (key) {
          await store.delete(key).catch(() => undefined); // already gone is fine
          files++;
        }
    await withService(db, (tx) =>
      tx.delete(renderOutputs).where(
        inArray(
          renderOutputs.id,
          rows.map((r) => r.id),
        ),
      ),
    );
    outputs += rows.length;
    if (rows.length < (opts.batch ?? 200)) break;
  }
  return { outputs, files };
}
