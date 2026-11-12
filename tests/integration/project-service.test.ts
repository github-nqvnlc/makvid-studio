// M3 project service end to end on the compose stack (Postgres + Valkey + SeaweedFS) with mock providers:
// create -> ready, chat edit -> new version re-rendering only the touched scenes (T095), clarify without a
// version, undo / redo / restore / duplicate (T100), optimistic lock + busy guard.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests test integration/project-service
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS } from "@makvid/ai";
import {
  connect,
  memberships,
  migrate,
  projects,
  projectVersions,
  users,
  withWorkspace,
  workspaces,
  type Db,
} from "@makvid/db";
import {
  chatProject,
  createProject,
  dbSink,
  duplicateProject,
  latestProgress,
  mockContextFactory,
  ProjectError,
  projectView,
  redoProject,
  restoreVersion,
  startStageWorker,
  undoProject,
  type ServiceDeps,
} from "@makvid/pipeline";
import { calls, mockLlm } from "@makvid/pipeline/testing";
import { connectionFromUrl } from "@makvid/queue";
import { createObjectStore } from "@makvid/storage";
import type { VideoSpec } from "@makvid/spec";

const root = resolve(__dirname, "../..");
const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_svc_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);
const prefix = `mkvsvc${process.pid}`;

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("project service (M3)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let deps: ServiceDeps;
  let workers: ReturnType<typeof startStageWorker>[] = [];
  const ws = "33333333-3333-4333-8333-333333333333";
  let userId = "";
  const ai = {
    llm: createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS }),
    onUsage: () => undefined,
  };

  beforeAll(async () => {
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    await migrate(url);
    ({ db, close } = connect(url, 6));
    const [u] = await db.insert(users).values({ email: "svc@example.test", name: "Svc" }).returning();
    userId = u!.id;
    await withWorkspace(db, ws, async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: ws, name: "Svc", slug: `svc-${process.pid}`, createdBy: userId });
      await tx.insert(memberships).values({ workspaceId: ws, userId, role: "owner" });
    });
    const store = createObjectStore({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
      region: "us-east-1",
      bucket: process.env.S3_BUCKET ?? "makvid-dev",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "makvid-dev-access",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "makvid-dev-secret-change-me",
      forcePathStyle: true,
    });
    await store.ensureBucket();
    const connection = connectionFromUrl();
    deps = {
      db,
      connection,
      store,
      workRoot: mkdtempSync(join(tmpdir(), "mkv-svc-")),
      stylesRoot: join(root, "packages", "styles"),
      prefix,
    };
    const makeCtx = mockContextFactory(deps.stylesRoot);
    const hooks = dbSink(db, store);
    workers = (["ai", "audio", "render"] as const).map((q) =>
      startStageWorker(q, makeCtx, { connection, prefix, hooks }),
    );
  }, 120_000);

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    for (const q of ["ai", "audio", "render"]) {
      const queue = new Queue(q, { connection: deps.connection, prefix });
      await queue.obliterate({ force: true });
      await queue.close();
    }
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.end();
  });

  async function settled(projectId: string, timeoutMs = 300_000) {
    const t0 = Date.now();
    for (;;) {
      const p = await latestProgress(db, ws, projectId);
      if (p && ["ready", "needs_attention", "failed"].includes(p.status)) return p;
      if (Date.now() - t0 > timeoutMs) throw new Error(`project still ${p?.status}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const titleOf = (spec: VideoSpec | null) => spec?.scenes.find((s) => s.templateId === "title")?.slots.title;

  let projectId = "";
  let v1 = "";

  it("creates a project and produces the first version with downloadable files", async () => {
    projectId = await createProject(deps, {
      workspaceId: ws,
      userId,
      prompt: "Lãi kép là gì",
      aspects: ["9:16"],
      durationSec: 30,
      mode: "auto",
      voiceId: "vits:banmai",
    });
    expect((await settled(projectId)).status).toBe("ready");
    const view = await projectView(deps, ws, projectId);
    expect(view.project.title).toBe("Sức mạnh lãi kép"); // title from the script
    expect(view.versions).toHaveLength(1);
    expect(view.outputs).toHaveLength(1);
    const res = await fetch(view.outputs[0]!.video!);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    v1 = view.project.headVersionId!;
  });

  it("a chat edit makes a new version and re-renders only the touched scenes", async () => {
    const before = calls.renders;
    const r = await chatProject(deps, ai, ws, projectId, "Đổi tiêu đề thành: Lãi kép thần kỳ");
    expect(r.kind).toBe("edit");
    expect((await settled(projectId)).status).toBe("ready");
    const view = await projectView(deps, ws, projectId);
    expect(view.project.headVersionId).toBe(r.versionId);
    expect(titleOf(view.spec)).toBe("Lãi kép thần kỳ");
    expect(view.versions.map((v) => v.seq)).toEqual([1, 2]);
    const rendered = calls.renders - before;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(view.spec!.scenes.length); // touched scene + neighbours, not all scenes
    expect(view.chat.map((c) => c.role)).toEqual(["user", "assistant"]);
  });

  it("an ambiguous request gets one question and no new version", async () => {
    const r = await chatProject(deps, ai, ws, projectId, "Làm cho đẹp hơn");
    expect(r).toEqual({ kind: "clarify", reply: "Bạn muốn thay đổi điều gì ở cảnh nào?" });
    expect((await projectView(deps, ws, projectId)).versions).toHaveLength(2);
  });

  it("undo, redo and restore move through history without losing versions", async () => {
    expect(await undoProject(deps, ws, projectId)).toBe(v1);
    let view = await projectView(deps, ws, projectId);
    expect(titleOf(view.spec)).toBe("Sức mạnh của lãi kép");
    expect(view.canRedo).toBe(true);
    expect(view.outputs).toHaveLength(1); // the old version's files are still there
    await redoProject(deps, ws, projectId);
    expect(titleOf((await projectView(deps, ws, projectId)).spec)).toBe("Lãi kép thần kỳ");
    await expect(redoProject(deps, ws, projectId)).rejects.toThrow(ProjectError);

    const v3 = await restoreVersion(deps, ws, projectId, v1);
    expect((await settled(projectId)).status).toBe("ready");
    view = await projectView(deps, ws, projectId);
    expect(view.project.headVersionId).toBe(v3);
    expect(view.versions.map((v) => v.seq)).toEqual([1, 2, 3]);
    expect(titleOf(view.spec)).toBe("Sức mạnh của lãi kép");
  });

  it("refuses edits while rendering and on a stale head (optimistic lock)", async () => {
    await withWorkspace(db, ws, (tx) =>
      tx.update(projects).set({ status: "rendering" }).where(eq(projects.id, projectId)),
    );
    await expect(chatProject(deps, ai, ws, projectId, "Đổi tiêu đề thành: X")).rejects.toMatchObject({
      code: "busy",
    });
    await withWorkspace(db, ws, (tx) =>
      tx.update(projects).set({ status: "ready" }).where(eq(projects.id, projectId)),
    );
    // Two edits racing on the same head: exactly one wins.
    const results = await Promise.allSettled([
      chatProject(deps, ai, ws, projectId, "Đổi tiêu đề thành: A"),
      chatProject(deps, ai, ws, projectId, "Đổi tiêu đề thành: B"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(ProjectError);
    await settled(projectId);
  });

  it("duplicates a project into an independent copy", async () => {
    const copy = await duplicateProject(deps, ws, projectId, userId);
    expect((await settled(copy)).status).toBe("ready");
    const view = await projectView(deps, ws, copy);
    expect(view.project.title).toMatch(/bản sao/);
    expect(view.versions).toHaveLength(1);
    expect(view.outputs).toHaveLength(1);
    const own = await withWorkspace(db, ws, (tx) =>
      tx.select().from(projectVersions).where(eq(projectVersions.projectId, projectId)),
    );
    expect(own.length).toBeGreaterThanOrEqual(4);
  });
});
