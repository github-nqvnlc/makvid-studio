// BullMQ stage worker shared by apps/worker-ai, worker-audio, worker-render (T083/T084).
import { configFromEnv, createLlm } from "@makvid/ai";
import { connectionFromUrl, createLogger, progressEvent, type ProduceJobData } from "@makvid/queue";
import { createRenderer, type Renderer } from "@makvid/renderer";
import { FptTtsProvider, MfaAligner } from "@makvid/tts";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import type { PipelineContext, UsageEntry } from "./context";
import { runStage, STAGE_QUEUE, type ProduceInput, type Stage } from "./produce";

export type ContextFactory = (
  workDir: string,
  hooks: Pick<PipelineContext, "onUsage" | "onProgress">,
) => PipelineContext;

/** Production context from env: FPT LLM + TTS, MFA aligner, HyperFrames renderer. */
export function contextFromEnv(
  stylesRoot: string,
  renderer: Renderer = createRenderer("hyperframes", { workers: Number(process.env.RENDER_WORKERS ?? 4) }),
): ContextFactory {
  const key = process.env.FPT_AI_API_KEY;
  if (!key) throw new Error("FPT_AI_API_KEY is not set");
  const llm = createLlm(configFromEnv());
  const tts = new FptTtsProvider(key);
  const aligner = new MfaAligner();
  return (workDir, hooks) => ({
    llm,
    tts,
    aligner,
    renderer,
    stylesRoot,
    workDir,
    voiceId: process.env.FPT_TTS_VOICE_ID ?? "vits:banmai",
    ...hooks,
  });
}

export function startStageWorker(
  queue: "ai" | "audio" | "render",
  makeCtx: ContextFactory,
  opts: {
    connection?: ConnectionOptions;
    prefix?: string;
    concurrency?: number;
    onUsage?: (data: ProduceJobData, u: UsageEntry) => void;
  } = {},
): Worker {
  const log = createLogger(`worker-${queue}`);
  const connection = opts.connection ?? connectionFromUrl();
  return new Worker<ProduceJobData<ProduceInput>, { stage: string }>(
    queue,
    async (job: Job<ProduceJobData<ProduceInput>>) => {
      const stage = job.name as Stage;
      if (STAGE_QUEUE[stage] !== queue)
        throw new Error(`stage "${stage}" does not belong on queue "${queue}"`);
      const data = job.data;
      const ctx = makeCtx(data.workDir, {
        onUsage: (u) => opts.onUsage?.(data, u),
        onProgress: (p) =>
          void job
            .updateProgress(progressEvent(data.projectId, stage, p) as unknown as object)
            .catch(() => undefined),
      });
      log.info({ jobId: job.id, stage, projectId: data.projectId }, "stage start");
      await runStage(ctx, stage, data.input);
      log.info({ jobId: job.id, stage }, "stage done");
      return { stage };
    },
    { connection, prefix: opts.prefix ?? "mkv", concurrency: opts.concurrency ?? 1 },
  );
}

/** Stage list for enqueueProduceVideo. */
export const PRODUCE_STAGES = (Object.entries(STAGE_QUEUE) as Array<[Stage, "ai" | "audio" | "render"]>).map(
  ([name, queue]) => ({ name, queue }),
);
