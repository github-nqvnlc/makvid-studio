// Entry point shared by apps/worker-{ai,audio,render}: provider context from env, and persistence
// (dbSink: project status, versions, outputs; batch rows) whenever a database is configured.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@makvid/db";
import { isBlockedAddress } from "@makvid/media";
import { connectionFromUrl } from "@makvid/queue";
import { configFromEnv, createObjectStore } from "@makvid/storage";
import { withBatchHooks, type BatchGate } from "./batch";
import { billingGate, withQuotaHooks } from "./quota";
import { startWebhookWorker, withWebhookHooks } from "./webhooks";
import type { ServiceDeps } from "./service";
import { dbSink } from "./sink";
import { contextFromEnv, startStageWorker } from "./worker";
import { distributedPool, startSceneWorker } from "./distributed";
import { remoteFixer, startQaFixWorker } from "./qa-fix";
import { stubRenderer } from "./testing";
import { createRenderer } from "@makvid/renderer";

export async function runWorkerApp(
  queue: "ai" | "audio" | "render",
  opts: { gate?: (deps: ServiceDeps) => BatchGate } = {},
): Promise<void> {
  const stylesRoot =
    process.env.MAKVID_STYLES_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "styles");
  const db = process.env.DATABASE_URL ? connect(process.env.DATABASE_URL, 4) : undefined;
  const store = db ? createObjectStore(configFromEnv()) : undefined;
  // Object storage may still be starting (compose, restarts): retry for up to two minutes instead of crashing.
  for (let attempt = 1; store; attempt++) {
    try {
      await store.ensureBucket();
      break;
    } catch (e) {
      if (attempt >= 40) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const connection = connectionFromUrl();
  const prefix = process.env.QUEUE_PREFIX || undefined;
  const deps: ServiceDeps | undefined =
    db && store
      ? {
          db: db.db,
          connection,
          store,
          workRoot: process.env.WORK_ROOT || resolve(stylesRoot, "..", "..", ".work"),
          stylesRoot,
          ...(prefix ? { prefix } : {}),
          watermark: async (ws) => (await billingGate(db.db).watermark?.(ws)) ?? false,
        }
      : undefined;
  // Distributed rendering (T132): RENDER_DISTRIBUTED=1 makes every render worker also render single scenes
  // for any video, and a video's render stage fan its scenes out to all of them.
  const distributed = queue === "render" && process.env.RENDER_DISTRIBUTED === "1" && !!store;
  const renderer =
    process.env.MAKVID_MOCK_PROVIDERS === "1"
      ? stubRenderer
      : queue === "render"
        ? createRenderer("hyperframes", { workers: Number(process.env.RENDER_WORKERS ?? 4) })
        : undefined;
  const sceneWorker =
    distributed && renderer
      ? startSceneWorker(renderer, store!, connection, {
          ...(prefix ? { prefix } : {}),
          concurrency: Number(process.env.RENDER_SCENE_CONCURRENCY ?? 1),
        })
      : null;
  // RENDER_REMOTE_QA_FIX=1 (Docker): the render worker has no internet, so QA's AI text fixes run on
  // worker-ai through the qa-fix queue and the render worker needs no provider key.
  const remoteQaFix = queue === "render" && process.env.RENDER_REMOTE_QA_FIX === "1";
  const makeCtx = contextFromEnv(stylesRoot, renderer, !remoteQaFix);
  const worker = startStageWorker(queue, makeCtx, {
    connection,
    ...(remoteQaFix ? { textFixer: remoteFixer(connection, prefix ? { prefix } : {}) } : {}),
    ...(distributed
      ? {
          scenePool: (d: { workspaceId: string }) =>
            distributedPool({
              store: store!,
              connection,
              workspaceId: d.workspaceId,
              ...(prefix ? { prefix } : {}),
            }),
        }
      : {}),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
    ...(prefix ? { prefix } : {}),
    // Quota (settle) runs before the batch hook, so a finished row frees its quota before the next one starts.
    ...(deps
      ? {
          hooks: withBatchHooks(
            withWebhookHooks(
              withQuotaHooks(dbSink(deps.db, deps.store), deps.db),
              deps.db,
              connection,
              prefix,
            ),
            deps,
            opts.gate?.(deps) ?? billingGate(deps.db),
          ),
        }
      : {}),
  });
  // Webhook deliveries run next to the AI stages (light, network-bound).
  // Mock stacks only (E2E): MAKVID_WEBHOOK_TEST_PORT lets deliveries reach a receiver on 127.0.0.1:<port>.
  const testPort =
    process.env.MAKVID_MOCK_PROVIDERS === "1" ? Number(process.env.MAKVID_WEBHOOK_TEST_PORT || 0) : 0;
  const fetchOpts = testPort
    ? {
        allowedPorts: [80, 443, testPort],
        isBlocked: (ip: string) => ip !== "127.0.0.1" && isBlockedAddress(ip),
      }
    : undefined;
  const hooksWorker =
    queue === "ai" && deps
      ? startWebhookWorker(deps.db, connection, {
          ...(prefix ? { prefix } : {}),
          ...(fetchOpts ? { fetchOpts } : {}),
        })
      : null;
  // worker-ai answers the render workers' QA text-fix requests with its LLM.
  const qaFixWorker =
    queue === "ai"
      ? startQaFixWorker(
          makeCtx(deps?.workRoot ?? stylesRoot, { onUsage: () => undefined, onProgress: () => undefined })
            .llm,
          connection,
          prefix ? { prefix } : {},
        )
      : null;
  const stop = async () => {
    await qaFixWorker?.close();
    await hooksWorker?.close();
    await sceneWorker?.close();
    await worker.close();
    await db?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}
