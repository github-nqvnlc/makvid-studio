// Project service used by the web app (M3, T099/T100): create + start production, review resume, chat
// edits (new version with optimistic lock on the head, then re-render; the scene render cache makes a
// one-scene edit cheap), undo / redo (move the head), restore, duplicate. Every query runs through
// withWorkspace (RLS). Workers persist results through dbSink (sink.ts).
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import type { ConnectionOptions } from "bullmq";
import {
  chatMessages,
  projects,
  projectVersions,
  renderOutputs,
  sourceMaterials,
  withWorkspace,
  type Db,
  type Tx,
} from "@makvid/db";
import { enqueueProduceVideo, type ProduceJobData } from "@makvid/queue";
import { SPEC_VERSION, type AspectRatio, type PatchOp, type VideoSpec } from "@makvid/spec";
import type { ObjectStore } from "@makvid/storage";
import type { PipelineContext } from "./context";
import {
  loadState,
  saveState,
  STAGE_QUEUE,
  type ProduceInput,
  type ProduceState,
  type ScriptReview,
  type Stage,
  type StoryboardReview,
} from "./produce";
import { chatEdit, type ChatTurn } from "./steps/chat";
import { resumeProduction, startProduction } from "./worker";

export interface ServiceDeps {
  db: Db;
  connection: ConnectionOptions;
  store: ObjectStore;
  /** Root of the per-project work dirs shared with the workers. */
  workRoot: string;
  stylesRoot: string;
  prefix?: string;
}

/** Errors the UI turns into friendly messages (code -> i18n key). */
export class ProjectError extends Error {
  constructor(
    readonly code: "not_found" | "busy" | "conflict" | "invalid" | "nothing_to_redo" | "nothing_to_undo",
  ) {
    super(code);
    this.name = "ProjectError";
  }
}

const BUSY_OK = new Set(["ready", "needs_attention", "failed"]);
const RERENDER: Stage[] = ["audio", "qa", "render"];

export const workDirOf = (deps: ServiceDeps, workspaceId: string, projectId: string) =>
  join(deps.workRoot, workspaceId, projectId);

function jobData(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  runId: string,
  input: ProduceInput,
): ProduceJobData<ProduceInput> {
  return {
    workspaceId,
    projectId,
    versionId: runId,
    workDir: workDirOf(deps, workspaceId, projectId),
    input,
  };
}

const qopts = (deps: ServiceDeps) => (deps.prefix ? { prefix: deps.prefix } : {});

async function getProjectRow(tx: Tx, projectId: string) {
  const [p] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!p) throw new ProjectError("not_found");
  return p;
}

export interface CreateProjectInput {
  workspaceId: string;
  userId: string;
  prompt: string;
  aspects: AspectRatio[];
  durationSec: number;
  mode: "auto" | "review";
  voiceId: string;
  styleId?: string;
}

export async function createProject(deps: ServiceDeps, c: CreateProjectInput): Promise<string> {
  const prompt = c.prompt.normalize("NFC").trim();
  if (prompt.length < 3) throw new ProjectError("invalid");
  const runId = randomUUID();
  const input: ProduceInput = {
    prompt,
    aspects: c.aspects,
    durationSec: c.durationSec,
    mode: c.mode,
    voiceId: c.voiceId,
    ...(c.styleId ? { styleId: c.styleId } : {}),
  };
  const projectId = await withWorkspace(deps.db, c.workspaceId, async (tx) => {
    const [src] = await tx
      .insert(sourceMaterials)
      .values({ workspaceId: c.workspaceId, kind: "prompt", markdown: prompt })
      .returning();
    const [p] = await tx
      .insert(projects)
      .values({
        workspaceId: c.workspaceId,
        title: [...prompt].slice(0, 80).join(""),
        mode: c.mode,
        status: "scripting",
        sourceMaterialId: src!.id,
        primaryAspect: c.aspects[0]!,
        exportAspects: c.aspects,
        createdBy: c.userId,
        settings: {
          voiceId: c.voiceId,
          durationSec: c.durationSec,
          ...(c.styleId ? { styleId: c.styleId } : {}),
        },
        runId,
      })
      .returning();
    return p!.id;
  });
  mkdirSync(workDirOf(deps, c.workspaceId, projectId), { recursive: true });
  await startProduction(deps.connection, jobData(deps, c.workspaceId, projectId, runId, input), qopts(deps));
  return projectId;
}

