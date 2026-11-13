// Entry point shared by apps/worker-{ai,audio,render}: provider context from env, and persistence
// (dbSink: project status, versions, outputs; batch rows) whenever a database is configured.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@makvid/db";
import { connectionFromUrl } from "@makvid/queue";
import { configFromEnv, createObjectStore } from "@makvid/storage";
import { withBatchHooks, type BatchGate } from "./batch";
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
        }
      : undefined;
  const worker = startStageWorker(queue, contextFromEnv(stylesRoot), {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
    ...(prefix ? { prefix } : {}),
    ...(deps ? { hooks: withBatchHooks(dbSink(deps.db, deps.store), deps, opts.gate?.(deps)) } : {}),
  });
  const stop = async () => {
    await worker.close();
    await db?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}
