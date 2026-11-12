// worker-ai: runs the "ai" stages of the produce-video flow (BullMQ, ADR/plan).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contextFromEnv, startStageWorker } from "@makvid/pipeline";

const stylesRoot =
  process.env.MAKVID_STYLES_ROOT ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "styles");
const worker = startStageWorker("ai", contextFromEnv(stylesRoot), {
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
});
const stop = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
