// T166: retention deletes expired rendered files (object storage + rows) and keeps the rest.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run integration/retention
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projects, projectVersions, renderOutputs, withWorkspace } from "@makvid/db";
import { purgeExpiredOutputs } from "@makvid/pipeline";
import { workspaceKey } from "@makvid/storage";
import { createStack, type Stack } from "./stack";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("retention", () => {
  let s: Stack;
  beforeAll(async () => {
    s = await createStack("ret", "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  }, 120_000);
  afterAll(async () => s?.teardown());

  it("deletes only expired outputs and their files", async () => {
    const { store } = s.deps;
    const keys = { old: workspaceKey(s.ws, "ret", "old.mp4"), fresh: workspaceKey(s.ws, "ret", "fresh.mp4") };
    await store.put(keys.old, "old");
    await store.put(keys.fresh, "fresh");
    await withWorkspace(s.db, s.ws, async (tx) => {
      const [p] = await tx.insert(projects).values({ workspaceId: s.ws, title: "R" }).returning();
      const [v] = await tx
        .insert(projectVersions)
        .values({ workspaceId: s.ws, projectId: p!.id, seq: 1, spec: {}, specVersion: "0.1.0", author: "ai" })
        .returning();
      const base = {
        workspaceId: s.ws,
        projectId: p!.id,
        versionId: v!.id,
        aspect: "9:16",
        durationMs: 1000,
        width: 1080,
        height: 1920,
        fps: 30,
      };
      await tx.insert(renderOutputs).values([
        { ...base, storageKey: keys.old, expiresAt: new Date(Date.now() - 86400_000) },
        { ...base, storageKey: keys.fresh, expiresAt: new Date(Date.now() + 86400_000) },
      ]);
    });
    const r = await purgeExpiredOutputs(s.db, store);
    expect(r).toEqual({ outputs: 1, files: 1 });
    expect(await store.exists(keys.old)).toBe(false);
    expect(await store.exists(keys.fresh)).toBe(true);
    const left = await withWorkspace(s.db, s.ws, (tx) => tx.select().from(renderOutputs));
    expect(left.map((x) => x.storageKey)).toEqual([keys.fresh]);
    expect(await purgeExpiredOutputs(s.db, store)).toEqual({ outputs: 0, files: 0 });
  });
});
