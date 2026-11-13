// Worker-side persistence (M3): keeps the project row, job progress, usage, versions and render outputs in
// Postgres (always through withWorkspace, so RLS applies) and uploads finished files to object storage.
import { readFileSync } from "node:fs";
import { and, desc, eq, max, sql } from "drizzle-orm";
import {
  jobs,
  projects,
  projectVersions,
  renderOutputs,
  usageRecords,
  withWorkspace,
  type Db,
} from "@makvid/db";
import { activePlan } from "@makvid/billing";
import type { ProduceJobData } from "@makvid/queue";
import { aspectSlug, ASPECT_SIZES, SPEC_VERSION } from "@makvid/spec";
import { workspaceKey, type ObjectStore } from "@makvid/storage";
import type { ProduceInput, ProduceState, Stage } from "./produce";
import type { StageHooks } from "./worker";

type Status = (typeof projects.$inferSelect)["status"];
type JobStep = (typeof jobs.$inferSelect)["step"];

const RUNNING: Record<Stage, Status> = {
  script: "scripting",
  style: "styling",
  storyboard: "storyboarding",
  preview: "storyboarding",
  audio: "producing_audio",
  qa: "qa",
  render: "rendering",
};
const STEP: Record<Stage, JobStep> = {
  script: "script",
  style: "style_suggest",
  storyboard: "storyboard",
  preview: "compile",
  audio: "tts",
  qa: "qa",
  render: "render_scene",
};

type Data = ProduceJobData<ProduceInput>;
const jobKey = (d: Data, stage: Stage) => `${d.versionId}.${stage}`;

/** Upload the rendered files of one version and return their storage keys. */
async function upload(store: ObjectStore, d: Data, file: string, name: string, contentType: string) {
  const key = workspaceKey(d.workspaceId, "projects", d.projectId, d.versionId, name);
  await store.put(key, readFileSync(file), { contentType });
  return key;
}