/** The production input stored with the project's work dir. */
function inputOf(deps: ServiceDeps, workspaceId: string, projectId: string): ProduceState {
  const state = loadState(workDirOf(deps, workspaceId, projectId));
  if (!state) throw new ProjectError("not_found");
  return state;
}

export async function resumeProject(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  review:
    { point: "script_review"; edits: ScriptReview } | { point: "storyboard_review"; edits: StoryboardReview },
): Promise<void> {
  const p = await withWorkspace(deps.db, workspaceId, (tx) => getProjectRow(tx, projectId));
  const expected = review.point === "script_review" ? "awaiting_script_review" : "awaiting_storyboard_review";
  if (p.status !== expected) throw new ProjectError("conflict");
  const state = inputOf(deps, workspaceId, projectId);
  try {
    await resumeProduction(
      deps.connection,
      jobData(deps, workspaceId, projectId, p.runId!, state.input),
      deps.stylesRoot,
      review,
      qopts(deps),
    );
  } catch (e) {
    if (e instanceof ProjectError) throw e;
    throw new ProjectError("invalid");
  }
  await withWorkspace(deps.db, workspaceId, (tx) =>
    tx
      .update(projects)
      .set({
        status: review.point === "script_review" ? "storyboarding" : "producing_audio",
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId)),
  );
}

/** Put `spec` into the work dir and re-run voice (cached) + QA + render (scene cache) as run `runId`. */
async function rerender(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  runId: string,
  spec: VideoSpec,
): Promise<void> {
  const workDir = workDirOf(deps, workspaceId, projectId);
  const state = inputOf(deps, workspaceId, projectId);
  const next: ProduceState = { ...state, spec, usage: [] };
  delete next.outputs;
  delete next.qa;
  delete next.mixedWav;
  saveState(workDir, next);
  await enqueueProduceVideo(
    deps.connection,
    RERENDER.map((name) => ({ name, queue: STAGE_QUEUE[name] })),
    jobData(deps, workspaceId, projectId, runId, state.input),
    qopts(deps),
  );
}

/** Insert a new version as the child of `expectedHead` and move the head, or fail on a concurrent edit. */
async function commitVersion(
  tx: Tx,
  p: { id: string; workspaceId: string; headVersionId: string | null },
  v: { id: string; spec: VideoSpec; patch?: PatchOp[]; author: string; message: string },
) {
  const [{ seq }] = await tx
    .select({ seq: max(projectVersions.seq) })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, p.id))
    .then((r) => r.map((x) => ({ seq: x.seq ?? 0 })) as [{ seq: number }]);
  // A concurrent edit on the same head collides on (project_id, seq): report it as a conflict.
  try {
    await tx.insert(projectVersions).values({
      id: v.id,
      workspaceId: p.workspaceId,
      projectId: p.id,
      parentVersionId: p.headVersionId,
      seq: seq + 1,
      spec: v.spec,
      specVersion: SPEC_VERSION,
      patch: v.patch ?? null,
      author: v.author,
      message: v.message,
    });
  } catch {
    throw new ProjectError("conflict");
  }
  const moved = await tx
    .update(projects)
    .set({ headVersionId: v.id, runId: v.id, status: "producing_audio", updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, p.id),
        p.headVersionId ? eq(projects.headVersionId, p.headVersionId) : isNull(projects.headVersionId),
      ),
    )
    .returning({ id: projects.id });
  if (!moved.length) throw new ProjectError("conflict"); // someone else edited first (optimistic lock)
}

async function headSpec(tx: Tx, headVersionId: string | null): Promise<VideoSpec> {
  if (!headVersionId) throw new ProjectError("busy");
  const [v] = await tx.select().from(projectVersions).where(eq(projectVersions.id, headVersionId));
  if (!v) throw new ProjectError("not_found");
  return v.spec as VideoSpec;
}

export interface ChatReply {
  kind: "edit" | "clarify" | "info";
  reply: string;
  versionId?: string;
}

