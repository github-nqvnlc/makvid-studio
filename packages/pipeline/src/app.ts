// Entry point shared by apps/worker-{ai,audio,render}: provider context from env, and persistence
// (dbSink: project status, versions, outputs; batch rows) whenever a database is configured.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@makvid/db";
import { connectionFromUrl } from "@makvid/queue";
import { configFromEnv, createObjectStore } from "@makvid/storage";
import { withBatchHooks, type BatchGate } from "./batch";
import { billingGate, withQuotaHooks } from "./quota";
import type { ServiceDeps } from "./service";
import { dbSink } from "./sink";
import { contextFromEnv, startStageWorker } from "./worker";

export async function runWorkerApp(
  queue: "ai" | "audio" | "render",
  opts: { gate?: (deps: ServiceDeps) => BatchGate } = {},
): Promise<void> {
  const stylesRoot =
    process.env.MAKVID_STYLES_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "styles");
  const db = process.env.DATABASE_URL ? connect(process.env.DATABASE_URL, 4) : undefined;
  const store = db ? createObjectStore(configFromEnv()) : undefined;
  await store?.ensureBucket();
  const connection = connectionFromUrl();
  const prefix = process.env.QUEUE_PREFIX;
  const deps: ServiceDeps | undefined =
    db && store
      ? {
          db: db.db,
          connection,
          store,
          workRoot: process.env.WORK_ROOT ?? resolve(stylesRoot, "..", "..", ".work"),
          stylesRoot,
          ...(prefix ? { prefix } : {}),
          watermark: async (ws) => (await billingGate(db.db).watermark?.(ws)) ?? false,
        }
      : undefined;
  const worker = startStageWorker(queue, contextFromEnv(stylesRoot), {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
    ...(prefix ? { prefix } : {}),
    // Quota (settle) runs before the batch hook, so a finished row frees its quota before the next one starts.
    ...(deps
      ? {
          hooks: withBatchHooks(
            withQuotaHooks(dbSink(deps.db, deps.store), deps.db),
            deps,
            opts.gate?.(deps) ?? billingGate(deps.db),
          ),
        }
      : {}),
  });
  const stop = async () => {
    await worker.close();
    await db?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}