export function dbSink(db: Db, store: ObjectStore): StageHooks {
  const lastProgress = new Map<string, { at: number; key: string }>();
  const ws = <T>(d: Data, fn: Parameters<typeof withWorkspace<T>>[2]) => withWorkspace(db, d.workspaceId, fn);

  return {
    async onStageStart(d, stage) {
      await ws(d, async (tx) => {
        await tx
          .update(projects)
          .set({ status: RUNNING[stage], updatedAt: new Date() })
          .where(eq(projects.id, d.projectId));
        await tx
          .insert(jobs)
          .values({
            workspaceId: d.workspaceId,
            projectId: d.projectId,
            versionId: d.versionId,
            step: STEP[stage],
            inputHash: jobKey(d, stage),
            status: "running",
            startedAt: new Date(),
          })
          // A BullMQ retry of the same stage reuses the row.
          .onConflictDoUpdate({
            target: [jobs.versionId, jobs.step, jobs.inputHash],
            set: { status: "running", startedAt: new Date(), attempt: sql`${jobs.attempt} + 1` },
          });
      });
    },

    async onProgress(d, stage, p) {
      const k = jobKey(d, stage);
      const now = Date.now();
      const prev = lastProgress.get(k);
      // Throttle DB writes, but never drop a change of message.
      if (prev && prev.key === p.key && now - prev.at < 500 && p.fraction < 1) return;
      lastProgress.set(k, { at: now, key: p.key });
      await ws(d, (tx) =>
        tx
          .update(jobs)
          .set({ progress: p.fraction, userMessageKey: p.key, output: { params: p.params ?? {} } })
          .where(and(eq(jobs.projectId, d.projectId), eq(jobs.inputHash, k))),
      );
    },

    async onUsage(d, u) {
      await ws(d, (tx) =>
        tx.insert(usageRecords).values({
          workspaceId: d.workspaceId,
          projectId: d.projectId,
          step: u.step,
          provider: u.provider,
          model: u.model ?? null,
          tokensIn: u.tokensIn ?? 0,
          tokensOut: u.tokensOut ?? 0,
          ttsChars: u.ttsChars ?? 0,
          renderSeconds: u.renderSeconds ?? 0,
          images: u.images ?? 0,
          costUsd: u.costUsd === null ? null : u.costUsd.toFixed(6),
        }),
      );
    },

    async onStageFailed(d, stage) {
      await ws(d, async (tx) => {
        await tx
          .update(jobs)
          .set({ status: "failed", finishedAt: new Date(), errorCode: "stage_failed" })
          .where(and(eq(jobs.projectId, d.projectId), eq(jobs.inputHash, jobKey(d, stage))));
        await tx
          .update(projects)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(projects.id, d.projectId));
      });
    },

    async onStageDone(d, stage, state: ProduceState) {
      // Uploads happen outside the transaction (slow); rows are written afterwards in one transaction.
      const outputs =
        stage === "render"
          ? await Promise.all(
              (state.outputs ?? []).map(async (o) => {
                const slug = aspectSlug(o.aspect);
                return {
                  o,
                  video: await upload(store, d, o.video, `${slug}.mp4`, "video/mp4"),
                  srt: await upload(store, d, o.srt, `${slug}.srt`, "application/x-subrip"),
                  thumb: await upload(store, d, o.thumbnail, `${slug}.jpg`, "image/jpeg"),
                };
              }),
            )
          : [];
      await ws(d, async (tx) => {
        await tx
          .update(jobs)
          .set({
            status: "succeeded",
            finishedAt: new Date(),
            ...(stage === "render" ? { progress: 1 } : {}),
          })
          .where(and(eq(jobs.projectId, d.projectId), eq(jobs.inputHash, jobKey(d, stage))));
        const set: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
        if (stage === "script" && state.script?.title) set.title = state.script.title;
        if (state.awaiting)
          set.status =
            state.awaiting === "script_review" ? "awaiting_script_review" : "awaiting_storyboard_review";
        if (stage === "render") {
          const [p] = await tx.select().from(projects).where(eq(projects.id, d.projectId));
          const [existing] = await tx
            .select()
            .from(projectVersions)
            .where(eq(projectVersions.id, d.versionId));
          if (!existing) {
            const [{ seq } = { seq: 0 }] = await tx
              .select({ seq: max(projectVersions.seq) })
              .from(projectVersions)
              .where(eq(projectVersions.projectId, d.projectId))
              .then((r) => r.map((x) => ({ seq: x.seq ?? 0 })));
            await tx.insert(projectVersions).values({
              id: d.versionId,
              workspaceId: d.workspaceId,
              projectId: d.projectId,
              parentVersionId: p?.headVersionId ?? null,
              seq: seq + 1,
              spec: state.spec!,
              specVersion: SPEC_VERSION,
              author: "ai",
              message: "auto",
            });
          }
          const retentionDays = outputs.length ? (await activePlan(tx, d.workspaceId)).retentionDays : 0;
          for (const x of outputs) {
            const { width, height } = ASPECT_SIZES[x.o.aspect];
            await tx.insert(renderOutputs).values({
              workspaceId: d.workspaceId,
              projectId: d.projectId,
              versionId: d.versionId,
              aspect: x.o.aspect,
              storageKey: x.video,
              srtKey: x.srt,
              thumbnailKey: x.thumb,
              durationMs: Math.round(x.o.durationSec * 1000),
              width,
              height,
              fps: 30,
              loudnessLufs: Number.isFinite(state.loudnessLufs) ? state.loudnessLufs! : null,
              watermarked: state.spec?.meta.watermark === true,
              // Files are kept for the plan's retention period (FR-057); the retention job deletes them after.
              expiresAt: new Date(Date.now() + retentionDays * 86400_000),
            });
          }
          set.headVersionId = d.versionId;
          set.status = state.qa?.passed ? "ready" : "needs_attention";
        }
        await tx.update(projects).set(set).where(eq(projects.id, d.projectId));
      });
    },
  };
}

/** Latest job progress of a project's current run (SSE). */
export async function latestProgress(db: Db, workspaceId: string, projectId: string) {
  return withWorkspace(db, workspaceId, async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!p) return undefined;
    const [j] = p.runId
      ? await tx
          .select()
          .from(jobs)
          .where(and(eq(jobs.projectId, projectId), eq(jobs.versionId, p.runId)))
          .orderBy(desc(jobs.createdAt))
          .limit(1)
      : [];
    return {
      status: p.status,
      title: p.title,
      headVersionId: p.headVersionId,
      key: j?.userMessageKey ?? null,
      params: ((j?.output as { params?: Record<string, string | number> } | null)?.params ?? {}) as Record<
        string,
        string | number
      >,
      fraction: j?.progress ?? 0,
    };
  });
}
