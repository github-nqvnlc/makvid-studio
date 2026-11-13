// Integration against Postgres from docker/compose.dev.yml (fresh database per run): MAKVID_INFRA_TESTS=1
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  connect,
  memberships,
  migrate,
  projects,
  projectVersions,
  usageRecords,
  users,
  assets,
  brandKits,
  chatMessages,
  withUser,
  withWorkspace,
  workspaces,
  type Db,
} from "../src";

const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_test_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);

/** drizzle wraps driver errors ("Failed query: ..."); the Postgres message is in `cause`. */
const pgError = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return `${err.message} ${err.cause?.message ?? ""}`;
  }
  return "no error";
};

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("RLS by workspace", () => {
  let db: Db;
  let close: () => Promise<void>;
  const ids = { u1: "", u2: "", w1: "", w2: "" };

  beforeAll(async () => {
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    expect(await migrate(url)).toEqual([
      "0001_init.sql",
      "0002_projects_pipeline.sql",
      "0003_auth_chat.sql",
      "0004_jobs_run_id.sql",
      "0005_brand_assets.sql",
    ]);
    expect(await migrate(url)).toEqual([]); // idempotent
    ({ db, close } = connect(url, 4));
    const [u1] = await db.insert(users).values({ email: "a@example.test" }).returning();
    const [u2] = await db.insert(users).values({ email: "b@example.test" }).returning();
    ids.u1 = u1!.id;
    ids.u2 = u2!.id;
    // Workspace rows are created with the tenant set (WITH CHECK requires it).
    const w1 = "11111111-1111-4111-8111-111111111111";
    const w2 = "22222222-2222-4222-8222-222222222222";
    await withWorkspace(db, w1, (tx) =>
      tx.insert(workspaces).values({ id: w1, name: "A", slug: "a", createdBy: ids.u1 }),
    );
    await withWorkspace(db, w2, (tx) =>
      tx.insert(workspaces).values({ id: w2, name: "B", slug: "b", createdBy: ids.u2 }),
    );
    await withWorkspace(db, w1, (tx) =>
      tx.insert(memberships).values({ workspaceId: w1, userId: ids.u1, role: "owner" }),
    );
    await withWorkspace(db, w2, (tx) =>
      tx.insert(memberships).values({ workspaceId: w2, userId: ids.u2, role: "owner" }),
    );
    ids.w1 = w1;
    ids.w2 = w2;
  }, 60_000);

  afterAll(async () => {
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.end();
  });

  it("a workspace only sees its own rows", async () => {
    const seen = await withWorkspace(db, ids.w1, (tx) => tx.select().from(memberships));
    expect(seen.map((m) => m.workspaceId)).toEqual([ids.w1]);
    const ws = await withWorkspace(db, ids.w2, (tx) => tx.select().from(workspaces));
    expect(ws.map((w) => w.slug)).toEqual(["b"]);
  });

  it("cannot write into another workspace", async () => {
    expect(
      await pgError(
        withWorkspace(db, ids.w1, (tx) =>
          tx.insert(memberships).values({ workspaceId: ids.w2, userId: ids.u1, role: "editor" }),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("cannot update or delete another workspace's rows (silently matches nothing)", async () => {
    const r = await withWorkspace(db, ids.w1, (tx) =>
      tx.delete(memberships).where(eq(memberships.workspaceId, ids.w2)).returning(),
    );
    expect(r).toEqual([]);
    const still = await withWorkspace(db, ids.w2, (tx) => tx.select().from(memberships));
    expect(still).toHaveLength(1);
  });

  it("unique (workspace_id, user_id)", async () => {
    expect(
      await pgError(
        withWorkspace(db, ids.w1, (tx) =>
          tx.insert(memberships).values({ workspaceId: ids.w1, userId: ids.u1, role: "viewer" }),
        ),
      ),
    ).toMatch(/memberships_workspace_user_uq|duplicate key/);
  });

  it("rejects malformed workspace ids", async () => {
    await expect(withWorkspace(db, "1 OR 1=1", async () => 1)).rejects.toThrow(/invalid workspace id/);
  });

  it("projects are tenant-scoped; versions are immutable; cost keeps 6 decimals", async () => {
    const pid = await withWorkspace(db, ids.w1, async (tx) => {
      const [p] = await tx.insert(projects).values({ workspaceId: ids.w1, title: "Lãi kép" }).returning();
      await tx.insert(projectVersions).values({
        workspaceId: ids.w1,
        projectId: p!.id,
        seq: 1,
        spec: { a: 1 },
        specVersion: "0.1.0",
        author: "ai",
      });
      await tx.insert(usageRecords).values({
        workspaceId: ids.w1,
        projectId: p!.id,
        step: "script",
        provider: "fpt",
        model: "gemma-4-31B-it",
        tokensIn: 100,
        tokensOut: 50,
        costUsd: "0.000038",
      });
      return p!.id;
    });
    expect(await withWorkspace(db, ids.w2, (tx) => tx.select().from(projects))).toEqual([]);
    expect(
      await pgError(
        withWorkspace(db, ids.w1, (tx) =>
          tx.update(projectVersions).set({ message: "x" }).where(eq(projectVersions.projectId, pid)),
        ),
      ),
    ).toMatch(/immutable/);
    const [u] = await withWorkspace(db, ids.w1, (tx) => tx.select().from(usageRecords));
    expect(u!.costUsd).toBe("0.000038");
  });

  it("a user sees only their own memberships and workspaces (withUser)", async () => {
    const r = await withUser(db, ids.u1, async (tx) => ({
      m: await tx.select().from(memberships),
      w: await tx.select().from(workspaces),
    }));
    expect(r.m.map((m) => m.workspaceId)).toEqual([ids.w1]);
    expect(r.w.map((w) => w.slug)).toEqual(["a"]);
    // Read-only: a user context cannot add memberships.
    expect(
      await pgError(
        withUser(db, ids.u1, (tx) =>
          tx.insert(memberships).values({ workspaceId: ids.w2, userId: ids.u1, role: "owner" }),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("chat messages are tenant-scoped", async () => {
    await withWorkspace(db, ids.w1, async (tx) => {
      const [p] = await tx.insert(projects).values({ workspaceId: ids.w1, title: "Chat" }).returning();
      await tx.insert(chatMessages).values({
        workspaceId: ids.w1,
        projectId: p!.id,
        role: "user",
        kind: "edit",
        content: "Đổi tiêu đề",
      });
    });
    expect(await withWorkspace(db, ids.w2, (tx) => tx.select().from(chatMessages))).toEqual([]);
    expect(await withWorkspace(db, ids.w1, (tx) => tx.select().from(chatMessages))).toHaveLength(1);
  });

  it("assets are tenant-scoped and de-duplicated per workspace by sha256", async () => {
    const sha = "a".repeat(64);
    const row = (ws: string) => ({
      workspaceId: ws,
      kind: "image" as const,
      name: "logo.png",
      storageKey: `ws/${ws}/assets/${sha}`,
      mime: "image/png",
      bytes: 1234,
      sha256: sha,
    });
    await withWorkspace(db, ids.w1, (tx) => tx.insert(assets).values(row(ids.w1)));
    expect(await pgError(withWorkspace(db, ids.w1, (tx) => tx.insert(assets).values(row(ids.w1))))).toMatch(
      /assets_workspace_sha_uq|duplicate key/,
    );
    await withWorkspace(db, ids.w2, (tx) => tx.insert(assets).values(row(ids.w2))); // same file, other tenant: ok
    expect(await withWorkspace(db, ids.w2, (tx) => tx.select().from(assets))).toHaveLength(1);
    const [a] = await withWorkspace(db, ids.w1, (tx) => tx.select().from(assets));
    await withWorkspace(db, ids.w1, (tx) =>
      tx
        .insert(brandKits)
        .values({
          workspaceId: ids.w1,
          name: "Brand",
          logoAssetId: a!.id,
          colors: { accent: "#f7c948" },
          isDefault: true,
        }),
    );
    expect(
      await pgError(
        withWorkspace(db, ids.w1, (tx) =>
          tx.insert(brandKits).values({ workspaceId: ids.w1, name: "B2", isDefault: true }),
        ),
      ),
    ).toMatch(/brand_kits_default_uq|duplicate key/);
    expect(await withWorkspace(db, ids.w2, (tx) => tx.select().from(brandKits))).toEqual([]);
  });
});
