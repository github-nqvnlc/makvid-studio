// T088: review mode (US3). Independent test from the spec: edit one script sentence, pick style #2, drop one
// storyboard scene, then check the final video reflects all three edits. Runs in-process (mock providers) and
// through the BullMQ flow with pauses + resume (needs the compose stack: MAKVID_INFRA_TESTS=1).
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Job, Queue, QueueEvents } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS } from "@makvid/ai";
import {
  loadState,
  produceVideo,
  resumeProduction,
  startProduction,
  startStageWorker,
  type ContextFactory,
  type PipelineContext,
  type ProduceInput,
  type ProduceState,
} from "@makvid/pipeline";
import { connectionFromUrl } from "@makvid/queue";
import { calls, mockLlm, mockTts, MockAligner, SENTENCES, stubRenderer } from "./mocks";

const root = resolve(__dirname, "../..");
const stylesRoot = join(root, "packages", "styles");
const EDITED =
  "Lãi kép giúp tiền của bạn tự sinh ra tiền, năm này qua năm khác, mà bạn không cần làm thêm gì.";
const input: ProduceInput = { prompt: "Lãi kép là gì", aspects: ["9:16"], durationSec: 30, mode: "review" };
const makeCtx: ContextFactory = (workDir, hooks) => ({
  llm: createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS }),
  tts: mockTts,
  aligner: new MockAligner("http://unused"),
  renderer: stubRenderer,
  stylesRoot,
  workDir,
  voiceId: "vits:banmai",
  ...hooks,
});

function expectReflectsEdits(state: ProduceState, dropped: string) {
  const spec = state.spec!;
  expect(state.styleId).toBe("kinetic");
  expect(spec.meta.primaryStyleId).toBe("kinetic");
  expect(spec.scenes.every((s) => s.styleId === "kinetic")).toBe(true);
  expect(spec.scenes.map((s) => s.id)).not.toContain(dropped);
  expect(spec.scenes[0]!.transitionIn).toBeUndefined();
  const narration = spec.audio.narration!.words.map((w) => w.text).join(" ");
  expect(narration).toContain("tự sinh ra tiền");
  expect(narration).not.toContain(SENTENCES[1]!.split(" ").slice(0, 6).join(" ")); // old sentence 2 replaced
  expect(narration).not.toContain(SENTENCES[4]!.split(" ").slice(0, 6).join(" ")); // narration of the dropped scene
  expect(state.outputs?.[0]?.video).toMatch(/video\.mp4$/);
  expect(existsSync(state.outputs![0]!.video)).toBe(true);
}

describe.runIf(process.env.MAKVID_PIPELINE_TESTS === "1" || process.env.MAKVID_RENDER_TESTS === "1")(
  "review mode in-process (T088)",
  () => {
    it("pauses twice, applies script / style / storyboard edits and renders them", async () => {
      const workDir = mkdtempSync(join(tmpdir(), "mkv-review-"));
      const ctx: PipelineContext = makeCtx(workDir, {
        onUsage: () => undefined,
        onProgress: () => undefined,
      });
      const seen: string[] = [];
      let dropped = "";
      const r = await produceVideo(ctx, input, {
        reviewer: {
          async script(state) {
            seen.push("script");
            expect(state.awaiting).toBe("script_review");
            expect(state.board).toBeUndefined(); // nothing after the review point has run
            expect(state.styleSuggestions!.length).toBeGreaterThanOrEqual(2);
            const sentences = [...state.script!.sentences];
            sentences[1] = EDITED;
            return { sentences, styleId: state.styleSuggestions![1]!.styleId };
          },
          async storyboard(state) {
            seen.push("storyboard");
            expect(state.awaiting).toBe("storyboard_review");
            expect(state.mixedWav).toBeUndefined(); // no voice cost before approval
            expect(state.previews!.length).toBe(state.spec!.scenes.length);
            for (const p of state.previews!) expect(existsSync(p.image)).toBe(true);
            dropped = state.spec!.scenes.find((s) => s.templateId === "quote")!.id;
            return { dropSceneIds: [dropped] };
          },
        },
      });
      expect(seen).toEqual(["script", "storyboard"]);
      expect(r.status).toBe("ready");
      expectReflectsEdits(loadState(workDir)!, dropped);
    }, 600_000);
  },
);

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("review mode through the queue (T088/T089)", () => {
  const prefix = `mkvreview${process.pid}`;
  const connection = connectionFromUrl();
  const workers = (["ai", "audio", "render"] as const).map((q) =>
    startStageWorker(q, makeCtx, { connection, prefix }),
  );
  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    for (const q of ["ai", "audio", "render"]) {
      const queue = new Queue(q, { connection, prefix });
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  async function finish(node: Awaited<ReturnType<typeof startProduction>>) {
    const queue = new Queue(node.job.queueName, { connection, prefix });
    const events = new QueueEvents(node.job.queueName, { connection, prefix });
    await events.waitUntilReady();
    const job = (await Job.fromId(queue, node.job.id!))!;
    await job.waitUntilFinished(events, 300_000);
    await events.close();
    await queue.close();
  }

  it("stops at each review point and continues only after resume", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mkv-review-q-"));
    const data = { workspaceId: "w1", projectId: "p2", versionId: "v1", workDir, input };

    await finish(await startProduction(connection, data, { prefix }));
    let state = loadState(workDir)!;
    expect(state.awaiting).toBe("script_review");
    expect(state.board).toBeUndefined();
    const llmBefore = calls.llm;
    await new Promise((r) => setTimeout(r, 1000));
    expect(calls.llm).toBe(llmBefore); // really paused: no storyboard call
    // Resuming at the wrong point is refused.
    await expect(
      resumeProduction(connection, data, stylesRoot, { point: "storyboard_review", edits: {} }, { prefix }),
    ).rejects.toThrow(/not waiting/);

    const sentences = [...state.script!.sentences];
    sentences[1] = EDITED;
    const styleId = state.styleSuggestions![1]!.styleId;
    await finish(
      await resumeProduction(
        connection,
        data,
        stylesRoot,
        { point: "script_review", edits: { sentences, styleId } },
        { prefix },
      ),
    );
    state = loadState(workDir)!;
    expect(state.awaiting).toBe("storyboard_review");
    expect(state.mixedWav).toBeUndefined();

    const dropped = state.spec!.scenes.find((s) => s.templateId === "quote")!.id;
    await finish(
      await resumeProduction(
        connection,
        data,
        stylesRoot,
        { point: "storyboard_review", edits: { dropSceneIds: [dropped] } },
        { prefix },
      ),
    );
    state = loadState(workDir)!;
    expect(state.awaiting).toBeUndefined();
    expectReflectsEdits(state, dropped);
  }, 600_000);
});
