// Templates and batches (US5, T130/T131): save a project as a template with `{{variables}}`, check a CSV against
// it, then produce one video per row. Rows run the template's spec through voice -> QA -> render only (no AI
// writing), at batch priority, at most `concurrency` at a time per batch and `concurrent_jobs` per workspace.
// Workers call batchProjectFinished() when a row's project is done; it advances the batch and, at the end,
// assembles a ZIP of every successful video + subtitles on object storage.
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Zip, ZipPassThrough } from "fflate";
import {
  batches,
  batchItems,
  projects,
  projectVersions,
  renderOutputs,
  templates,
  withWorkspace,
  type BatchStatus,
  type TemplateVariable,
  type Tx,
} from "@makvid/db";
import { parseCsv } from "@makvid/media";
import {
  BATCH_PRIORITY,
  BATCH_STAGES,
  batchStateOf,
  enqueueProduceVideo,
  pickNext,
  slotsFree,
  zipEntryName,
  type ItemStatus,
} from "@makvid/queue";
import {
  aspectSlug,
  checkTable,
  extractVariables,
  substituteVariables,
  templatize,
  type AspectRatio,
  type TableCheck,
  type VideoSpec,
} from "@makvid/spec";
import { loadPack } from "@makvid/style-kit/node";
import { workspaceKey } from "@makvid/storage";
import { loadState, saveState, STAGE_QUEUE, type ProduceInput, type ProduceState } from "./produce";
import { ProjectError, workDirOf, type ServiceDeps } from "./service";
import type { StageHooks } from "./worker";

/** Settings a template copies from its source project (everything a row needs besides the spec). */
export interface TemplateSettings {
  aspects: AspectRatio[];
  voiceId?: string;
  durationSec?: number;
  styleId?: string;
  music?: ProduceState["music"];
  brand?: ProduceInput["brand"];
  brandKitId?: string | null;
}

/** Quota hook (US6): reserve before a row starts, settle/release when it ends. Absent = unlimited. */
export interface BatchGate {
  /** Max items of the workspace in flight at once (plan concurrent_jobs). */
  concurrency(workspaceId: string): Promise<number>;
  /** Reserve quota for one row; false = not enough (the batch pauses with status paused_quota). */
  reserve(
    workspaceId: string,
    projectId: string,
    estimate: { videoSeconds: number; ttsChars: number },
  ): Promise<boolean>;
  /** The row is done: commit (ok) or release (failed) its reservation. */
  settle(workspaceId: string, projectId: string, ok: boolean): Promise<void>;
  /** Whether rendered videos of this workspace carry the free-plan watermark. */
  watermark?(workspaceId: string): Promise<boolean>;
}

const qopts = (deps: ServiceDeps) => (deps.prefix ? { prefix: deps.prefix } : {});

/** Slot maxLength from the style pack schema of each scene (for variable limits). */
function slotLimits(deps: ServiceDeps, spec: VideoSpec) {
  const packs = new Map<string, ReturnType<typeof loadPack> | null>();
  const pack = (id: string) => {
    if (!packs.has(id)) {
      try {
        packs.set(id, loadPack(join(deps.stylesRoot, id)));
      } catch {
        packs.set(id, null);
      }
    }
    return packs.get(id) ?? null;
  };
  return (sceneIndex: number, slot: string): number | undefined => {
    const scene = spec.scenes[sceneIndex];
    if (!scene) return undefined;
    const def = pack(scene.styleId)?.templates[
      scene.templateId as keyof ReturnType<typeof loadPack>["templates"]
    ]?.schema.slots[slot];
    return def?.type === "text" ? def.maxLength : def?.type === "list" ? def.itemMaxLength : undefined;
  };
}

export interface CreateTemplateInput {
  workspaceId: string;
  userId: string;
  projectId: string;
  name: string;
  /** Phrases of the current video to turn into variables, e.g. {find: "Chị Hoà", name: "ten_khach_hang"}. */
  replacements: Array<{ find: string; name: string }>;
}

