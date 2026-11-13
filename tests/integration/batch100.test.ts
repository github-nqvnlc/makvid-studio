// T134 / SC-005: 100-row batch acceptance on the compose stack (mock voice + stub renderer, real queue, DB,
// quota, object storage and ZIP). Every row must succeed, carry its own value, and land in the ZIP.
// Run: MAKVID_INFRA_TESTS=1 MAKVID_BATCH100=1 pnpm --filter @makvid/tests exec vitest run integration/batch100
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projects, projectVersions, subscriptions, templates, withWorkspace } from "@makvid/db";
import { batchView, billingGate, createBatch } from "@makvid/pipeline";
import { extractVariables, templatize, type VideoSpec } from "@makvid/spec";
import { createStack, repoRoot, type Stack } from "./stack";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1" && process.env.MAKVID_BATCH100 === "1")(
  "100-video batch (SC-005)",
  () => {
    let s: Stack;
    beforeAll(async () => {
      s = await createStack("b100", "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
      // Pro plan: batch enabled, 4 jobs at once, enough minutes for 100 × 30 s.
      await withWorkspace(s.db, s.ws, (tx) =>
        tx.insert(subscriptions).values({
          workspaceId: s.ws,
          planId: "pro",
          provider: "manual",
          providerRef: `b100-${process.pid}`,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
        }),
      );
      s.startWorkers({ concurrency: 4, gate: billingGate(s.db) });
    }, 120_000);
    afterAll(async () => s?.teardown());

    it(
      "produces 100 correct videos and a complete ZIP",
      async () => {
        const fixture = JSON.parse(
          readFileSync(join(repoRoot, "fixtures/specs/sample-vi.json"), "utf8"),
        ) as VideoSpec;
        const spec = templatize(fixture, [{ find: "lãi kép", name: "chu_de" }]);
        const [t] = await withWorkspace(s.db, s.ws, (tx) =>
          tx
            .insert(templates)
            .values({
              workspaceId: s.ws,
              versionId: crypto.randomUUID(),
              spec,
              name: "Lô 100",
              variables: extractVariables(spec),
              settings: { aspects: ["9:16"], voiceId: "vits:banmai" },
            })
            .returning(),
        );
        const csv = readFileSync(join(repoRoot, "fixtures/batch/100.csv"), "utf8");
        const t0 = Date.now();
        const r = await createBatch(
          s.deps,
          { workspaceId: s.ws, userId: s.userId, templateId: t!.id, csv, concurrency: 4 },
          billingGate(s.db),
        );
        if (!r.ok) throw new Error(JSON.stringify(r.check.issues.slice(0, 3)));
        expect(r.total).toBe(100);
        let v = await batchView(s.deps, s.ws, r.batchId);
        while (
          !(v.batch.status === "completed" && v.batch.zip) &&
          v.batch.status !== "completed_with_errors"
        ) {
          if (Date.now() - t0 > 3 * 3600_000) throw new Error(`still ${v.batch.status}`);
          await new Promise((res) => setTimeout(res, 5000));
          v = await batchView(s.deps, s.ws, r.batchId);
        }
        const minutes = (Date.now() - t0) / 60_000;
        expect(v.batch.counts).toMatchObject({ succeeded: 100, failed: 0 });

        // Each video's narration carries its own row value.
        const ps = await withWorkspace(s.db, s.ws, (tx) =>
          tx
            .select()
            .from(projects)
            .where(
              inArray(
                projects.id,
                v.items.map((i) => i.projectId!),
              ),
            ),
        );
        for (const item of v.items) {
          const p = ps.find((x) => x.id === item.projectId)!;
          const [ver] = await withWorkspace(s.db, s.ws, (tx) =>
            tx.select().from(projectVersions).where(eq(projectVersions.id, p.headVersionId!)),
          );
          expect((ver!.spec as VideoSpec).script.map((x) => x.text).join(" ")).toContain(
            item.variables.chu_de,
          );
        }
        const zip = unzipSync(new Uint8Array(await (await fetch(v.batch.zip!)).arrayBuffer()));
        const names = Object.keys(zip);
        expect(names.filter((n) => n.endsWith(".mp4"))).toHaveLength(100);
        expect(names.filter((n) => n.endsWith(".srt"))).toHaveLength(100);
        const report = {
          rows: 100,
          succeeded: v.batch.counts.succeeded,
          minutes: Math.round(minutes * 10) / 10,
        };
        if (process.env.MAKVID_BATCH100_OUT)
          writeFileSync(process.env.MAKVID_BATCH100_OUT, JSON.stringify(report, null, 2));
        console.log("batch100", report);
      },
      4 * 3600_000,
    );
  },
);
