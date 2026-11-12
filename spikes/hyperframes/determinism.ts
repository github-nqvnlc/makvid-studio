// M0 spike T002: render the same project twice and compare decoded per-frame MD5 hashes.
// Usage: tsx determinism.ts <projectDir> <outDir>
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , projectDir, outDir] = process.argv;
if (!projectDir || !outDir) throw new Error("usage: tsx determinism.ts <projectDir> <outDir>");
mkdirSync(outDir, { recursive: true });

function frameHashes(mp4: string): string[] {
  const out = execFileSync("ffmpeg", ["-loglevel", "error", "-i", mp4, "-map", "0:v", "-f", "framemd5", "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").pop()!.trim());
}

const runs: string[][] = [];
for (const i of [1, 2]) {
  const out = join(outDir, `run${i}.mp4`);
  await executeRenderJob(createRenderJob({ fps: 30, quality: "standard" }), projectDir, out);
  const h = frameHashes(out);
  writeFileSync(join(outDir, `run${i}.framemd5.txt`), h.join("\n"));
  runs.push(h);
}
const [a, b] = runs;
const diffs = a.map((h, i) => (h === b[i] ? -1 : i)).filter((i) => i >= 0);
const result = { frames: a.length, framesB: b.length, identical: diffs.length === 0 && a.length === b.length, differingFrames: diffs.length, firstDiffs: diffs.slice(0, 10) };
writeFileSync(join(outDir, "determinism.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
