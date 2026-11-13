// T132: distributed scene rendering. The scenes of one compiled video are fanned out to two scene workers
// through object storage; every scene comes back, the work is spread over both workers, a second request is
// served from storage without rendering again, and unsafe archives are refused.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run integration/distributed
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Queue } from "bullmq";
import { zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileVideo } from "@makvid/compiler";
import { distributedPool, SCENE_QUEUE, startSceneWorker, unzipInto, type SceneJob } from "@makvid/pipeline";
import { calls, stubRenderer } from "@makvid/pipeline/testing";
import { connectionFromUrl } from "@makvid/queue";
import { parseVideoSpec, type VideoSpec } from "@makvid/spec";
import { createObjectStore } from "@makvid/storage";
import { repoRoot } from "./stack";

describe("scene archives", () => {
  it("refuses entries that escape the target directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "mkv-unzip-"));
    expect(() => unzipInto(zipSync({ "../evil.txt": new Uint8Array([1]) }), join(dir, "x"))).toThrow(
      /unsafe/,
    );
    unzipInto(
      zipSync({ "index.html": new Uint8Array([60]), "assets/a.js": new Uint8Array([1]) }),
      join(dir, "ok"),
    );
    expect(existsSync(join(dir, "ok", "assets", "a.js"))).toBe(true);
  });
});

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("distributed scene rendering", () => {
  const prefix = `mkvdist${process.pid}`;
  const connection = connectionFromUrl();
  const store = createObjectStore({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
    region: "us-east-1",
    bucket: process.env.S3_BUCKET ?? "makvid-dev",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "makvid-dev-access",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "makvid-dev-secret-change-me",
    forcePathStyle: true,
  });
  const ws = `aaaaaaaa-aaaa-4aaa-8aaa-${String(process.pid).padStart(12, "0")}`;
  const workers = [0, 1].map(() => startSceneWorker(stubRenderer, store, connection, { prefix }));
  const seen = new Map<string, number>();
  workers.forEach((w, i) => w.on("completed", () => seen.set(String(i), (seen.get(String(i)) ?? 0) + 1)));

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    const q = new Queue(SCENE_QUEUE, { connection, prefix });
    await q.obliterate({ force: true });
    await q.close();
  });

  let jobs: SceneJob[] = [];
  beforeAll(async () => {
    await store.ensureBucket();
    const r = parseVideoSpec(
      JSON.parse(readFileSync(join(repoRoot, "fixtures/specs/sample-vi.json"), "utf8")),
    );
    if (!r.ok) throw new Error(r.issues.join());
    // A unique seed per run: no scene of this video exists in storage yet.
    const spec: VideoSpec = { ...r.spec, meta: { ...r.spec.meta, seed: process.pid } };
    const video = await compileVideo(spec, {
      aspect: "9:16",
      stylesRoot: join(repoRoot, "packages", "styles"),
      outDir: mkdtempSync(join(tmpdir(), "mkv-dist-")),
      engine: "test",
    });
    const out = mkdtempSync(join(tmpdir(), "mkv-dist-out-"));
    jobs = video.scenes.map((s, i) => ({
      cacheKey: s.cacheKey,
      sceneDir: s.dir,
      width: video.width,
      height: video.height,
      fps: video.fps,
      outPath: join(out, `${i}.mp4`),
    }));
  }, 120_000);

  it("renders every scene on the workers and spreads the work", async () => {
    const before = calls.renders;
    const progress: number[] = [];
    await distributedPool({ store, connection, workspaceId: ws, prefix }).render(jobs, (d) =>
      progress.push(d),
    );
    expect(jobs.every((j) => existsSync(j.outPath) && readFileSync(j.outPath).length > 1000)).toBe(true);
    expect(calls.renders - before).toBe(jobs.length);
    expect(progress.at(-1)).toBe(jobs.length);
    expect(seen.size).toBe(2); // both workers took scenes
  }, 300_000);

  it("a second request for the same scenes is served from storage (no new renders)", async () => {
    const before = calls.renders;
    const again = jobs.map((j) => ({ ...j, outPath: `${j.outPath}.again.mp4` }));
    await distributedPool({ store, connection, workspaceId: ws, prefix }).render(again);
    expect(calls.renders).toBe(before);
    expect(again.every((j) => existsSync(j.outPath))).toBe(true);
  }, 120_000);
});
