// T135: workspace isolation (FR-047). Three layers:
//   1. Catalog: every table with a workspace_id column has RLS enabled AND forced, a tenant policy, and no
//      policy other than tenant / service / admin / the documented user-scoped reads.
//   2. Data: rows written by workspace A are invisible and unchangeable from workspace B, table by table.
//   3. Services: B cannot open A's project, batch, template or signed files through the service layer;
//      object keys are always namespaced by workspace.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run isolation
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiKeys,
  batches,
  batchItems,
  creditLedger,
  paymentOrders,
  projects,
  quotaReservations,
  subscriptions,
  templates,
  usagePeriods,
  webhookEndpoints,
  withService,
  withWorkspace,
  type Db,
} from "@makvid/db";
import { batchView, ProjectError, projectView } from "@makvid/pipeline";
import { workspaceKey } from "@makvid/storage";
import type { VideoSpec } from "@makvid/spec";
import { createStack, repoRoot, type Stack } from "../integration/stack";

const A = "88888888-8888-4888-8888-888888888888";
const B = "99999999-9999-4999-8999-999999999999";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("workspace isolation", () => {
  let s: Stack;
  let db: Db;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    s = await createStack("iso", A);
    db = s.db;
    await withWorkspace(db, B, async (tx) => {
      await tx.execute(
        sql`INSERT INTO workspaces (id, name, slug, created_by) VALUES (${B}, 'B', ${`iso-b-${process.pid}`}, ${s.userId})`,
      );
    });
    const spec = JSON.parse(
      readFileSync(join(repoRoot, "fixtures/specs/sample-vi.json"), "utf8"),
    ) as VideoSpec;
    await withWorkspace(db, A, async (tx) => {
      const [p] = await tx.insert(projects).values({ workspaceId: A, title: "A secret" }).returning();
      const [t] = await tx
        .insert(templates)
        .values({
          workspaceId: A,
          versionId: p!.id,
          spec,
          name: "A tpl",
          variables: [],
          settings: { aspects: ["9:16"] },
        })
        .returning();
      const [b] = await tx
        .insert(batches)
        .values({ workspaceId: A, templateId: t!.id, name: "A batch", total: 1 })
        .returning();
      await tx
        .insert(batchItems)
        .values({ workspaceId: A, batchId: b!.id, rowIndex: 1, variables: { x: "1" } });
      const [up] = await tx
        .insert(usagePeriods)
        .values({ workspaceId: A, periodStart: new Date("2026-11-01"), periodEnd: new Date("2026-12-01") })
        .returning();
      await tx.insert(quotaReservations).values({ workspaceId: A, periodId: up!.id, amounts: { videos: 1 } });
      await tx
        .insert(apiKeys)
        .values({ workspaceId: A, name: "k", prefix: `mk_live_iso${process.pid}`, hash: "h", scopes: [] });
      await tx
        .insert(webhookEndpoints)
        .values({ workspaceId: A, url: "https://a.example/h", secretEnc: "x", events: [] });
      await tx.insert(subscriptions).values({
        workspaceId: A,
        planId: "pro",
        provider: "manual",
        providerRef: `iso-${process.pid}`,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400_000),
      });
      await tx.insert(creditLedger).values({ workspaceId: A, deltaSeconds: 60, reason: "grant", ref: "iso" });
      await tx
        .insert(paymentOrders)
        .values({ workspaceId: A, provider: "mock", kind: "credits", amount: "1", currency: "USD" });
      Object.assign(ids, { project: p!.id, template: t!.id, batch: b!.id });
    });
  }, 120_000);
  afterAll(async () => s?.teardown());

  it("every tenant table has forced RLS and only known policies", async () => {
    const rows = (await withService(db, (tx) =>
      tx.execute(sql`
        SELECT c.relname AS t, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
               coalesce(array_agg(p.polname ORDER BY p.polname) FILTER (WHERE p.polname IS NOT NULL), '{}') AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'workspace_id' AND NOT a.attisdropped
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE c.relkind = 'r'
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY 1`),
    )) as unknown as Array<{ t: string; rls: boolean; forced: boolean; policies: string[] }>;
    // payment_events carries an optional workspace_id but is platform data (service/admin only).
    expect(rows.length).toBeGreaterThanOrEqual(25);
    const ALLOWED_EXTRA: Record<string, string[]> = {
      memberships: ["memberships_self"],
      workspaces: ["workspaces_member"],
    };
    for (const r of rows) {
      expect(r.rls && r.forced, `${r.t}: RLS enabled + forced`).toBe(true);
      const allowed = new Set([
        `${r.t}_tenant`,
        `${r.t}_service`,
        `${r.t}_admin`,
        ...(ALLOWED_EXTRA[r.t] ?? []),
      ]);
      if (r.t !== "payment_events") expect(r.policies, r.t).toContain(`${r.t}_tenant`);
      for (const p of r.policies) expect(allowed.has(p), `${r.t}: unexpected policy ${p}`).toBe(true);
    }
  });

  it("B sees none of A's rows in any tenant table and cannot change them", async () => {
    const tables = (await withService(db, (tx) =>
      tx.execute(sql`
        SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'workspace_id'
        WHERE c.relkind = 'r' ORDER BY 1`),
    )) as unknown as Array<{ t: string }>;
    let checked = 0;
    for (const { t } of tables) {
      const [{ n: inA }] = (await withService(db, (tx) =>
        tx.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(t)} WHERE workspace_id = ${A}`),
      )) as unknown as [{ n: number }];
      const [{ n: seenByB }] = (await withWorkspace(db, B, (tx) =>
        tx.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(t)} WHERE workspace_id = ${A}`),
      )) as unknown as [{ n: number }];
      expect(seenByB, `${t}: B reads A`).toBe(0);
      // Platform tables refuse DELETE outright (no grant): stricter than an empty result, also a pass.
      const changed = (await withWorkspace(db, B, (tx) =>
        tx.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE workspace_id = ${A} RETURNING 1`),
      ).catch((e: Error & { cause?: Error }) => {
        if (/permission denied/.test(e.cause?.message ?? e.message)) return [];
        throw e;
      })) as unknown as unknown[];
      expect(changed.length, `${t}: B deletes A`).toBe(0);
      if (inA > 0) checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(12); // tables that really held A's rows
  });

  it("services refuse A's project and batch to B; A still sees them", async () => {
    await expect(projectView(s.deps, B, ids.project!)).rejects.toBeInstanceOf(ProjectError);
    await expect(batchView(s.deps, B, ids.batch!)).rejects.toBeInstanceOf(ProjectError);
    expect((await batchView(s.deps, A, ids.batch!)).batch.name).toBe("A batch");
    const [t] = await withWorkspace(db, B, (tx) => tx.select().from(templates));
    expect(t).toBeUndefined();
  });

  it("object keys are namespaced by workspace and reject traversal", () => {
    expect(workspaceKey(A, "projects", "p", "v", "9x16.mp4")).toBe(`ws/${A}/projects/p/v/9x16.mp4`);
    expect(() => workspaceKey(`${A}/../${B}`, "x")).toThrow();
    expect(() => workspaceKey(A, "..", B, "x")).toThrow();
  });
});
