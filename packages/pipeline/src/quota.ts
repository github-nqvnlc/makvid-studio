// Quota wiring for workers and batches (US6, T139): the reservation made before enqueue is committed with the
// real video length when the render finishes, or released when the run fails for good.
import { planOf, QuotaError, reserve, settle } from "@makvid/billing";
import type { Db } from "@makvid/db";
import type { BatchGate } from "./batch";
import type { StageHooks } from "./worker";

/** Batch gate backed by the workspace plan: concurrency, reservations per row, watermark. */
export function billingGate(db: Db): BatchGate {
  return {
    async concurrency(workspaceId) {
      return (await planOf(db, workspaceId)).limits.concurrent_jobs;
    },
    async reserve(workspaceId, projectId, e) {
      try {
        await reserve(
          db,
          workspaceId,
          { videoSeconds: e.videoSeconds, ttsChars: e.ttsChars, feature: "batch" },
          projectId,
        );
        return true;
      } catch (err) {
        if (err instanceof QuotaError) return false;
        throw err;
      }
    },
    async settle(workspaceId, projectId, ok) {
      await settle(db, workspaceId, { projectId }, ok);
    },
    async watermark(workspaceId) {
      return (await planOf(db, workspaceId)).watermark;
    },
  };
}

/** Settle a project's reservation when its render is done (real length) or its run failed for good. */
export function withQuotaHooks(base: StageHooks, db: Db): StageHooks {
  return {
    ...base,
    async onStageDone(d, stage, state) {
      await base.onStageDone?.(d, stage, state);
      if (stage !== "render") return;
      const seconds = Math.max(0, ...(state.outputs ?? []).map((o) => o.durationSec));
      const ttsChars = state.usage.reduce((n, u) => n + (u.ttsChars ?? 0), 0);
      await settle(db, d.workspaceId, { projectId: d.projectId }, true, {
        ...(seconds > 0 ? { videoSeconds: seconds } : {}),
        ...(ttsChars > 0 ? { ttsChars } : {}),
      });
    },
    async onStageFailed(d, stage, err) {
      await base.onStageFailed?.(d, stage, err);
      await settle(db, d.workspaceId, { projectId: d.projectId }, false);
    },
  };
}
