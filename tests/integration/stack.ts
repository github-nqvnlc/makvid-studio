// Shared setup for integration tests on the compose stack (Postgres + Valkey + SeaweedFS) with mock providers:
// a fresh database, one workspace + owner, object store, BullMQ workers (ai / audio / render) in-process.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { Queue, type Worker } from "bullmq";
import { connect, memberships, migrate, users, withWorkspace, workspaces, type Db } from "@makvid/db";
import {
  dbSink,
  latestProgress,
  mockContextFactory,
  startStageWorker,
  withBatchHooks,
  type BatchGate,
  type ServiceDeps,
  type StageHooks,
} from "@makvid/pipeline";
import { connectionFromUrl } from "@makvid/queue";
import { createObjectStore } from "@makvid/storage";

export const repoRoot = resolve(__dirname, "../..");
const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";

export interface Stack {
  db: Db;
  deps: ServiceDeps;
  ws: string;
  userId: string;
  /** Stage start order as "projectId:stage" (priority tests). */
  starts: string[];
  startWorkers(o?: {
    concurrency?: number;
    gate?: BatchGate;
    queues?: Array<"ai" | "audio" | "render">;
  }): void;
  stopWorkers(): Promise<void>;
  settled(projectId: string, timeoutMs?: number): Promise<{ status: string }>;
  teardown(): Promise<void>;
}

export async function createStack(name: string, ws: string): Promise<Stack> {
  const dbName = `makvid_${name}_${process.pid}`;
  const url = admin.replace(/\/[^/]*$/, `/${dbName}`);
  const prefix = `mkv${name}${process.pid}`;
  const a = postgres(admin, { max: 1, onnotice: () => undefined });
  await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
  await a.unsafe(`CREATE DATABASE ${dbName}`);
  await a.end();
  await migrate(url);
  const { db, close } = connect(url, 8);
  const [u] = await db
    .insert(users)
    .values({ email: `${name}@example.test`, name })
    .returning();
  const userId = u!.id;
  await withWorkspace(db, ws, async (tx) => {
    await tx.insert(workspaces).values({ id: ws, name, slug: `${name}-${process.pid}`, createdBy: userId });
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
  const deps: ServiceDeps = {
    db,
    connection: connectionFromUrl(),
    store,
    workRoot: mkdtempSync(join(tmpdir(), `mkv-${name}-`)),
    stylesRoot: join(repoRoot, "packages", "styles"),
    prefix,
  };
  let workers: Worker[] = [];
  const starts: string[] = [];
  const stack: Stack = {
    db,
    deps,
    ws,
    userId,
    starts,
    startWorkers(o = {}) {
      const base = dbSink(db, store);
      const hooks: StageHooks = withBatchHooks(
        {
          ...base,
          onStageStart: async (d, stage) => {
            starts.push(`${d.projectId}:${stage}`);
            await base.onStageStart?.(d, stage);
          },
        },
        deps,
        o.gate,
      );
      const makeCtx = mockContextFactory(deps.stylesRoot);
      const started = (o.queues ?? (["ai", "audio", "render"] as const)).map((q) =>
        startStageWorker(q, makeCtx, {
          connection: deps.connection,
          prefix,
          hooks,
          ...(o.concurrency ? { concurrency: o.concurrency } : {}),
        }),
      );
      workers.push(...started);
    },
    async stopWorkers() {
      await Promise.all(workers.map((w) => w.close()));
      workers = [];
    },
    async settled(projectId, timeoutMs = 300_000) {
      const t0 = Date.now();
      for (;;) {
        const p = await latestProgress(db, ws, projectId);
        if (p && ["ready", "needs_attention", "failed"].includes(p.status)) return p;
        if (Date.now() - t0 > timeoutMs) throw new Error(`project still ${p?.status}`);
        await new Promise((r) => setTimeout(r, 300));
      }
    },
    async teardown() {
      await stack.stopWorkers();
      for (const q of ["ai", "audio", "render"]) {
        const queue = new Queue(q, { connection: deps.connection, prefix });
        await queue.obliterate({ force: true });
        await queue.close();
      }
      await close();
      const b = postgres(admin, { max: 1, onnotice: () => undefined });
      await b.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
      await b.end();
    },
  };
  return stack;
}
