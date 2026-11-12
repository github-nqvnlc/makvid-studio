// Entry point shared by apps/worker-{ai,audio,render}: provider context from env, and persistence
// (dbSink: project status, versions, outputs) whenever a database is configured.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@makvid/db";
import { configFromEnv, createObjectStore } from "@makvid/storage";
import { dbSink } from "./sink";
import { contextFromEnv, startStageWorker } from "./worker";

export async function runWorkerApp(queue: "ai" | "audio" | "render"): Promise<void> {
  const stylesRoot =
    process.env.MAKVID_STYLES_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "styles");
  const db = process.env.DATABASE_URL ? connect(process.env.DATABASE_URL, 4) : undefined;
  const store = db ? createObjectStore(configFromEnv()) : undefined;
  await store?.ensureBucket();
  const worker = startStageWorker(queue, contextFromEnv(stylesRoot), {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
    ...(process.env.QUEUE_PREFIX ? { prefix: process.env.QUEUE_PREFIX } : {}),
    ...(db && store ? { hooks: dbSink(db.db, store) } : {}),
  });
  const stop = async () => {
    await worker.close();
    await db?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}
