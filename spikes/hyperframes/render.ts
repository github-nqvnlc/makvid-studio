// M0 spike: render via the HyperFrames library API (not the CLI).
// Usage: tsx render.ts <projectDir> <out.mp4> [quality]
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { statSync } from "node:fs";
import os from "node:os";

const [, , projectDir, outPath, quality = "standard"] = process.argv;
if (!projectDir || !outPath) {
  console.error("usage: tsx render.ts <projectDir> <out.mp4> [quality]");
  process.exit(1);
}
const workers = process.env.WORKERS ? Number(process.env.WORKERS) : undefined;
const job = createRenderJob({ fps: 30, quality: quality as "draft" | "standard" | "high", ...(workers ? { workers } : {}) });
const t0 = performance.now();
let last = -1;
await executeRenderJob(job, projectDir, outPath, (j) => {
  const p = Math.floor(j.progress / 10) * 10;
  if (p !== last) {
    last = p;
    process.stdout.write(`${p}% `);
  }
});
const sec = (performance.now() - t0) / 1000;
const bytes = statSync(outPath).size;
console.log(
  `\n${JSON.stringify({ outPath, seconds: +sec.toFixed(2), framesPerSecond: +(300 / sec).toFixed(2), bytes, platform: os.platform(), cpus: os.cpus().length })}`,
);