/** "Save as template": freeze the project's head spec with placeholders and list its variables. */
export async function createTemplate(deps: ServiceDeps, c: CreateTemplateInput) {
  const { spec, versionId } = await withWorkspace(deps.db, c.workspaceId, async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, c.projectId));
    if (!p?.headVersionId) throw new ProjectError("not_found");
    const [v] = await tx.select().from(projectVersions).where(eq(projectVersions.id, p.headVersionId));
    return { spec: v!.spec as VideoSpec, versionId: v!.id };
  });
  let tpl: VideoSpec;
  try {
    tpl = templatize(spec, c.replacements);
  } catch {
    throw new ProjectError("invalid");
  }
  const variables: TemplateVariable[] = extractVariables(tpl, slotLimits(deps, tpl));
  if (!variables.length) throw new ProjectError("invalid");
  const state = loadState(workDirOf(deps, c.workspaceId, c.projectId));
  const settings: TemplateSettings = {
    aspects: state?.input.aspects ?? (tpl.meta.aspectRatios as AspectRatio[]),
    ...(state?.input.voiceId ? { voiceId: state.input.voiceId } : {}),
    ...(state?.input.durationSec ? { durationSec: state.input.durationSec } : {}),
    ...(state?.styleId ? { styleId: state.styleId } : {}),
    ...(state?.music ? { music: state.music } : {}),
    ...(state?.input.brand ? { brand: state.input.brand } : {}),
  };
  const [row] = await withWorkspace(deps.db, c.workspaceId, (tx) =>
    tx
      .insert(templates)
      .values({
        workspaceId: c.workspaceId,
        projectId: c.projectId,
        versionId,
        spec: tpl,
        name: [...c.name.normalize("NFC").trim()].slice(0, 120).join("") || "Template",
        variables,
        settings: settings as unknown as Record<string, unknown>,
        createdBy: c.userId,
      })
      .returning(),
  );
  return row!;
}

async function getTemplate(tx: Tx, templateId: string) {
  const [t] = await tx.select().from(templates).where(eq(templates.id, templateId));
  if (!t || t.deletedAt) throw new ProjectError("not_found");
  return t;
}

export const MAX_BATCH_ROWS = 1000;

/** Parse and check a CSV against a template (no writes): the upload page shows this before running. */
export async function checkBatchCsv(
  deps: ServiceDeps,
  workspaceId: string,
  templateId: string,
  csv: string,
): Promise<TableCheck & { tooManyRows: boolean }> {
  const t = await withWorkspace(deps.db, workspaceId, (tx) => getTemplate(tx, templateId));
  const table = parseCsv(csv.normalize("NFC"));
  const check = checkTable(table, t.variables);
  return { ...check, tooManyRows: check.rows.length > MAX_BATCH_ROWS };
}

export interface CreateBatchInput {
  workspaceId: string;
  userId: string;
  templateId: string;
  csv: string;
  name?: string;
  concurrency?: number;
  sourceAssetId?: string;
}

export type CreateBatchResult =
  { ok: true; batchId: string; total: number } | { ok: false; check: TableCheck & { tooManyRows: boolean } };

/** Create a batch from a valid CSV and start its first rows. An invalid CSV creates nothing. */
export async function createBatch(
  deps: ServiceDeps,
  c: CreateBatchInput,
  gate?: BatchGate,
): Promise<CreateBatchResult> {
  const check = await checkBatchCsv(deps, c.workspaceId, c.templateId, c.csv);
  if (check.missingColumns.length || check.issues.length || check.tooManyRows || !check.rows.length)
    return { ok: false, check };
  const batchId = await withWorkspace(deps.db, c.workspaceId, async (tx) => {
    const t = await getTemplate(tx, c.templateId);
    const [b] = await tx
      .insert(batches)
      .values({
        workspaceId: c.workspaceId,
        templateId: c.templateId,
        name: [...(c.name ?? t.name).normalize("NFC").trim()].slice(0, 120).join("") || t.name,
        status: "queued",
        total: check.rows.length,
        concurrency: Math.max(1, Math.min(64, c.concurrency ?? 2)),
        createdBy: c.userId,
        ...(c.sourceAssetId ? { sourceAssetId: c.sourceAssetId } : {}),
      })
      .returning();
    for (let i = 0; i < check.rows.length; i += 500)
      await tx.insert(batchItems).values(
        check.rows.slice(i, i + 500).map((variables, j) => ({
          workspaceId: c.workspaceId,
          batchId: b!.id,
          rowIndex: i + j + 1,
          variables,
        })),
      );
    return b!.id;
  });
  await advanceBatch(deps, c.workspaceId, batchId, gate);
  return { ok: true, batchId, total: check.rows.length };
}

