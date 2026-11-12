// BullMQ stage worker shared by apps/worker-ai, worker-audio, worker-render (T083/T084).
import { configFromEnv, createLlm } from "@makvid/ai";
import {
  connectionFromUrl,
  createLogger,
  enqueueProduceVideo,
  progressEvent,
  type ProduceJobData,
  type StageDef,
} from "@makvid/queue";
import { createRenderer, type Renderer } from "@makvid/renderer";
import { FptTtsProvider, MfaAligner } from "@makvid/tts";
import { musicProviderFromEnv } from "@makvid/media";
import { Worker, type ConnectionOptions, type Job, type JobNode } from "bullmq";
import type { PipelineContext, UsageEntry } from "./context";
import {
  applyScriptReview,
  applyStoryboardReview,
  produceSegments,
  runStage,
  STAGE_QUEUE,
  type ProduceInput,
  type ProduceState,
  type ScriptReview,
  type Stage,
  type StoryboardReview,
} from "./produce";

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
  const music = musicProviderFromEnv();
  return (workDir, hooks) => ({
    llm,
    tts,
    aligner,
    renderer,
    stylesRoot,
    workDir,
    voiceId: process.env.FPT_TTS_VOICE_ID ?? "vits:banmai",
    music,
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

const stageDefs = (stages: Stage[]): StageDef[] => stages.map((name) => ({ name, queue: STAGE_QUEUE[name] }));

/** Stage list for enqueueProduceVideo (auto mode, one segment). */
export const PRODUCE_STAGES: StageDef[] = stageDefs(produceSegments("auto")[0]!);

/** Which segment runs next for a project, from its persisted state. */
export function nextSegment(state: ProduceState | undefined): number {
  const approved = state?.approved ?? [];
  return approved.includes("storyboard_review") ? 2 : approved.includes("script_review") ? 1 : 0;
}

type QueueOpts = { prefix?: string; priority?: number };

/** Start a production: auto runs everything; review runs up to the script review and stops (T089). */
export async function startProduction(
  connection: ConnectionOptions,
  data: ProduceJobData<ProduceInput>,
  opts: QueueOpts = {},
): Promise<JobNode> {
  return enqueueProduceVideo(connection, stageDefs(produceSegments(data.input.mode)[0]!), data, opts);
}

/**
 * Resume a review-mode production that is waiting for the user: apply their edits (or plain acceptance),
 * then enqueue the next segment. Throws if the project is not waiting at that point.
 */
export async function resumeProduction(
  connection: ConnectionOptions,
  data: ProduceJobData<ProduceInput>,
  stylesRoot: string,
  review:
    { point: "script_review"; edits: ScriptReview } | { point: "storyboard_review"; edits: StoryboardReview },
  opts: QueueOpts = {},
): Promise<JobNode> {
  const state =
    review.point === "script_review"
      ? applyScriptReview(stylesRoot, data.workDir, review.edits)
      : applyStoryboardReview(data.workDir, review.edits);
  const segment = nextSegment(state);
  return enqueueProduceVideo(connection, stageDefs(produceSegments("review")[segment]!), data, opts);
}