export async function chatProject(
  deps: ServiceDeps,
  ai: Pick<PipelineContext, "llm" | "onUsage">,
  workspaceId: string,
  projectId: string,
  message: string,
): Promise<ChatReply> {
  const text = message.normalize("NFC").trim().slice(0, 1000);
  if (!text) throw new ProjectError("invalid");
  const { p, spec, history } = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    if (!BUSY_OK.has(p.status)) throw new ProjectError("busy");
    const history = await tx
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(6);
    return { p, spec: await headSpec(tx, p.headVersionId), history: history.reverse() };
  });
  const turns: ChatTurn[] = history.map((h) => ({ role: h.role, content: h.content }));
  const r = await chatEdit({ ...ai, stylesRoot: deps.stylesRoot }, spec, text, turns);
  const versionId = r.kind === "edit" ? randomUUID() : undefined;
  await withWorkspace(deps.db, workspaceId, async (tx) => {
    if (r.kind === "edit")
      await commitVersion(tx, p, {
        id: versionId!,
        spec: r.spec,
        patch: r.patch,
        author: "user",
        message: text,
      });
    await tx.insert(chatMessages).values([
      {
        workspaceId,
        projectId,
        role: "user",
        kind: r.kind,
        content: text,
        ...(r.kind === "edit" && r.targetSceneId ? { targetSceneId: r.targetSceneId } : {}),
      },
      {
        workspaceId,
        projectId,
        role: "assistant",
        kind: r.kind,
        content: r.reply,
        ...(versionId ? { versionId } : {}),
      },
    ]);
  });
  if (r.kind === "edit") await rerender(deps, workspaceId, projectId, versionId!, r.spec);
  return { kind: r.kind, reply: r.reply, ...(versionId ? { versionId } : {}) };
}

/** Undo: the head moves to its parent (its outputs are already rendered). */
export async function undoProject(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
): Promise<string> {
  return withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    if (!BUSY_OK.has(p.status)) throw new ProjectError("busy");
    const [v] = p.headVersionId
      ? await tx.select().from(projectVersions).where(eq(projectVersions.id, p.headVersionId))
      : [];
    if (!v?.parentVersionId) throw new ProjectError("nothing_to_undo");
    await moveHead(tx, p.id, p.headVersionId!, v.parentVersionId);
    return v.parentVersionId;
  });
}

/** Redo: the head moves to its most recent child. */
export async function redoProject(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
): Promise<string> {
  return withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    if (!BUSY_OK.has(p.status)) throw new ProjectError("busy");
    const [child] = p.headVersionId
      ? await tx
          .select()
          .from(projectVersions)
          .where(eq(projectVersions.parentVersionId, p.headVersionId))
          .orderBy(desc(projectVersions.seq))
          .limit(1)
      : [];
    if (!child) throw new ProjectError("nothing_to_redo");
    await moveHead(tx, p.id, p.headVersionId!, child.id);
    return child.id;
  });
}

async function moveHead(tx: Tx, projectId: string, from: string, to: string) {
  const [out] = await tx.select().from(renderOutputs).where(eq(renderOutputs.versionId, to)).limit(1);
  const moved = await tx
    .update(projects)
    .set({ headVersionId: to, status: out ? "ready" : "needs_attention", updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.headVersionId, from)))
    .returning({ id: projects.id });
  if (!moved.length) throw new ProjectError("conflict");
}

/** Restore an older version as a new version on top of the head (history is never rewritten). */
export async function restoreVersion(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  versionId: string,
): Promise<string> {
  const id = randomUUID();
  const spec = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    if (!BUSY_OK.has(p.status)) throw new ProjectError("busy");
    const [old] = await tx
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId)));
    if (!old) throw new ProjectError("not_found");
    await commitVersion(tx, p, {
      id,
      spec: old.spec as VideoSpec,
      author: "user",
      message: `restore:${old.seq}`,
    });
    return old.spec as VideoSpec;
  });
  await rerender(deps, workspaceId, projectId, id, spec);
  return id;
}

