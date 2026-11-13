// Hourly retention job (T166; FR-057): deletes rendered files whose plan retention has passed. Scheduled as a
// BullMQ job scheduler, so it runs once per hour whichever worker-ai replica picks it up.
import { Queue, Worker } from "bullmq";
import { connect } from "@makvid/db";
import { purgeExpiredOutputs } from "@makvid/pipeline";
import { connectionFromUrl, createLogger } from "@makvid/queue";
import { configFromEnv, createObjectStore } from "@makvid/storage";

const QUEUE = "maintenance";

export async function startRetention(): Promise<() => Promise<void>> {
  if (!process.env.DATABASE_URL) return async () => undefined;
  const log = createLogger("retention");
  const connection = connectionFromUrl();
  const prefix = process.env.QUEUE_PREFIX || "mkv";
  const { db, close } = connect(process.env.DATABASE_URL, 2);
  const store = createObjectStore(configFromEnv());
  const queue = new Queue(QUEUE, { connection, prefix });
  await queue.upsertJobScheduler("retention-hourly", { every: 3600_000 }, { name: "retention" });
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name !== "retention") return;
      const r = await purgeExpiredOutputs(db, store);
      log.info(r, "retention run");
      return r;
    },
    { connection, prefix, concurrency: 1 },
  );
  return async () => {
    await worker.close();
    await queue.close();
    await close();
  };
}