const ZERO: Record<ItemStatus, number> = { pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 };

async function counts(tx: Tx, batchId: string): Promise<Record<ItemStatus, number>> {
  const rows = await tx
    .select({ status: batchItems.status, n: sql<number>`count(*)::int` })
    .from(batchItems)
    .where(eq(batchItems.batchId, batchId))
    .groupBy(batchItems.status);
  return { ...ZERO, ...Object.fromEntries(rows.map((r) => [r.status, r.n])) };
}

/** Estimated quota of one row: the template's duration and narration length. */
function estimate(spec: VideoSpec, values: Record<string, string>, durationSec?: number) {
  const text = substituteVariables(spec, values)
    .script.map((p) => p.text)
    .join(" ");
  return { videoSeconds: Math.round(durationSec ?? spec.meta.targetDurationSec), ttsChars: [...text].length };
}

/**
 * Start as many pending rows as concurrency allows. The batch row is locked (FOR UPDATE) so concurrent
 * callers (several workers finishing rows at once) never start the same row twice.
 */
export async function advanceBatch(
  deps: ServiceDeps,
  workspaceId: string,
  batchId: string,
  gate?: BatchGate,
): Promise<{ started: number; status: BatchStatus }> {
  const planConcurrency = gate ? await gate.concurrency(workspaceId) : Number.POSITIVE_INFINITY;
  const watermark = (await (gate?.watermark ?? deps.watermark)?.(workspaceId)) ?? false;
  const toStart: Array<{
    itemId: string;
    projectId: string;
    runId: string;
    spec: VideoSpec;
    settings: TemplateSettings;
    created: boolean;
  }> = [];
  let paused = false;
  const status = await withWorkspace(deps.db, workspaceId, async (tx) => {
    await tx.execute(sql`SELECT id FROM batches WHERE id = ${batchId} FOR UPDATE`);
    const [b] = await tx.select().from(batches).where(eq(batches.id, batchId));
    if (!b) throw new ProjectError("not_found");
    if (b.status === "cancelled") return b.status;
    const t = await getTemplate(tx, b.templateId);
    const settings = t.settings as unknown as TemplateSettings;
    const items = await tx
      .select()
      .from(batchItems)
      .where(and(eq(batchItems.batchId, batchId), inArray(batchItems.status, ["pending", "running"])))
      .orderBy(asc(batchItems.rowIndex));
    const [{ n: runningInWorkspace } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(batchItems)
      .where(eq(batchItems.status, "running"));
    const free = slotsFree({
      batchConcurrency: b.concurrency,
      planConcurrency,
      runningInWorkspace,
      runningInBatch: items.filter((i) => i.status === "running").length,
    });
    for (const item of pickNext(items, free)) {
      const spec = substituteVariables(t.spec as VideoSpec, item.variables);
      const runId = randomUUID();
      let projectId = item.projectId;
      const created = !projectId;
      if (!projectId) {
        const [p] = await tx
          .insert(projects)
          .values({
            workspaceId,
            title: [...`${b.name} · #${item.rowIndex}`].slice(0, 80).join(""),
            mode: "auto",
            status: "producing_audio",
            primaryAspect: settings.aspects[0]!,
            exportAspects: settings.aspects,
            createdBy: b.createdBy,
            settings: {
              ...(settings.voiceId ? { voiceId: settings.voiceId } : {}),
              ...(settings.durationSec ? { durationSec: settings.durationSec } : {}),
              batchId,
            },
            runId,
            templateId: t.id,
          })
          .returning();
        projectId = p!.id;
      } else {
        await tx
          .update(projects)
          .set({ status: "producing_audio", runId, updatedAt: new Date() })
          .where(eq(projects.id, projectId));
      }
      if (
        gate &&
        !(await gate.reserve(
          workspaceId,
          projectId,
          estimate(t.spec as VideoSpec, item.variables, settings.durationSec),
        ))
      ) {
        paused = true;
        if (created) await tx.delete(projects).where(eq(projects.id, projectId));
        break;
      }
      await tx
        .update(batchItems)
        .set({
          status: "running",
          projectId,
          attempts: sql`${batchItems.attempts} + 1`,
          errorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(batchItems.id, item.id));
      toStart.push({ itemId: item.id, projectId, runId, spec, settings, created });
    }
    const c = await counts(tx, batchId);
    const next = paused ? "paused_quota" : batchStateOf(c, toStart.length ? "running" : b.status);
    const final = next === "completed" || next === "completed_with_errors";
    await tx
      .update(batches)
      .set({
        status: next,
        succeeded: c.succeeded,
        failed: c.failed,
        updatedAt: new Date(),
        ...(final ? { finishedAt: new Date() } : {}),
      })
      .where(eq(batches.id, batchId));
    return next;
  });

  for (const s of toStart) {
    try {
      const workDir = workDirOf(deps, workspaceId, s.projectId);
      // A retried row starts from a clean work dir state (the voice cache in steps/ is kept).
      mkdirSync(workDir, { recursive: true });
      const input: ProduceInput = {
        prompt: s.spec.script[0]?.text ?? "Video",
        aspects: s.settings.aspects,
        mode: "auto",
        ...(watermark ? { watermark } : {}),
        ...(s.settings.voiceId ? { voiceId: s.settings.voiceId } : {}),
        ...(s.settings.durationSec ? { durationSec: s.settings.durationSec } : {}),
        ...(s.settings.brand ? { brand: s.settings.brand } : {}),
      };
      saveState(workDir, {
        input,
        spec: s.spec,
        ...(s.settings.styleId ? { styleId: s.settings.styleId } : {}),
        ...(s.settings.music ? { music: s.settings.music } : {}),
        usage: [],
      });
      await enqueueProduceVideo(
        deps.connection,
        BATCH_STAGES.map((name) => ({ name, queue: STAGE_QUEUE[name] })),
        { workspaceId, projectId: s.projectId, versionId: s.runId, workDir, input },
        { ...qopts(deps), priority: BATCH_PRIORITY },
      );
    } catch (e) {
      console.error("batch row enqueue failed", (e as Error).message);
      await batchProjectFinished(deps, workspaceId, s.projectId, false, gate, "enqueue_failed");
    }
  }
  return { started: toStart.length, status };
}

/**
 * A row's project finished (worker hook). Marks the item, settles quota, starts more rows, and assembles
 * the ZIP when the batch is complete. Projects that are not batch rows are ignored.
 */
export async function batchProjectFinished(
  deps: ServiceDeps,
  workspaceId: string,
  projectId: string,
  ok: boolean,
  gate?: BatchGate,
  errorCode = "render_failed",
): Promise<void> {
  const item = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const [it] = await tx
      .select()
      .from(batchItems)
      .where(and(eq(batchItems.projectId, projectId), eq(batchItems.status, "running")));
    if (!it) return null;
    let outputId: string | null = null;
    if (ok) {
      const [p] = await tx.select().from(projects).where(eq(projects.id, projectId));
      const [o] = p?.headVersionId
        ? await tx
            .select({ id: renderOutputs.id })
            .from(renderOutputs)
            .where(eq(renderOutputs.versionId, p.headVersionId))
            .limit(1)
        : [];
      outputId = o?.id ?? null;
    }
    await tx
      .update(batchItems)
      .set({
        status: ok ? "succeeded" : "failed",
        errorCode: ok ? null : errorCode,
        renderOutputId: outputId,
        updatedAt: new Date(),
      })
      .where(eq(batchItems.id, it.id));
    return it;
  });
  if (!item) return;
  await gate?.settle(workspaceId, projectId, ok);
  const { status } = await advanceBatch(deps, workspaceId, item.batchId, gate);
  if (status === "completed" || status === "completed_with_errors")
    await assembleZip(deps, workspaceId, item.batchId);
}

