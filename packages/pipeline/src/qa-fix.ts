// QA text fixes (M6 follow-up): when QA finds overflowing text, an LLM shortens the offending slots. The QA stage
// runs on worker-render (it needs Chrome), which has no internet in Docker; the AI call therefore runs on
// worker-ai through the "qa-fix" queue and the render side waits for the answer (RENDER_REMOTE_QA_FIX=1).
// Without that setting (CLI, tests) the fix runs in-process with the context's LLM.
import { Queue, QueueEvents, Worker, type ConnectionOptions } from "bullmq";
import { z } from "zod";
import type { LlmProvider } from "@makvid/ai";
import { createLogger } from "@makvid/queue";
import type { SlotValue } from "@makvid/spec";

export const QA_FIX_QUEUE = "qa-fix";

export const FixOutput = z.object({
  patches: z
    .array(z.object({ slot: z.string(), value: z.union([z.string(), z.array(z.string())]) }))
    .min(1)
    .max(6),
});
export type FixPatch = z.infer<typeof FixOutput>["patches"][number];

export interface FixUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/** Shorten the text slots of one scene; returns the patches and the provider usage. */
export type TextFixer = (
  slots: Record<string, SlotValue>,
  problems: string[],
) => Promise<{ patches: FixPatch[]; usage: FixUsage[] }>;

/** The LLM call itself (runs wherever an LLM with network access is available). */
export function localFixer(llm: LlmProvider): TextFixer {
  return async (slots, problems) => {
    const r = await llm.complete({
      step: "qa_fix",
      schema: FixOutput,
      messages: [
        {
          role: "system",
          content:
            'Chữ trên màn hình của một cảnh video bị tràn hoặc đè lên nhau. Hãy RÚT GỌN các slot chữ (giữ ý, tiếng Việt có dấu, ngắn hơn khoảng 30%). Trả về DUY NHẤT JSON {"patches":[{"slot": tên slot, "value": chuỗi hoặc mảng chuỗi}]}. Không đổi slot số.',
        },
        { role: "user", content: `Slots hiện tại: ${JSON.stringify(slots)}\nLỗi: ${problems.join("; ")}` },
      ],
    });
    return {
      patches: r.output.patches,
      usage: r.usage.map((u) => ({
        provider: u.provider,
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        costUsd: u.costUsd,
      })),
    };
  };
}

interface FixJob {
  slots: Record<string, SlotValue>;
  problems: string[];
}

/** Render side: send the fix to worker-ai and wait for its answer. */
export function remoteFixer(
  connection: ConnectionOptions,
  opts: { prefix?: string; timeoutMs?: number } = {},
): TextFixer {
  return async (slots, problems) => {
    const prefix = opts.prefix ?? "mkv";
    const queue = new Queue<FixJob>(QA_FIX_QUEUE, { connection, prefix });
    const events = new QueueEvents(QA_FIX_QUEUE, { connection, prefix });
    try {
      await events.waitUntilReady();
      const job = await queue.add(
        "fix",
        { slots, problems },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        },
      );
      return (await job.waitUntilFinished(events, opts.timeoutMs ?? 5 * 60_000)) as Awaited<
        ReturnType<TextFixer>
      >;
    } finally {
      await events.close();
      await queue.close();
    }
  };
}

/** worker-ai side: answer fix requests with the configured LLM. */
export function startQaFixWorker(
  llm: LlmProvider,
  connection: ConnectionOptions,
  opts: { prefix?: string; concurrency?: number } = {},
): Worker<FixJob> {
  const log = createLogger("qa-fix");
  const fix = localFixer(llm);
  const w = new Worker<FixJob>(QA_FIX_QUEUE, (job) => fix(job.data.slots, job.data.problems), {
    connection,
    prefix: opts.prefix ?? "mkv",
    concurrency: opts.concurrency ?? 4,
  });
  w.on("failed", (job, err) =>
    log.warn({ jobId: job?.id, err: err.message.split("\n")[0] }, "qa fix failed"),
  );
  return w;
}
