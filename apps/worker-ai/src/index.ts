// worker-ai: runs the "ai" stages of the produce-video flow (BullMQ), the webhook deliveries, and the hourly
// retention job (deletes rendered files past their plan's retention).
import { runWorkerApp } from "@makvid/pipeline";
import { startRetention } from "./cron/retention";

await runWorkerApp("ai");
const stopRetention = await startRetention();
process.on("SIGTERM", () => void stopRetention());
