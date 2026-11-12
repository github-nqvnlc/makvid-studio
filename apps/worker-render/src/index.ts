// worker-render: runs the "render" stages of the produce-video flow (BullMQ) and persists results (dbSink).
import { runWorkerApp } from "@makvid/pipeline";

await runWorkerApp("render");
