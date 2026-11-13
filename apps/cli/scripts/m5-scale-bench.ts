// M5 render benchmark (T134; SC-004): render a ~60 s 1080p30 video (9:16) with the distributed scene pool and
// N scene workers, and report wall-clock time per N. Runs in the Linux render container (real HyperFrames):
//   docker run --rm --cpus 12 --shm-size 4g --entrypoint pnpm -e VALKEY_URL=redis://host.docker.internal:6379 \
//     -e S3_ENDPOINT=http://host.docker.internal:8333 ... makvid-render:dev --filter @makvid/cli exec tsx \
//     scripts/m5-scale-bench.ts --workers 1,2,4 --capture 1 --out /out/scale.json
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Queue } from "bullmq";
import { compileVideo } from "@makvid/compiler";
import { distributedPool, SCENE_QUEUE, startSceneWorker } from "@makvid/pipeline";
import { connectionFromUrl } from "@makvid/queue";
import { concatAndMux, createRenderer, probe } from "@makvid/renderer";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { createObjectStore } from "@makvid/storage";

const { values } = parseArgs({
  options: {
    workers: { type: "string", default: "1,2,4" },
    capture: { type: "string", default: "1" }, // HyperFrames capture workers per scene worker
    out: { type: "string", default: "scale.json" },
    repeat: { type: "string", default: "2" }, // fixture copies (~30 s each)
  },
});
const root = resolve(import.meta.dirname, "../../..");

/** The sample spec repeated: ~30 s per copy, scene ids kept unique. */
function longSpec(copies: number): VideoSpec {
  const r = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!r.ok) throw new Error(r.issues.join());
  const s = r.spec;
  return {
    ...s,
    meta: { ...s.meta, targetDurationSec: Math.min(600, 30 * copies) },
    scenes: Array.from({ length: copies }, (_, c) =>
      s.scenes.map((sc) => ({ ...sc, id: `${sc.id}-c${c + 1}` })),
    ).flat(),
  };
}

const store = createObjectStore({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
  region: "us-east-1",
  bucket: process.env.S3_BUCKET ?? "makvid-dev",
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "makvid-dev-access",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "makvid-dev-secret-change-me",
  forcePathStyle: true,
});
const connection = connectionFromUrl();
await store.ensureBucket();

const spec = longSpec(Number(values.repeat));
const video = await compileVideo(spec, {
  aspect: "9:16",
  stylesRoot: join(root, "packages", "styles"),
  outDir: mkdtempSync(join(tmpdir(), "mkv-bench-")),
  engine: (() => {
    const r = createRenderer("hyperframes");
    return `${r.id}@${r.version}`;
  })(),
});
// Sum of the scenes (each copy keeps its own timing, so the timeline end is not the video length).
const seconds = video.scenes.reduce((n, s) => n + s.durationMs, 0) / 1000;
console.log(
  `video: ${video.scenes.length} scenes, ${seconds.toFixed(1)} s, ${video.width}x${video.height}@${video.fps}`,
);

const results: Array<{
  workers: number;
  capture: number;
  renderSec: number;
  muxSec: number;
  perVideoMinute: number;
}> = [];
for (const n of values.workers.split(",").map(Number)) {
  const prefix = `bench${Date.now()}`;
  // A fresh workspace id per run: nothing is served from the scene cache.
  const ws = `bbbbbbbb-bbbb-4bbb-8bbb-${String(Date.now()).slice(-12)}`;
  const workers = Array.from({ length: n }, () =>
    startSceneWorker(createRenderer("hyperframes", { workers: Number(values.capture) }), store, connection, {
      prefix,
    }),
  );
  const out = mkdtempSync(join(tmpdir(), "mkv-bench-out-"));
  const jobs = video.scenes.map((s, i) => ({
    cacheKey: s.cacheKey,
    sceneDir: s.dir,
    width: video.width,
    height: video.height,
    fps: video.fps,
    outPath: join(out, `${String(i).padStart(2, "0")}.mp4`),
  }));
  const t0 = performance.now();
  await distributedPool({ store, connection, workspaceId: ws, prefix }).render(jobs, (d, t) =>
    process.stdout.write(`\r  ${n} worker(s): ${d}/${t} scenes`),
  );
  const t1 = performance.now();
  const mp4 = join(out, "video.mp4");
  await concatAndMux({ scenes: jobs.map((j) => j.outPath), outPath: mp4, fps: video.fps });
  const t2 = performance.now();
  const p = await probe(mp4);
  const renderSec = (t1 - t0) / 1000;
  const r = {
    workers: n,
    capture: Number(values.capture),
    renderSec: Math.round(renderSec * 10) / 10,
    muxSec: Math.round(((t2 - t1) / 1000) * 10) / 10,
    perVideoMinute: Math.round(((renderSec + (t2 - t1) / 1000) / (seconds / 60)) * 10) / 10,
    durationSec: p.durationSec,
  };
  console.log(`\n  ${JSON.stringify(r)}`);
  results.push(r);
  await Promise.all(workers.map((w) => w.close()));
  const q = new Queue(SCENE_QUEUE, { connection, prefix });
  await q.obliterate({ force: true });
  await q.close();
}
const base = results[0]!.renderSec;
const report = {
  video: { scenes: video.scenes.length, seconds, size: `${video.width}x${video.height}`, fps: video.fps },
  results: results.map((r) => ({ ...r, speedup: Math.round((base / r.renderSec) * 100) / 100 })),
};
writeFileSync(values.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