/** Put every failed row back to pending and start them again; other rows are not touched. */
export async function retryFailedRows(
  deps: ServiceDeps,
  workspaceId: string,
  batchId: string,
  gate?: BatchGate,
): Promise<number> {
  const n = await withWorkspace(deps.db, workspaceId, async (tx) => {
    await tx.execute(sql`SELECT id FROM batches WHERE id = ${batchId} FOR UPDATE`);
    const [b] = await tx.select().from(batches).where(eq(batches.id, batchId));
    if (!b) throw new ProjectError("not_found");
    if (b.status === "cancelled") throw new ProjectError("conflict");
    const rows = await tx
      .update(batchItems)
      .set({ status: "pending", errorCode: null, updatedAt: new Date() })
      .where(and(eq(batchItems.batchId, batchId), eq(batchItems.status, "failed")))
      .returning({ id: batchItems.id });
    if (rows.length)
      await tx
        .update(batches)
        .set({ status: "running", zipKey: null, finishedAt: null, updatedAt: new Date() })
        .where(eq(batches.id, batchId));
    return rows.length;
  });
  if (n) await advanceBatch(deps, workspaceId, batchId, gate);
  return n;
}

/** Resume a batch paused for quota (after an upgrade or new credits). */
export async function resumeBatch(deps: ServiceDeps, workspaceId: string, batchId: string, gate?: BatchGate) {
  await withWorkspace(deps.db, workspaceId, (tx) =>
    tx
      .update(batches)
      .set({ status: "running", updatedAt: new Date() })
      .where(and(eq(batches.id, batchId), eq(batches.status, "paused_quota"))),
  );
  return advanceBatch(deps, workspaceId, batchId, gate);
}

