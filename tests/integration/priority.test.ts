// T128: a single video enqueued while a batch is waiting starts before the batch rows (FR-041).
// The audio worker is held back until both the batch rows and the single video wait in the audio queue;
// when it starts (one job at a time) the single video must be served first.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run integration/priority
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Queue } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { templates, withWorkspace } from "@makvid/db";
import { batchView, createBatch, createProject } from "@makvid/pipeline";
import { extractVariables, templatize, type VideoSpec } from "@makvid/spec";
import { createStack, repoRoot, type Stack } from "./stack";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("priority: single video before batch rows", () => {
  let s: Stack;
  beforeAll(async () => {
    s = await createStack("prio", "55555555-5555-4555-8555-555555555555");
  }, 120_000);
  afterAll(async () => s?.teardown());

  it("serves the single video's audio before 4 waiting batch rows", async () => {
    const fixture = JSON.parse(
      readFileSync(join(repoRoot, "fixtures", "specs", "sample-vi.json"), "utf8"),
    ) as VideoSpec;
    const spec = templatize(fixture, [{ find: "lãi kép", name: "chu_de" }]);
    const [t] = await withWorkspace(s.db, s.ws, (tx) =>
      tx
        .insert(templates)
        .values({
          workspaceId: s.ws,
          versionId: "00000000-0000-4000-8000-000000000001",
          spec,
          name: "Mẫu",
          variables: extractVariables(spec),
          settings: { aspects: ["9:16"], voiceId: "vits:banmai" },
        })
        .returning(),
    );
    // ai + render workers only: batch rows (audio first) and the single video's audio pile up in the queue.
    s.startWorkers({ queues: ["ai", "render"] });
    const b = await createBatch(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      templateId: t!.id,
      csv: "chu_de\nmột\nhai\nba\nbốn\n",
      concurrency: 4,
    });
    if (!b.ok) throw new Error("batch rejected");
    const single = await createProject(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      prompt: "Video lẻ cần gấp",
      aspects: ["9:16"],
      durationSec: 30,
      mode: "auto",
      voiceId: "vits:banmai",
    });
    const audio = new Queue("audio", { connection: s.deps.connection, prefix: s.deps.prefix! });
    const t0 = Date.now();
    for (;;) {
      const waiting = await audio.getJobs(["prioritized", "waiting"]);
      const ids = waiting.map((j) => (j.data as { projectId: string }).projectId);
      if (ids.includes(single) && ids.length === 5) break;
      if (Date.now() - t0 > 120_000) throw new Error(`audio queue: ${ids.length} waiting`);
      await new Promise((r) => setTimeout(r, 300));
    }
    await audio.close();
    s.starts.length = 0;
    s.startWorkers({ queues: ["audio"], concurrency: 1 });
    expect((await s.settled(single)).status).toBe("ready");
    const audioStarts = s.starts.filter((x) => x.endsWith(":audio")).map((x) => x.split(":")[0]);
    expect(audioStarts[0]).toBe(single);
    // The batch still completes afterwards.
    for (;;) {
      const v = await batchView(s.deps, s.ws, b.batchId);
      if (v.batch.status === "completed") break;
      if (Date.now() - t0 > 480_000) throw new Error(`batch ${v.batch.status}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  });
});
