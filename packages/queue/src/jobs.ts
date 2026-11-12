// Job primitives on BullMQ (Valkey). Every pipeline step is a job whose id is derived from
// (versionId, step, inputHash): re-enqueuing the same work is a no-op (idempotency, FR pipeline).
import { createHash } from "node:crypto";
import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions } from "bullmq";

export const PIPELINE_STEPS = [
  "research",
  "script",
  "storyboard",
  "spec",
  "tts",
  "align",
  "render",
  "mux",
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** preview > single > batch (BullMQ: lower number = higher priority). */
export const PRIORITY = { preview: 1, single: 5, batch: 10 } as const;
export type PriorityClass = keyof typeof PRIORITY;

/** Queue per worker kind, so each worker type scales independently. */
export const QUEUE_FOR_STEP: Record<PipelineStep, "ai" | "audio" | "render" | "align"> = {
  research: "ai",
  script: "ai",
  storyboard: "ai",
  spec: "ai",
  tts: "audio",
  align: "align",
  render: "render",
  mux: "render",
};

/** Stable hash of a step's inputs (key order independent). */
export function inputHash(input: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(canon(input)))
    .digest("hex")
    .slice(0, 32);
}

/** Deterministic job id. BullMQ ids must not contain ":" — use "." separators. */
export function jobId(versionId: string, step: PipelineStep, hash: string): string {
  if (!/^[\w-]+$/.test(versionId)) throw new Error("invalid versionId");
  return `${versionId}.${step}.${hash}`;
}

export interface StepPayload<T = unknown> {
  workspaceId: string;
  projectId: string;
  versionId: string;
  step: PipelineStep;
  input: T;
}

export interface UsageEvent {
  workspaceId: string;
  projectId: string;
  versionId: string;
  step: PipelineStep;
  provider: string;
  units: number;
  unit: "tokens" | "chars" | "seconds" | "frames" | "images";
  costUsd: number;
}

/** Cost hook: every provider call reports usage (constitution VIII); persisted to usage_records in M2. */
export type CostHook = (e: UsageEvent) => void | Promise<void>;

export interface EnqueueResult {
  id: string;
  created: boolean; // false when an identical job already exists (idempotent no-op)
}

export class PipelineQueues {
  private queues = new Map<string, Queue>();
  constructor(
    private readonly connection: ConnectionOptions,
    private readonly prefix = "mkv",
  ) {}

  queue(name: "ai" | "audio" | "render" | "align"): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection, prefix: this.prefix });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueue<T>(
    payload: StepPayload<T>,
    priority: PriorityClass,
    opts: Partial<JobsOptions> = {},
  ): Promise<EnqueueResult> {
    const id = jobId(payload.versionId, payload.step, inputHash(payload.input));
    const q = this.queue(QUEUE_FOR_STEP[payload.step]);
    const existing = await q.getJob(id);
    if (existing) return { id, created: false };
    await q.add(payload.step, payload, {
      jobId: id,
      priority: PRIORITY[priority],
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
      ...opts,
    });
    return { id, created: true };
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

export function createWorker<T, R>(
  name: "ai" | "audio" | "render" | "align",
  connection: ConnectionOptions,
  handler: (job: Job<StepPayload<T>>) => Promise<R>,
  opts: { concurrency?: number; prefix?: string } = {},
): Worker<StepPayload<T>, R> {
  return new Worker<StepPayload<T>, R>(name, handler, {
    connection,
    prefix: opts.prefix ?? "mkv",
    concurrency: opts.concurrency ?? 1,
  });
}

export function connectionFromUrl(
  url: string = process.env.VALKEY_URL ?? "redis://localhost:6379",
): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    maxRetriesPerRequest: null,
  };
}
