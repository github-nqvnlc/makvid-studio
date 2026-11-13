// Drizzle + postgres.js, SQL migrations, and the RLS helper withWorkspace().
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function connect(
  url: string = process.env.DATABASE_URL ?? "",
  max = 10,
): { db: Db; close: () => Promise<void> } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max, onnotice: () => undefined });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` in a transaction scoped to one workspace: switches to the non-owner role makvid_app and sets
 * app.workspace_id, so row-level security policies filter every tenant table.
 */
export async function withWorkspace<T>(db: Db, workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(workspaceId)) throw new Error("invalid workspace id");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE makvid_app`);
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`);
    return fn(tx);
  });
}

/** Run `fn` as makvid_app with app.user_id set: the user may read only their own memberships/workspaces. */
export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(userId)) throw new Error("invalid user id");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE makvid_app`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/**
 * Run `fn` as makvid_app with app.scope = 'service': full access across workspaces. Only for flows that
 * start without a tenant and must find it first (payment webhooks, API-key lookup, invitation acceptance,
 * batch dispatch from workers). Callers MUST filter by workspace explicitly once they know it.
 */
export async function withService<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE makvid_app`);
    await tx.execute(sql`SELECT set_config('app.scope', 'service', true)`);
    return fn(tx);
  });
}

/** Read-only view across every workspace for the platform admin area (US9). Writes are refused by RLS. */
export async function withAdmin<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE makvid_app`);
    await tx.execute(sql`SELECT set_config('app.scope', 'admin', true)`);
    return fn(tx);
  });
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Apply pending SQL migrations in file order; each runs in its own transaction and is recorded. */
export async function migrate(url: string = process.env.DATABASE_URL ?? ""): Promise<string[]> {
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await client`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const done = new Set((await client`SELECT name FROM _migrations`).map((r) => r.name as string));
    const applied: string[] = [];
    for (const file of readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (done.has(file)) continue;
      const text = readFileSync(join(migrationsDir, file), "utf8");
      await client.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
      applied.push(file);
    }
    return applied;
  } finally {
    await client.end({ timeout: 5 });
  }
}
