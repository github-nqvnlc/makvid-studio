// Process-wide singletons for the web server: database, object store, queue connection, LLM (chat edits).
// Reused across hot reloads in dev via globalThis.
import "server-only";
import { join, resolve } from "node:path";
import { configFromEnv as llmConfigFromEnv, createLlm, DEFAULT_STEPS } from "@makvid/ai";
import { planOf } from "@makvid/billing";
import { connect, type Db } from "@makvid/db";
import type { PipelineContext, ServiceDeps } from "@makvid/pipeline";
import { mockLlm } from "@makvid/pipeline/testing";
import { connectionFromUrl } from "@makvid/queue";
import { configFromEnv, createObjectStore } from "@makvid/storage";

/** Monorepo root (style packs, voice library); overridable for the container image. */
export const REPO_ROOT = process.env.MAKVID_ROOT ?? resolve(process.cwd(), "../..");

interface Singletons {
  db: Db;
  deps: ServiceDeps;
  ai: Pick<PipelineContext, "llm" | "onUsage">;
}
const g = globalThis as typeof globalThis & { __makvid?: Singletons };

function create(): Singletons {
  const { db } = connect(process.env.DATABASE_URL, 10);
  const store = createObjectStore(configFromEnv());
  const deps: ServiceDeps = {
    db,
    connection: connectionFromUrl(),
    store,
    workRoot: process.env.WORK_ROOT || join(REPO_ROOT, ".work"),
    stylesRoot: join(REPO_ROOT, "packages", "styles"),
    ...(process.env.QUEUE_PREFIX ? { prefix: process.env.QUEUE_PREFIX } : {}),
    // Free-plan watermark follows the workspace's current plan (US6).
    watermark: async (workspaceId) => (await planOf(db, workspaceId)).watermark,
  };
  const llm =
    process.env.MAKVID_MOCK_PROVIDERS === "1"
      ? createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS })
      : createLlm(llmConfigFromEnv());
  return { db, deps, ai: { llm, onUsage: () => undefined } };
}

export function server(): Singletons {
  g.__makvid ??= create();
  return g.__makvid;
}

// Payment providers (ADR 0004), configured from env once per process.
import { paymentsFromEnv, type Payments } from "@makvid/billing";
const gp = globalThis as typeof globalThis & { __makvidPayments?: Payments };
export function payments(): Payments {
  gp.__makvidPayments ??= paymentsFromEnv();
  return gp.__makvidPayments;
}