/** Cancel: pending rows are dropped; running rows finish but start nothing new. */
export async function cancelBatch(deps: ServiceDeps, workspaceId: string, batchId: string) {
  await withWorkspace(deps.db, workspaceId, async (tx) => {
    await tx
      .update(batchItems)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(batchItems.batchId, batchId), eq(batchItems.status, "pending")));
    await tx
      .update(batches)
      .set({ status: "cancelled", updatedAt: new Date(), finishedAt: new Date() })
      .where(eq(batches.id, batchId));
  });
}

/** ZIP of every successful row (video + subtitles per aspect), streamed to a temp file then uploaded. */
export async function assembleZip(
  deps: ServiceDeps,
  workspaceId: string,
  batchId: string,
): Promise<string | null> {
  const { b, rows } = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const [b] = await tx.select().from(batches).where(eq(batches.id, batchId));
    const rows = await tx
      .select({
        rowIndex: batchItems.rowIndex,
        variables: batchItems.variables,
        projectId: batchItems.projectId,
      })
      .from(batchItems)
      .where(and(eq(batchItems.batchId, batchId), eq(batchItems.status, "succeeded")))
      .orderBy(asc(batchItems.rowIndex));
    return { b, rows };
  });
  if (!b || !rows.length) return null;
  const outputs = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const ids = rows.map((r) => r.projectId!).filter(Boolean);
    const ps = await tx
      .select({ id: projects.id, head: projects.headVersionId })
      .from(projects)
      .where(inArray(projects.id, ids));
    const heads = ps.map((p) => p.head).filter((x): x is string => !!x);
    const outs = heads.length
      ? await tx.select().from(renderOutputs).where(inArray(renderOutputs.versionId, heads))
      : [];
    return { ps, outs };
  });
  const dir = mkdtempSync(join(tmpdir(), "mkv-zip-"));
  const file = join(dir, "batch.zip");
  try {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(file);
      out.on("error", reject);
      out.on("finish", resolve);
      const zip = new Zip((err, chunk, final) => {
        if (err) return reject(err);
        out.write(chunk);
        if (final) out.end();
      });
      void (async () => {
        try {
          for (const r of rows) {
            const head = outputs.ps.find((p) => p.id === r.projectId)?.head;
            const label = Object.values(r.variables)[0] ?? "";
            const outs = outputs.outs.filter((x) => x.versionId === head);
            for (const o of outs) {
              const multi = outs.length > 1 ? `-${aspectSlug(o.aspect as AspectRatio)}` : "";
              const files: Array<[string | null, string]> = [
                [o.storageKey, "mp4"],
                [o.srtKey, "srt"],
              ];
              for (const [key, ext] of files) {
                if (!key) continue;
                const entry = new ZipPassThrough(zipEntryName(r.rowIndex, `${label}${multi}`, ext, b.total));
                zip.add(entry);
                const stream = await deps.store.getStream(key);
                for await (const chunk of stream as AsyncIterable<Uint8Array>) entry.push(chunk);
                entry.push(new Uint8Array(0), true);
              }
            }
          }
          zip.end();
        } catch (e) {
          reject(e as Error);
        }
      })();
    });
    const key = workspaceKey(workspaceId, "batches", batchId, `batch-${randomUUID().slice(0, 8)}.zip`);
    await deps.store.putFile(key, file, { contentType: "application/zip" });
    await withWorkspace(deps.db, workspaceId, (tx) =>
      tx.update(batches).set({ zipKey: key, updatedAt: new Date() }).where(eq(batches.id, batchId)),
    );
    return key;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Batch page data: counts per status, rows (paged) with signed links for finished videos. */
