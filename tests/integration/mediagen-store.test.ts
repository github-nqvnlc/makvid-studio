// T124 on the compose stack: the DB-backed media-gen cache stores the image as an `ai` asset, a repeated request
// is served from storage without a provider call, and other workspaces cannot see the cached entry (RLS).
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests test integration/mediagen-store
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assets,
  connect,
  mediaGenCache,
  migrate,
  users,
  withWorkspace,
  workspaces,
  type Db,
} from "@makvid/db";
import { CachedMediaGen, MockMediaGen, type MediaGenUsage } from "@makvid/media";
import { dbMediaGenStore } from "@makvid/pipeline";
import { createObjectStore, type ObjectStore } from "@makvid/storage";

const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_mgen_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("media-gen cache in the asset library", () => {
  let db: Db;
  let close: () => Promise<void>;
  let store: ObjectStore;
  const wsA = "44444444-4444-4444-8444-444444444444";
  const wsB = "55555555-5555-4555-8555-555555555555";

  beforeAll(async () => {
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    await migrate(url);
    ({ db, close } = connect(url, 4));
    const [u] = await db.insert(users).values({ email: "mgen@example.test", name: "M" }).returning();
    for (const id of [wsA, wsB]) {
      await withWorkspace(db, id, (tx) =>
        tx
          .insert(workspaces)
          .values({ id, name: id.slice(0, 4), slug: `mgen-${id.slice(0, 4)}`, createdBy: u!.id }),
      );
    }
    store = createObjectStore({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
      region: "us-east-1",
      bucket: process.env.S3_BUCKET ?? "makvid-dev",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "makvid-dev-access",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "makvid-dev-secret-change-me",
      forcePathStyle: true,
    });
    await store.ensureBucket();
  }, 120_000);

  afterAll(async () => {
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await a.end();
  });

  it("stores once, reuses on repeat, isolates workspaces", async () => {
    const req = { prompt: "Bản đồ Việt Nam phong cách tối giản", width: 1080, height: 1080, seed: 3 };
    const inner = new MockMediaGen();
    const usage: MediaGenUsage[] = [];
    const genA = new CachedMediaGen(inner, dbMediaGenStore(db, store, wsA), (u) => void usage.push(u));

    const first = await genA.generateImage(req);
    const again = await genA.generateImage(req);
    expect(first.cached).toBe(false);
    expect(again.cached).toBe(true);
    expect(again.image.equals(first.image)).toBe(true);
    expect(inner.calls).toBe(1);
    expect(usage).toHaveLength(1);

    const rows = await withWorkspace(db, wsA, (tx) =>
      tx.select().from(assets).where(eq(assets.workspaceId, wsA)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ origin: "ai", kind: "generated_image", mime: "image/svg+xml" });
    const cacheRows = await withWorkspace(db, wsA, (tx) => tx.select().from(mediaGenCache));
    expect(cacheRows).toHaveLength(1);

    // Workspace B sees nothing from A and pays for its own image.
    expect(await withWorkspace(db, wsB, (tx) => tx.select().from(mediaGenCache))).toHaveLength(0);
    const genB = new CachedMediaGen(inner, dbMediaGenStore(db, store, wsB));
    expect((await genB.generateImage(req)).cached).toBe(false);
    expect(inner.calls).toBe(2);
  });
});
