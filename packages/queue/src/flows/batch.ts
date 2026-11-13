// Batch flow rules (US5, T131), free of I/O so they are unit-tested on their own. The orchestration that
// reads/writes the database lives in @makvid/pipeline (batch.ts) and calls these.
//
// - A batch item runs the template's spec through voice -> QA -> render only (no AI writing): BATCH_STAGES.
// - Items run at batch priority (PRIORITY.batch), so single videos and previews overtake them in every queue.
// - At most `limit` items of one workspace are in flight at once (plan concurrent_jobs, batch concurrency).
import { PRIORITY } from "../jobs";

export const BATCH_STAGES = ["audio", "qa", "render"] as const;
export const BATCH_PRIORITY = PRIORITY.batch;

export type ItemStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

/** How many more items may start now. */
export function slotsFree(o: {
  batchConcurrency: number;
  planConcurrency: number;
  runningInWorkspace: number;
  runningInBatch: number;
}): number {
  const batchRoom = o.batchConcurrency - o.runningInBatch;
  const wsRoom = o.planConcurrency - o.runningInWorkspace;
  return Math.max(0, Math.min(batchRoom, wsRoom));
}

/** Pending items to start, lowest row first. */
export function pickNext<T extends { status: ItemStatus; rowIndex: number }>(items: T[], free: number): T[] {
  if (free <= 0) return [];
  return items
    .filter((i) => i.status === "pending")
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .slice(0, free);
}

export type BatchState =
  "queued" | "running" | "completed" | "completed_with_errors" | "paused_quota" | "cancelled";

/** Batch status from item counts (a paused or cancelled batch keeps its status until resumed). */
export function batchStateOf(
  counts: Record<ItemStatus, number>,
  current: BatchState | "validating",
): BatchState | "validating" {
  if (current === "cancelled") return current;
  const open = counts.pending + counts.running;
  if (open === 0) return counts.failed > 0 ? "completed_with_errors" : "completed";
  if (current === "paused_quota") return current;
  return counts.running > 0 || current === "running" ? "running" : "queued";
}

/** File names inside the batch ZIP: zero-padded row number + a readable slug of the first variable. */
export function zipEntryName(rowIndex: number, label: string, ext: string, total: number): string {
  const width = Math.max(3, String(total).length);
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  return `${String(rowIndex).padStart(width, "0")}${slug ? `-${slug}` : ""}.${ext}`;
}