export async function batchView(deps: ServiceDeps, workspaceId: string, batchId: string) {
  const data = await withWorkspace(deps.db, workspaceId, async (tx) => {
    const [b] = await tx.select().from(batches).where(eq(batches.id, batchId));
    if (!b) throw new ProjectError("not_found");
    const items = await tx
      .select()
      .from(batchItems)
      .where(eq(batchItems.batchId, batchId))
      .orderBy(asc(batchItems.rowIndex));
    const outIds = items.map((i) => i.renderOutputId).filter((x): x is string => !!x);
    const outs = outIds.length
      ? await tx.select().from(renderOutputs).where(inArray(renderOutputs.id, outIds))
      : [];
    const projectIds = items.map((i) => i.projectId).filter((x): x is string => !!x);
    const ps = projectIds.length
      ? await tx
          .select({ id: projects.id, status: projects.status })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : [];
    const [t] = await tx
      .select({ name: templates.name, variables: templates.variables })
      .from(templates)
      .where(eq(templates.id, b.templateId));
    return { b, items, outs, ps, t, c: await counts(tx, batchId) };
  });
  const sign = (k: string | null | undefined) =>
    k ? deps.store.signedGetUrl(k, 3600) : Promise.resolve(null);
  return {
    batch: {
      id: data.b.id,
      name: data.b.name,
      status: data.b.status,
      total: data.b.total,
      counts: data.c,
      createdAt: data.b.createdAt,
      finishedAt: data.b.finishedAt,
      zip: await sign(data.b.zipKey),
      template: data.t ? { id: data.b.templateId, name: data.t.name, variables: data.t.variables } : null,
    },
    items: await Promise.all(
      data.items.map(async (i) => {
        const o = data.outs.find((x) => x.id === i.renderOutputId);
        return {
          row: i.rowIndex,
          variables: i.variables,
          status: i.status,
          projectStatus: data.ps.find((p) => p.id === i.projectId)?.status ?? null,
          projectId: i.projectId,
          attempts: i.attempts,
          errorCode: i.errorCode,
          video: await sign(o?.storageKey),
        };
      }),
    ),
  };
}
export type BatchView = Awaited<ReturnType<typeof batchView>>;

/**
 * Worker hooks: after the persistence hooks (`base`, dbSink) record a finished or failed render, tell the
 * batch so it can start the next rows. Projects that are not batch rows are a no-op.
 */
export function withBatchHooks(base: StageHooks, deps: ServiceDeps, gate?: BatchGate): StageHooks {
  return {
    ...base,
    async onStageDone(d, stage, state) {
      await base.onStageDone?.(d, stage, state);
      if (stage === "render") await batchProjectFinished(deps, d.workspaceId, d.projectId, true, gate);
    },
    async onStageFailed(d, stage, err) {
      await base.onStageFailed?.(d, stage, err);
      await batchProjectFinished(deps, d.workspaceId, d.projectId, false, gate, `${stage}_failed`);
    },
  };
}
