// M0 spike T003: distributed render (planV2 -> renderChunkV2 x N -> assembleV2) vs single pass.
// Usage: tsx chunked.ts <projectDir> <outDir> <width> <height>
import { planV2, renderChunkV2, assembleV2, createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [, , projectDirArg, outDirArg, wArg, hArg] = process.argv;
if (!projectDirArg || !outDirArg || !wArg || !hArg) throw new Error("usage: tsx chunked.ts <projectDir> <outDir> <w> <h>");
const projectDir = resolve(projectDirArg);
const outDir = resolve(outDirArg);
const planDir = join(outDir, "plan-v2");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "chunks"), { recursive: true });

const fm = (mp4: string, stream: "v" | "a") =>
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", mp4, "-map", `0:${stream}`, "-f", "framemd5", "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").pop()!.trim());

const t0 = performance.now();
// 300 frames / chunkSize 100 => 3 chunks (PlanV2Result.chunkCount, see planV2.d.ts).
const plan = await planV2(
  projectDir,
  { fps: 30, width: Number(wArg), height: Number(hArg), format: "mp4", chunkSize: 100 },
  planDir,
);
const { chunkCount } = plan;
const chunkPaths: string[] = [];
for (let i = 0; i < chunkCount; i++) {
  const out = join(outDir, "chunks", `${i}.mp4`);
  await renderChunkV2(planDir, i, out);
  chunkPaths.push(out);
}
const assembled = join(outDir, "assembled.mp4");
await assembleV2(planDir, chunkPaths, assembled);
const distributedSec = (performance.now() - t0) / 1000;

const single = join(outDir, "single.mp4");
const t1 = performance.now();
await executeRenderJob(createRenderJob({ fps: 30, quality: "standard" }), projectDir, single);
const singleSec = (performance.now() - t1) / 1000;

const va = fm(assembled, "v");
const vs = fm(single, "v");
const vDiff = va.filter((h, i) => h !== vs[i]).length;
const dur = (f: string) =>
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
const result = {
  chunkCount,
  framesAssembled: va.length,
  framesSingle: vs.length,
  videoFramesDiffering: vDiff,
  durationAssembled: dur(assembled),
  durationSingle: dur(single),
  distributedSec: +distributedSec.toFixed(2),
  singleSec: +singleSec.toFixed(2),
};
writeFileSync(join(outDir, "chunked.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
