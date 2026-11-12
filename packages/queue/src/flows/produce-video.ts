// BullMQ flow for "produce video" (T083): one job per pipeline stage, chained parent<-child so stages run in
// order on their own worker queues (ai / audio / render). Job ids are deterministic, so enqueueing the same
// version + input twice does not create duplicate work (idempotency, FR pipeline).
import { FlowProducer, type ConnectionOptions, type FlowJob, type JobNode } from "bullmq";
import { inputHash } from "../jobs";

export interface StageDef {
  name: string;
  queue: "ai" | "audio" | "render" | "align";
}

export interface ProduceJobData<I = unknown> {
  workspaceId: string;
  projectId: string;
  versionId: string;
  /** Shared artifact directory (local volume in dev; object storage prefix in production). */
  workDir: string;
  input: I;
}

/** Build the chained flow tree: the last stage is the root, the first stage the deepest leaf. */
export function produceFlowTree<I>(
  stages: StageDef[],
  data: ProduceJobData<I>,
  opts: { prefix: string; priority: number },
): FlowJob {
  const hash = inputHash(data.input);
  let node: FlowJob | undefined;
  for (const s of stages) {
    const job: FlowJob = {
      name: s.name,
      queueName: s.queue,
      prefix: opts.prefix,
      data: { ...data, stage: s.name },
      opts: {
        jobId: `${data.versionId}.${s.name}.${hash}`,
        priority: opts.priority,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
        failParentOnFailure: true,
      },
      ...(node ? { children: [node] } : {}),
    };
    node = job;
  }
  if (!node) throw new Error("no stages");
  return node;
}

export async function enqueueProduceVideo<I>(
  connection: ConnectionOptions,
  stages: StageDef[],
  data: ProduceJobData<I>,
  opts: { prefix?: string; priority?: number } = {},
): Promise<JobNode> {
  const producer = new FlowProducer({ connection, prefix: opts.prefix ?? "mkv" });
  try {
    return await producer.add(
      produceFlowTree(stages, data, { prefix: opts.prefix ?? "mkv", priority: opts.priority ?? 5 }),
    );
  } finally {
    await producer.close();
  }
}
