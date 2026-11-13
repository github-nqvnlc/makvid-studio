// T127: a 10-row batch from a template with 2 injected failures; "retry failed" reprocesses only those rows;
// every video carries its own row's value; the ZIP holds every successful video + subtitles.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run integration/batch
import { strFromU8, unzipSync } from "fflate";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { batchItems, projectVersions, projects, withWorkspace } from "@makvid/db";
import {
  batchView,
  checkBatchCsv,
  createBatch,
  createProject,
  createTemplate,
  retryFailedRows,
} from "@makvid/pipeline";
import { mockFaults } from "@makvid/pipeline/testing";
import type { VideoSpec } from "@makvid/spec";
import { createStack, type Stack } from "./stack";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("batch from template + CSV (US5)", () => {
  let s: Stack;
  let templateId = "";
  let batchId = "";

  beforeAll(async () => {
    s = await createStack("batch", "44444444-4444-4444-8444-444444444444");
    s.startWorkers({ concurrency: 3 });
  }, 120_000);
  afterAll(async () => {
    mockFaults.ttsFailIf = null;
    await s?.teardown();
  });

  async function waitBatch(
    id: string,
    done: (v: Awaited<ReturnType<typeof batchView>>) => boolean,
    ms = 600_000,
  ) {
    const t0 = Date.now();
    for (;;) {
      const v = await batchView(s.deps, s.ws, id);
      if (done(v)) return v;
      if (Date.now() - t0 > ms)
        throw new Error(`batch still ${v.batch.status} ${JSON.stringify(v.batch.counts)}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  it("saves a produced project as a template with a variable", async () => {
    const projectId = await createProject(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      prompt: "Lãi kép là gì",
      aspects: ["9:16"],
      durationSec: 30,
      mode: "auto",
      voiceId: "vits:banmai",
    });
    expect((await s.settled(projectId)).status).toBe("ready");
    const t = await createTemplate(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      projectId,
      name: "Lãi kép cho khách",
      replacements: [{ find: "lãi kép", name: "chu_de" }],
    });
    templateId = t.id;
    expect(t.variables.map((v) => v.name)).toEqual(["chu_de"]);
    expect(JSON.stringify(t.spec)).toContain("{{chu_de}}");
  });

  it("names a missing column before anything runs", async () => {
    const r = await checkBatchCsv(s.deps, s.ws, templateId, "ten,ghi_chu\nAn,x\n");
    expect(r.missingColumns).toEqual(["chu_de"]);
    const c = await createBatch(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      templateId,
      csv: "ten\nAn\n",
    });
    expect(c.ok).toBe(false);
  });

  it("runs 10 rows, 2 fail; retry-failed reprocesses only those 2; ZIP has 10 videos + SRT", async () => {
    const values = Array.from({ length: 10 }, (_, i) =>
      i === 3 || i === 6 ? `quỹ hỏng ${i + 1}` : `quỹ số ${i + 1}`,
    );
    mockFaults.ttsFailIf = (text) => text.includes("quỹ hỏng");
    const csv = ["chu_de", ...values].join("\n");
    const r = await createBatch(s.deps, {
      workspaceId: s.ws,
      userId: s.userId,
      templateId,
      csv,
      name: "Lô thử",
      concurrency: 3,
    });
    if (!r.ok) throw new Error(JSON.stringify(r.check.issues));
    batchId = r.batchId;
    expect(r.total).toBe(10);

    const v1 = await waitBatch(batchId, (v) => v.batch.status === "completed_with_errors");
    expect(v1.batch.counts).toMatchObject({ succeeded: 8, failed: 2, pending: 0, running: 0 });
    expect(v1.items.filter((i) => i.status === "failed").map((i) => i.row)).toEqual([4, 7]);

    // Each video carries its own row's value (narration of the head version).
    for (const item of v1.items.filter((i) => i.status === "succeeded")) {
      const [p] = await withWorkspace(s.db, s.ws, (tx) =>
        tx.select().from(projects).where(eq(projects.id, item.projectId!)),
      );
      const [ver] = await withWorkspace(s.db, s.ws, (tx) =>
        tx.select().from(projectVersions).where(eq(projectVersions.id, p!.headVersionId!)),
      );
      const text = (ver!.spec as VideoSpec).script.map((x) => x.text).join(" ");
      expect(text).toContain(item.variables.chu_de);
      expect(text).not.toContain("{{");
    }

    const before = await withWorkspace(s.db, s.ws, (tx) =>
      tx.select().from(batchItems).where(eq(batchItems.batchId, batchId)),
    );
    mockFaults.ttsFailIf = null;
    expect(await retryFailedRows(s.deps, s.ws, batchId)).toBe(2);
    const v2 = await waitBatch(batchId, (v) => v.batch.status === "completed" && !!v.batch.zip);
    expect(v2.batch.counts).toMatchObject({ succeeded: 10, failed: 0 });
    const after = await withWorkspace(s.db, s.ws, (tx) =>
      tx.select().from(batchItems).where(eq(batchItems.batchId, batchId)),
    );
    for (const a of after) {
      const b = before.find((x) => x.id === a.id)!;
      // only rows 4 and 7 ran again
      expect(a.attempts - b.attempts).toBe([4, 7].includes(a.rowIndex) ? 1 : 0);
      expect(a.projectId).toBe(b.projectId);
    }

    const zip = unzipSync(new Uint8Array(await (await fetch(v2.batch.zip!)).arrayBuffer()));
    const names = Object.keys(zip).sort();
    expect(names.filter((n) => n.endsWith(".mp4"))).toHaveLength(10);
    expect(names.filter((n) => n.endsWith(".srt"))).toHaveLength(10);
    expect(names[0]).toBe("001-quy-so-1.mp4");
    expect(strFromU8(zip["001-quy-so-1.srt"]!)).toMatch(/-->/);
  });
});
