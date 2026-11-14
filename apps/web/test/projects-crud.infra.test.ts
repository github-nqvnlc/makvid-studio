// Project management on real Postgres (MAKVID_INFRA_TESTS=1): search without accents, filters, pagination speed,
// workspace isolation for list/delete, and permanent deletion (tombstone then purge).
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, memberships, migrate, projects, users, withWorkspace, workspaces, type Db } from "@makvid/db";
import { purgeProject, tombstoneProjects, type ServiceDeps } from "@makvid/pipeline";
import type { ObjectStore } from "@makvid/storage";
import { parseListQuery } from "../src/lib/project-query";
import { listProjects, matchingIds } from "../src/server/projects-list";

const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_projcrud_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const deletedPrefixes: string[] = [];
const store = {
  signedGetUrl: async () => "https://example.test/signed",
  deletePrefix: async (p: string) => {
    deletedPrefixes.push(p);
    return 3;
  },
} as unknown as ObjectStore;
const q = (qs: string) => {
  const r = parseListQuery(new URLSearchParams(qs));
  if (!r.success) throw new Error("bad query");
  return r.data;
};

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("projects CRUD with Postgres", () => {
  let db: Db;
  let close: () => Promise<void>;
  const ids: string[] = [];

  beforeAll(async () => {
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    await migrate(url);
    ({ db, close } = connect(url, 8));
    const [u] = await db.insert(users).values({ email: "p@example.test" }).returning();
    for (const [ws, slug] of [
      [A, "a"],
      [B, "b"],
    ] as const)
      await withWorkspace(db, ws, async (tx) => {
        await tx.insert(workspaces).values({ id: ws, name: slug, slug, createdBy: u!.id });
        await tx.insert(memberships).values({ workspaceId: ws, userId: u!.id, role: "owner" });
      });
    const statuses = ["ready", "failed", "rendering", "draft", "needs_attention"] as const;
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      workspaceId: A,
      title: i === 7 ? "Đồng Hồ Thông Minh" : `Video số ${i}`,
      status: statuses[i % 5]!,
      primaryAspect: i % 2 ? "9:16" : "16:9",
      createdBy: u!.id,
    }));
    const inserted = await withWorkspace(db, A, (tx) => tx.insert(projects).values(rows).returning({ id: projects.id }));
    ids.push(...inserted.map((r) => r.id));
    await withWorkspace(db, B, (tx) => tx.insert(projects).values({ workspaceId: B, title: "Của workspace B" }));
  }, 120_000);

  afterAll(async () => {
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.end();
  });

  it("finds 'Đồng Hồ' when typing 'dong ho', ignoring case and accents", async () => {
    for (const s of ["dong ho", "ĐỒNG HỒ", "thong minh"]) {
      const r = await listProjects(db, store, A, q(`q=${encodeURIComponent(s)}`));
      expect(r.total).toBe(1);
      expect(r.projects[0]?.title).toBe("Đồng Hồ Thông Minh");
    }
  });

  it("treats % and _ in the search text literally", async () => {
    expect((await listProjects(db, store, A, q("q=%25"))).total).toBe(0);
    expect((await listProjects(db, store, A, q("q=_"))).total).toBe(0);
  });

  it("every filter and a deep page answers under 1 s with the right counts", async () => {
    const cases: Array<[string, number]> = [
      ["status=failed", 200],
      ["status=processing", 200],
      ["status=ready,draft", 400],
      ["aspect=9:16", 500],
      ["aspect=16:9&status=ready", 100],
      ["created=today", 1000],
      ["updated=30d&mode=auto", 1000],
      ["created=custom&createdFrom=2999-01-01", 0],
    ];
    for (const [qs, total] of cases) {
      const t0 = Date.now();
      const r = await listProjects(db, store, A, q(qs));
      expect(r.total, qs).toBe(total);
      expect(Date.now() - t0, qs).toBeLessThan(1000);
    }
    const last = await listProjects(db, store, A, q("page=42&pageSize=24"));
    expect(last.projects).toHaveLength(1000 - 41 * 24);
    expect(last.total).toBe(1000);
    const past = await listProjects(db, store, A, q("page=500"));
    expect(past.projects).toHaveLength(0);
    expect(past.total).toBe(1000);
  });

  it("never lists, matches or deletes another workspace's projects", async () => {
    expect((await listProjects(db, store, B, q(""))).total).toBe(1);
    expect(await matchingIds(db, B, q("status=ready"), 10)).toHaveLength(0);
    const stolen = await tombstoneProjects({ db } as ServiceDeps, B, ids.slice(0, 5));
    expect(stolen).toEqual([]);
    expect((await listProjects(db, store, A, q(""))).total).toBe(1000);
  });

  it("delete is permanent: tombstone hides at once, purge removes objects, work dir and rows", async () => {
    const target = ids[7]!;
    const workRoot = mkdtempSync(join(tmpdir(), "mkv-purge-"));
    const dir = join(workRoot, A, target);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "state.json"), "{}");

    const done = await tombstoneProjects({ db } as ServiceDeps, A, [target, target]);
    expect(done).toEqual([target]);
    expect((await listProjects(db, store, A, q("q=dong ho"))).total).toBe(0);
    expect(await tombstoneProjects({ db } as ServiceDeps, A, [target])).toEqual([]); // already deleted

    // A live project is never purged by mistake.
    expect(await purgeProject(db, store, workRoot, A, ids[8]!)).toEqual({ objects: 0, rows: 0 });
    expect(await purgeProject(db, store, workRoot, A, target)).toEqual({ objects: 3, rows: 1 });
    expect(deletedPrefixes).toEqual([`ws/${A}/projects/${target}/`]);
    expect(existsSync(dir)).toBe(false);
    const rows = await withWorkspace(db, A, (tx) =>
      tx.select({ id: projects.id }).from(projects).where(sql`${projects.id} = ${target}`),
    );
    expect(rows).toHaveLength(0);
  });
});
