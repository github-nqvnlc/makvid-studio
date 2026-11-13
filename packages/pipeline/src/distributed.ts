// Distributed scene rendering (US5, T132; SC-004). A video's scenes are independent compositions, so they are
// the render chunks: the coordinator (the render stage of one video) uploads each uncached compiled scene to
// object storage and queues one "render-scene" job per scene; every worker-render container runs a scene
// worker that downloads, renders and uploads the MP4. The coordinator waits, downloads, and muxes as before.
// Rendering time of one video therefore drops with the number of render containers, and finished scenes are
// shared through object storage (content-addressed by the scene cache key, scoped to the workspace).
//
// Research note: HyperFrames also ships frame-range chunking (`@hyperframes/producer/distributed`: planV2,
// renderChunkV2, assembleV2). Scene-level fan-out is used instead because our scenes are already independent,
// cached and deterministic, and it needs no assembly step besides the existing concat.
import {
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Queue, QueueEvents, Worker, type ConnectionOptions, type Job } from "bullmq";
import { unzipSync, zipSync } from "fflate";
import { createLogger } from "@makvid/queue";
import type { Renderer } from "@makvid/renderer";
import { workspaceKey, type ObjectStore } from "@makvid/storage";

export const SCENE_QUEUE = "render-scene";

export interface SceneJob {
  cacheKey: string;
  sceneDir: string;
  width: number;
  height: number;
  fps: number;
  outPath: string;
}

/** Renders a set of scenes, possibly elsewhere; resolves when every outPath exists. */
export interface ScenePool {
  render(jobs: SceneJob[], onDone?: (done: number, total: number) => void): Promise<void>;
}

interface SceneJobData {
  zipKey: string;
  outKey: string;
  width: number;
  height: number;
  fps: number;
}

function zipDir(dir: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else files[relative(dir, p).split(sep).join("/")] = readFileSync(p);
    }
  };
  walk(dir);
  // Fonts/video/images are already compressed; HTML/JS compress well at a low level.
  return zipSync(files, { level: 1 });
}

/** Extract a scene archive; entry names must stay inside `dir` (no absolute paths or "..").*/
export function unzipInto(zip: Uint8Array, dir: string): void {
  const root = resolve(dir);
  for (const [name, data] of Object.entries(unzipSync(zip))) {
    if (name.endsWith("/")) continue;
    const target = resolve(root, name);
    if (!target.startsWith(root + sep) || name.includes("\\") || name.startsWith("/"))
      throw new Error("unsafe archive entry");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
}

async function download(store: ObjectStore, key: string, path: string) {
  mkdirSync(dirname(path), { recursive: true });
  await pipeline((await store.getStream(key)) as NodeJS.ReadableStream, createWriteStream(path));
}

/** Coordinator side: queue the scenes of one video on the shared scene queue and wait for them. */
export function distributedPool(o: {
  store: ObjectStore;
  connection: ConnectionOptions;
  workspaceId: string;
  prefix?: string;
  timeoutMs?: number;
}): ScenePool {
  return {
    async render(jobs, onDone) {
      if (!jobs.length) return;
      const prefix = o.prefix ?? "mkv";
      const queue = new Queue<SceneJobData>(SCENE_QUEUE, { connection: o.connection, prefix });
      const events = new QueueEvents(SCENE_QUEUE, { connection: o.connection, prefix });
      try {
        await events.waitUntilReady();
        let done = 0;
        await Promise.all(
          jobs.map(async (j) => {
            const base = workspaceKey(o.workspaceId, "render", `${j.cacheKey}-${j.width}x${j.height}`);
            const outKey = `${base}.mp4`;
            if (!(await o.store.exists(outKey))) {
              const zipKey = `${base}.zip`;
              await o.store.put(zipKey, zipDir(j.sceneDir), { contentType: "application/zip" });
              // Same scene requested twice (another video, a retry): one job, both wait for it.
              const id = `${o.workspaceId}.${j.cacheKey}.${j.width}x${j.height}`;
              let job: Job<SceneJobData> | undefined = await queue.getJob(id);
              if (job && (await job.isFailed())) {
                await job.remove();
                job = undefined;
              }
              job ??= await queue.add(
                "scene",
                { zipKey, outKey, width: j.width, height: j.height, fps: j.fps },
                {
                  jobId: id,
                  attempts: 3,
                  backoff: { type: "exponential", delay: 3000 },
                  removeOnComplete: { age: 3600 },
                  removeOnFail: { age: 86400 },
                },
              );
              if (!(await job.isCompleted())) await job.waitUntilFinished(events, o.timeoutMs ?? 30 * 60_000);
            }
            await download(o.store, outKey, j.outPath);
            onDone?.(++done, jobs.length);
          }),
        );
      } finally {
        await events.close();
        await queue.close();
      }
    },
  };
}

/** Local pool: render one scene after the other in this process (default, tests, CLI). */
export function localPool(renderer: Renderer): ScenePool {
  return {
    async render(jobs, onDone) {
      let done = 0;
      for (const j of jobs) {
        await renderer.renderScene({
          sceneDir: j.sceneDir,
          width: j.width,
          height: j.height,
          fps: j.fps,
          outPath: j.outPath,
        });
        onDone?.(++done, jobs.length);
      }
    },
  };
}

/** Scene worker (runs in every worker-render container): download, render, upload. */
export function startSceneWorker(
  renderer: Renderer,
  store: ObjectStore,
  connection: ConnectionOptions,
  opts: { prefix?: string; concurrency?: number } = {},
): Worker<SceneJobData> {
  const log = createLogger("render-scene");
  const w = new Worker<SceneJobData>(
    SCENE_QUEUE,
    async (job) => {
      if (await store.exists(job.data.outKey)) return { cached: true };
      const dir = mkdtempSync(join(tmpdir(), "mkv-scene-"));
      try {
        unzipInto(new Uint8Array(await store.get(job.data.zipKey)), join(dir, "scene"));
        const out = join(dir, "scene.mp4");
        const t0 = performance.now();
        await renderer.renderScene({
          sceneDir: join(dir, "scene"),
          width: job.data.width,
          height: job.data.height,
          fps: job.data.fps,
          outPath: out,
        });
        await store.putFile(job.data.outKey, out, { contentType: "video/mp4" });
        const ms = Math.round(performance.now() - t0);
        log.info({ jobId: job.id, ms }, "scene rendered");
        return { cached: false, ms };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    { connection, prefix: opts.prefix ?? "mkv", concurrency: opts.concurrency ?? 1 },
  );
  w.on("failed", (job, err) => log.warn({ jobId: job?.id, err: err.message.split("\n")[0] }, "scene failed"));
  return w;
}