/** Duplicate a project (head version + work dir caches) and render the copy. */
export async function duplicateProject(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<string> {
  const runId = randomUUID();
  const { copyId, spec } = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    const spec = await headSpec(tx, p.headVersionId);
    const [copy] = await tx
      .insert(projects)
      .values({
        workspaceId,
        title: `${p.title} (bản sao)`,
        mode: p.mode,
        status: "producing_audio",
        sourceMaterialId: p.sourceMaterialId,
        primaryAspect: p.primaryAspect,
        exportAspects: p.exportAspects,
        createdBy: userId,
        settings: p.settings,
        runId,
      })
      .returning();
    await commitVersion(
      tx,
      { id: copy!.id, workspaceId, headVersionId: null },
      { id: runId, spec, author: "user", message: "duplicate" },
    );
    return { copyId: copy!.id, spec };
  });
  const from = workDirOf(deps, workspaceId, projectId);
  const to = workDirOf(deps, workspaceId, copyId);
  if (existsSync(from))
    cpSync(from, to, { recursive: true, filter: (src) => !src.startsWith(join(from, "out")) });
  await rerender(deps, workspaceId, copyId, runId, spec);
  return copyId;
}

export interface VersionInfo {
  id: string;
  seq: number;
  author: string;
  message: string | null;
  parentVersionId: string | null;
  createdAt: Date;
}

/** Everything the editor needs; file URLs are short-lived signed URLs. */
export async function projectView(deps: ServiceDeps, workspaceId: string, projectId: string) {
  const data = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const p = await getProjectRow(tx, projectId);
    const versions = await tx
      .select({
        id: projectVersions.id,
        seq: projectVersions.seq,
        author: projectVersions.author,
        message: projectVersions.message,
        parentVersionId: projectVersions.parentVersionId,
        createdAt: projectVersions.createdAt,
      })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, projectId))
      .orderBy(asc(projectVersions.seq));
    const head = p.headVersionId
      ? (await tx.select().from(projectVersions).where(eq(projectVersions.id, p.headVersionId)))[0]
      : undefined;
    let outputs = p.headVersionId
      ? await tx.select().from(renderOutputs).where(eq(renderOutputs.versionId, p.headVersionId))
      : [];
    // While the head is being rendered, keep showing the newest earlier version that has files.
    if (!outputs.length && head?.parentVersionId) {
      const [prev] = await tx
        .select({ versionId: renderOutputs.versionId })
        .from(renderOutputs)
        .where(eq(renderOutputs.projectId, projectId))
        .orderBy(desc(renderOutputs.createdAt))
        .limit(1);
      if (prev)
        outputs = await tx.select().from(renderOutputs).where(eq(renderOutputs.versionId, prev.versionId));
    }
    const chat = await tx
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(asc(chatMessages.createdAt));
    const children = p.headVersionId
      ? await tx
          .select({ id: projectVersions.id })
          .from(projectVersions)
          .where(inArray(projectVersions.parentVersionId, [p.headVersionId]))
      : [];
    return { p, versions, head, outputs, chat, canRedo: children.length > 0 };
  });
  const state = loadState(workDirOf(deps, workspaceId, projectId));
  const sign = (k: string | null) => (k ? deps.store.signedGetUrl(k, 3600) : Promise.resolve(null));
  return {
    project: {
      id: data.p.id,
      title: data.p.title,
      status: data.p.status,
      mode: data.p.mode,
      settings: data.p.settings as { voiceId?: string; durationSec?: number; styleId?: string },
      headVersionId: data.p.headVersionId,
    },
    spec: (data.head?.spec as VideoSpec | undefined) ?? null,
    canUndo: !!data.head?.parentVersionId,
    canRedo: data.canRedo,
    versions: data.versions satisfies VersionInfo[],
    chat: data.chat.map((m) => ({
      id: m.id,
      role: m.role,
      kind: m.kind,
      content: m.content,
      at: m.createdAt,
    })),
    outputs: await Promise.all(
      data.outputs.map(async (o) => ({
        aspect: o.aspect,
        durationMs: o.durationMs,
        video: await sign(o.storageKey),
        srt: await sign(o.srtKey),
        thumbnail: await sign(o.thumbnailKey),
      })),
    ),
    review: state
      ? {
          title: state.script?.title ?? null,
          sentences: state.script?.sentences ?? [],
          styleSuggestions: state.styleSuggestions ?? [],
          styleId: state.styleId ?? null,
          scenes: (state.previews ?? []).map((x) => ({
            sceneId: x.sceneId,
            templateId: x.templateId,
            text: x.text,
          })),
        }
      : null,
  };
}

export type ProjectView = Awaited<ReturnType<typeof projectView>>;
