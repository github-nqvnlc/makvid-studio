// T083: the produce-video BullMQ flow on Valkey with the three stage workers (mock providers).
// Run with the compose stack: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests test
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Job, QueueEvents, Queue } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS } from "@makvid/ai";
import {
  loadState,
  PRODUCE_STAGES,
  startStageWorker,
  type ContextFactory,
  type ProduceInput,
} from "@makvid/pipeline";
import { connectionFromUrl, enqueueProduceVideo } from "@makvid/queue";
import { calls, mockLlm, mockTts, MockAligner, stubRenderer } from "./mocks";

const root = resolve(__dirname, "../..");
const prefix = `mkvflow${process.pid}`;
const connection = connectionFromUrl();

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("produce-video flow (T083)", () => {
  const makeCtx: ContextFactory = (workDir, hooks) => ({
    llm: createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS }),
    tts: mockTts,
    aligner: new MockAligner("http://unused"),
    renderer: stubRenderer,
    stylesRoot: join(root, "packages", "styles"),
    workDir,
    voiceId: "vits:banmai",
    ...hooks,
  });
  const usage: string[] = [];
  const workers = (["ai", "audio", "render"] as const).map((q) =>
    startStageWorker(q, makeCtx, { connection, prefix, onUsage: (_d, u) => usage.push(u.step) }),
  );
  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    for (const q of ["ai", "audio", "render"]) {
      const queue = new Queue(q, { connection, prefix });
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("runs every stage in order across worker queues and is idempotent", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mkv-flow-"));
    const input: ProduceInput = { prompt: "Lãi kép là gì", aspects: ["9:16"], durationSec: 30 };
    const data = { workspaceId: "w1", projectId: "p1", versionId: "v1", workDir, input };
    const events = new QueueEvents("render", { connection, prefix });
    await events.waitUntilReady();
    const node = await enqueueProduceVideo(connection, PRODUCE_STAGES, data, { prefix });
    expect(node.job.name).toBe("render");
    const renderQueue = new Queue("render", { connection, prefix });
    const job = (await Job.fromId(renderQueue, node.job.id!))!;
    await job.waitUntilFinished(events, 300_000);
    const state = loadState(workDir)!;
    expect(state.outputs?.[0]?.video).toMatch(/video\.mp4$/);
    expect(state.qa?.passed).toBe(true);
    expect(usage).toEqual(
      expect.arrayContaining(["script", "style_suggest", "storyboard", "tts", "render_scene"]),
    );

    // Same version + input again: same job ids -> BullMQ keeps the finished jobs, no new work.
    const before = { ...calls };
    const again = await enqueueProduceVideo(connection, PRODUCE_STAGES, data, { prefix });
    expect(again.job.id).toBe(node.job.id);
    await new Promise((r) => setTimeout(r, 1500));
    expect(calls).toEqual(before);
    await events.close();
    await renderQueue.close();
  }, 400_000);
});
