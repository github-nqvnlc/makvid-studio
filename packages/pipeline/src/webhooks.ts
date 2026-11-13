// Outgoing webhooks (US7, T147; FR-053). Events: video.completed, video.failed, batch.completed.
// - Signature header X-MakVid-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>.
// - Endpoint secrets are stored encrypted (AES-256-GCM, key derived from MAKVID_SECRET_KEY).
// - Each (endpoint, event id) is delivered once: a webhook_deliveries row + a BullMQ job with exponential
//   backoff retries. Delivery goes through safeFetch (no private/internal addresses, no redirects).
// - Payloads carry ids, status and a user-friendly message only (no technical detail).
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { createLogger } from "@makvid/queue";
import { and, eq } from "drizzle-orm";
import { webhookDeliveries, webhookEndpoints, withService, withWorkspace, type Db } from "@makvid/db";
import { safeFetch, SafeFetchError, type SafeFetchOptions } from "@makvid/media";

export const WEBHOOK_EVENTS = ["video.completed", "video.failed", "batch.completed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export const WEBHOOK_QUEUE = "webhooks";
const TOLERANCE_SEC = 5 * 60;

// ---------------------------------------------------------------- secrets

const keyOf = (secret = process.env.MAKVID_SECRET_KEY) => {
  if (!secret) throw new Error("MAKVID_SECRET_KEY is not set");
  return createHash("sha256").update(`makvid-webhook:${secret}`).digest();
};

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function encryptSecret(plain: string, serverKey?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyOf(serverKey), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(enc: string, serverKey?: string): string {
  const [iv, tag, ct] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ct) throw new Error("bad secret format");
  const d = createDecipheriv("aes-256-gcm", keyOf(serverKey), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------- signature

export function signWebhook(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** What a receiver does (documented in the API docs; used by tests). */
export function verifyWebhook(
  secret: string,
  body: string,
  header: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || Math.abs(nowSec - t) > TOLERANCE_SEC || !parts.v1) return false;
  const want = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  const got = Buffer.from(parts.v1, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

// ---------------------------------------------------------------- emit

export interface WebhookPayload {
  event: WebhookEvent;
  videoId?: string;
  batchId?: string;
  status: string;
  message: string;
  createdAt: string;
}

const MESSAGES: Record<WebhookEvent, string> = {
  "video.completed": "Video is ready.",
  "video.failed": "Video could not be produced. You can retry from the app.",
  "batch.completed": "Batch finished.",
};

/** Record deliveries for every active endpoint subscribed to `event` and queue them. */
export async function emitWebhook(
  db: Db,
  connection: ConnectionOptions,
  workspaceId: string,
  eventId: string,
  data: Omit<WebhookPayload, "createdAt" | "message"> & { message?: string },
  opts: { prefix?: string } = {},
): Promise<number> {
  const payload: WebhookPayload = {
    message: MESSAGES[data.event],
    ...data,
    createdAt: new Date().toISOString(),
  };
  const ids = await withWorkspace(db, workspaceId, async (tx) => {
    const eps = await tx
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.active, true)));
    const out: string[] = [];
    for (const ep of eps.filter((e) => e.events.includes(data.event))) {
      const [d] = await tx
        .insert(webhookDeliveries)
        .values({
          workspaceId,
          endpointId: ep.id,
          eventId,
          event: data.event,
          payload: payload as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing()
        .returning({ id: webhookDeliveries.id });
      if (d) out.push(d.id);
    }
    return out;
  });
  if (!ids.length) return 0;
  const q = new Queue(WEBHOOK_QUEUE, { connection, prefix: opts.prefix ?? "mkv" });
  try {
    await q.addBulk(
      ids.map((id) => ({
        name: "deliver",
        data: { deliveryId: id },
        opts: {
          jobId: id,
          attempts: 8,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: { age: 7 * 86400 },
          removeOnFail: { age: 30 * 86400 },
        },
      })),
    );
  } finally {
    await q.close();
  }
  return ids.length;
}

// ---------------------------------------------------------------- deliver

export class WebhookDeliveryError extends Error {
  constructor(
    readonly httpStatus: number | null,
    message: string,
  ) {
    super(message);
    this.name = "WebhookDeliveryError";
  }
}

/** POST one delivery. Throws on a non-2xx answer or network error (BullMQ then retries with backoff). */
export async function deliverWebhook(
  db: Db,
  deliveryId: string,
  attempt: number,
  final: boolean,
  fetchOpts: Pick<SafeFetchOptions, "resolve" | "isBlocked" | "allowedPorts"> = {},
): Promise<"delivered" | "skipped"> {
  const row = await withService(db, async (tx) => {
    const [d] = await tx.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
    if (!d) return null;
    const [ep] = await tx.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId));
    return ep ? { d, ep } : null;
  });
  if (!row || row.d.status === "delivered" || !row.ep.active) return "skipped";
  const body = JSON.stringify(row.d.payload);
  let status: number | null = null;
  let error: string | null = null;
  try {
    const r = await safeFetch(row.ep.url, {
      method: "POST",
      body,
      timeoutMs: 10_000,
      maxBytes: 64 * 1024,
      userAgent: "MakVidStudio-Webhooks/1.0",
      headers: {
        "content-type": "application/json",
        "x-makvid-event": row.d.event,
        "x-makvid-delivery": row.d.id,
        "x-makvid-signature": signWebhook(decryptSecret(row.ep.secretEnc), body),
      },
      ...fetchOpts,
    });
    status = r.status;
    if (r.status < 200 || r.status >= 300) error = `HTTP ${r.status}`;
  } catch (e) {
    error = e instanceof SafeFetchError ? e.code : "network";
  }
  await withService(db, (tx) =>
    tx
      .update(webhookDeliveries)
      .set({
        attempts: attempt,
        lastHttpStatus: status,
        ...(error
          ? final
            ? { status: "failed" as const }
            : {}
          : { status: "delivered" as const, deliveredAt: new Date() }),
      })
      .where(eq(webhookDeliveries.id, deliveryId)),
  );
  if (error) throw new WebhookDeliveryError(status, error);
  return "delivered";
}

/** BullMQ worker for the webhooks queue (runs in worker-ai). */
export function startWebhookWorker(
  db: Db,
  connection: ConnectionOptions,
  opts: { prefix?: string; concurrency?: number; fetchOpts?: Parameters<typeof deliverWebhook>[4] } = {},
): Worker {
  const log = createLogger("webhooks");
  const w = new Worker<{ deliveryId: string }>(
    WEBHOOK_QUEUE,
    async (job) => {
      const attempt = job.attemptsMade + 1;
      const final = attempt >= (job.opts.attempts ?? 1);
      return deliverWebhook(db, job.data.deliveryId, attempt, final, opts.fetchOpts);
    },
    { connection, prefix: opts.prefix ?? "mkv", concurrency: opts.concurrency ?? 4 },
  );
  // Error code / HTTP status only: endpoint URLs are customer data and never logged.
  w.on("failed", (job, err) =>
    log.warn(
      { deliveryId: job?.data.deliveryId, attempt: job?.attemptsMade, err: err.message },
      "webhook delivery failed",
    ),
  );
  return w;
}

/** Worker hooks: emit video.completed / video.failed after the persistence hooks ran. */
export function withWebhookHooks(
  base: import("./worker").StageHooks,
  db: Db,
  connection: ConnectionOptions,
  prefix?: string,
): import("./worker").StageHooks {
  const opts = prefix ? { prefix } : {};
  return {
    ...base,
    async onStageDone(d, stage, state) {
      await base.onStageDone?.(d, stage, state);
      if (stage !== "render") return;
      await emitWebhook(
        db,
        connection,
        d.workspaceId,
        `video.completed:${d.projectId}:${d.versionId}`,
        {
          event: "video.completed",
          videoId: d.projectId,
          status: state.qa?.passed === false ? "needs_attention" : "ready",
        },
        opts,
      );
    },
    async onStageFailed(d, stage, err) {
      await base.onStageFailed?.(d, stage, err);
      await emitWebhook(
        db,
        connection,
        d.workspaceId,
        `video.failed:${d.projectId}:${d.versionId}`,
        { event: "video.failed", videoId: d.projectId, status: "failed" },
        opts,
      );
    },
  };
}
