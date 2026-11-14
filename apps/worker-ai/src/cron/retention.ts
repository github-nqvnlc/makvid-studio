// Hourly retention job (T166; FR-057): deletes rendered files whose plan retention has passed. Scheduled as a
// BullMQ job scheduler, so it runs once per hour whichever worker-ai replica picks it up.
import { Queue, Worker } from "bullmq";
import { connect } from "@makvid/db";
import { defaultWorkRoot, purgeExpiredOutputs, purgeProject, PURGE_JOB, type PurgeJobData } from "@makvid/pipeline";
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
      if (job.name === PURGE_JOB) {
        // Permanent project deletion (spec 002): files, work dir and rows of a tombstoned project.
        const d = job.data as PurgeJobData;
        const r = await purgeProject(db, store, defaultWorkRoot(), d.workspaceId, d.projectId);
        log.info({ ...r, projectId: d.projectId }, "project purged");
        return r;
      }
      if (job.name !== "retention") return;
      const r = await purgeExpiredOutputs(db, store);
      log.info(r, "retention run");
      return r;
    },
    { connection, prefix, concurrency: 1 },
  );
  worker.on("failed", (job, err) => log.error({ job: job?.name, attempt: job?.attemptsMade, err: err.message }, "maintenance job failed"));
  return async () => {
    await worker.close();
    await queue.close();
    await close();
  };
}
