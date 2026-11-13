// BullMQ stage worker shared by apps/worker-ai, worker-audio, worker-render (T083/T084).
import { configFromEnv, createLlm, DEFAULT_STEPS } from "@makvid/ai";
import { MockAligner, mockLlm, mockTts, stubRenderer } from "./testing";
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
import type { ScenePool } from "./distributed";
import type { TextFixer } from "./qa-fix";
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

/** Called by stage workers around each stage (project status, versions, outputs, usage). */
export interface StageHooks {
  onStageStart?(data: ProduceJobData<ProduceInput>, stage: Stage): unknown;
  onStageDone?(data: ProduceJobData<ProduceInput>, stage: Stage, state: ProduceState): unknown;
  onStageFailed?(data: ProduceJobData<ProduceInput>, stage: Stage, err: Error): unknown;
  onProgress?(
    data: ProduceJobData<ProduceInput>,
    stage: Stage,
    p: { key: string; params?: Record<string, string | number>; fraction: number },
  ): unknown;
  onUsage?(data: ProduceJobData<ProduceInput>, u: UsageEntry): unknown;
}

export type ContextFactory = (
  workDir: string,
  hooks: Pick<PipelineContext, "onUsage" | "onProgress">,
) => PipelineContext;

/** Mock providers for end-to-end tests (no paid calls): MAKVID_MOCK_PROVIDERS=1. */
export function mockContextFactory(stylesRoot: string): ContextFactory {
  const llm = createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS });
  return (workDir, hooks) => ({
    llm,
    tts: mockTts,
    aligner: new MockAligner("http://unused"),
    renderer: stubRenderer,
    stylesRoot,
    workDir,
    voiceId: "vits:banmai",
    ...hooks,
  });
}

/** Production context from env: FPT LLM + TTS, MFA aligner, HyperFrames renderer. */
export function contextFromEnv(
  stylesRoot: string,
  renderer: Renderer = createRenderer("hyperframes", { workers: Number(process.env.RENDER_WORKERS ?? 4) }),
  /** false for the render worker when AI calls go through worker-ai (no provider key needed there). */
  requireKey = true,
): ContextFactory {
  if (process.env.MAKVID_MOCK_PROVIDERS === "1") return mockContextFactory(stylesRoot);
  const key = process.env.FPT_AI_API_KEY ?? "";
  if (!key && requireKey) throw new Error("FPT_AI_API_KEY is not set");
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
    /** Persistence hooks (status, versions, outputs): see sink.ts. Errors here are logged, never fatal. */
    hooks?: StageHooks;
    /** Distributed scene rendering (T132): pool for the scenes of this job's video. */
    scenePool?: (data: ProduceJobData<ProduceInput>) => ScenePool;
    /** QA text fixes sent to worker-ai (qa-fix.ts). */
    textFixer?: TextFixer;
  } = {},
): Worker {
  const log = createLogger(`worker-${queue}`);
  const connection = opts.connection ?? connectionFromUrl();
  const worker = new Worker<ProduceJobData<ProduceInput>, { stage: string }>(
    queue,
    async (job: Job<ProduceJobData<ProduceInput>>) => {
      const stage = job.name as Stage;
      if (STAGE_QUEUE[stage] !== queue)
        throw new Error(`stage "${stage}" does not belong on queue "${queue}"`);
      const data = job.data;
      const safe = async (what: string, fn: () => unknown) => {
        try {
          await fn();
        } catch (e) {
          const err = e as Error & { cause?: Error };
          log.error(
            { jobId: job.id, stage, err: err.message.split("\n")[0], cause: err.cause?.message },
            `hook ${what} failed`,
          );
        }
      };
      await safe("start", () => opts.hooks?.onStageStart?.(data, stage));
      const base = makeCtx(data.workDir, {
        onUsage: (u) => (opts.onUsage?.(data, u), void safe("usage", () => opts.hooks?.onUsage?.(data, u))),
        onProgress: (p) => (
          void safe("progress", () => opts.hooks?.onProgress?.(data, stage, p)),
          void job
            .updateProgress(progressEvent(data.projectId, stage, p) as unknown as object)
            .catch(() => undefined)
        ),
      });
      const ctx = {
        ...base,
        ...(opts.scenePool ? { scenePool: opts.scenePool(data) } : {}),
        ...(opts.textFixer ? { textFixer: opts.textFixer } : {}),
      };
      log.info({ jobId: job.id, stage, projectId: data.projectId }, "stage start");
      const state = await runStage(ctx, stage, data.input);
      await safe("done", () => opts.hooks?.onStageDone?.(data, stage, state));
      log.info({ jobId: job.id, stage }, "stage done");
      return { stage };
    },
    { connection, prefix: opts.prefix ?? "mkv", concurrency: opts.concurrency ?? 1 },
  );
  worker.on("failed", (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    log.warn({ jobId: job.id, stage: job.name, final, err: err.message }, "stage failed");
    if (final)
      void Promise.resolve(opts.hooks?.onStageFailed?.(job.data, job.name as Stage, err)).catch(
        (e: unknown) => log.error({ jobId: job.id, err: (e as Error).message }, "hook failed failed"),
      );
  });
  return worker;
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
