// Activity log of a production run (spec 003). Rows hold a message key + small params; the text is built
// on read from an allow-list of messages, so a technology or provider name can never reach the user.
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { projectEvents, withWorkspace, type Db } from "@makvid/db";
import { PROGRESS_MESSAGES } from "./messages";

/** Stages shown to the user, in order. The internal `preview` step is shown as part of `storyboard`. */
export const LOG_STAGES = ["script", "style", "storyboard", "audio", "qa", "render"] as const;
export type LogStage = (typeof LOG_STAGES)[number];

export const EVENT_KINDS = [
  "stage_start",
  "progress",
  "stage_done",
  "approval_needed",
  "approved",
  "warning",
  "error",
  "retry",
  "done",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventSeverity = "info" | "warning" | "error";
export type EventParams = Record<string, string | number>;

/** Fixed `local_seq` of entries that have no job (one of each per stage and run) or that end a job. */
export const LOCAL_SEQ = { approval_needed: 1, approved: 2, done: 3, stage_done: 1_000_000, error: 1_000_001 };

export function toLogStage(stage: string): LogStage {
  if (stage === "preview") return "storyboard";
  return (LOG_STAGES as readonly string[]).includes(stage) ? (stage as LogStage) : "script";
}

const START: Record<LogStage, [string, string]> = {
  script: ["Bắt đầu viết lời đọc", "Started writing the voice-over"],
  style: ["Bắt đầu chọn phong cách", "Started choosing a style"],
  storyboard: ["Bắt đầu phân cảnh và tạo ảnh xem trước", "Started planning scenes and previews"],
  audio: ["Bắt đầu tạo giọng đọc và âm thanh", "Started creating the voice and sound"],
  qa: ["Bắt đầu kiểm tra chất lượng", "Started the quality check"],
  render: ["Bắt đầu dựng video", "Started rendering the video"],
};
const DONE: Record<LogStage, [string, string]> = {
  script: ["Đã viết xong lời đọc", "The voice-over is written"],
  style: ["Đã chọn xong phong cách", "The style is chosen"],
  storyboard: ["Đã phân cảnh xong", "The scenes are planned"],
  audio: ["Đã tạo xong giọng đọc và âm thanh", "The voice and sound are ready"],
  qa: ["Đã kiểm tra xong chất lượng", "The quality check is finished"],
  render: ["Đã dựng xong video", "The video is rendered"],
};

/** Extra messages written by the log itself. Keys are the allow-list together with PROGRESS_MESSAGES. */
export const LOG_MESSAGES: Record<"vi" | "en", Record<string, string>> = (() => {
  const vi: Record<string, string> = {
    "log.approval.needed.script": "Lời đọc đã sẵn sàng, đang chờ bạn duyệt",
    "log.approval.needed.storyboard": "Phân cảnh đã sẵn sàng, đang chờ bạn duyệt",
    "log.approved.script": "Bạn đã duyệt lời đọc, tiếp tục sản xuất",
    "log.approved.storyboard": "Bạn đã duyệt phân cảnh, tiếp tục sản xuất",
    "log.retry": "Gặp trục trặc nhỏ, đang thử lại (lần {attempt})",
    "log.error.generic": "Bước này chưa hoàn thành được. Bạn có thể thử lại.",
    "log.done": "Video đã sẵn sàng",
  };
  const en: Record<string, string> = {
    "log.approval.needed.script": "The voice-over is ready and waiting for your approval",
    "log.approval.needed.storyboard": "The scenes are ready and waiting for your approval",
    "log.approved.script": "You approved the voice-over, production continues",
    "log.approved.storyboard": "You approved the scenes, production continues",
    "log.retry": "A small hiccup, trying again (attempt {attempt})",
    "log.error.generic": "This step could not be finished. You can try again.",
    "log.done": "Your video is ready",
  };
  for (const s of LOG_STAGES) {
    vi[`log.start.${s}`] = START[s][0];
    en[`log.start.${s}`] = START[s][1];
    vi[`log.done.${s}`] = DONE[s][0];
    en[`log.done.${s}`] = DONE[s][1];
  }
  return { vi, en };
})();

export function isLogKey(key: string): boolean {
  return key in LOG_MESSAGES.vi || key in PROGRESS_MESSAGES.vi;
}

/** Localized text of a stored entry. Unknown keys fall back to a neutral sentence, never to the raw key. */
export function logText(key: string, params: EventParams = {}, locale: "vi" | "en" = "vi"): string {
  const t = LOG_MESSAGES[locale][key] ?? PROGRESS_MESSAGES[locale][key] ?? LOG_MESSAGES[locale]["log.error.generic"]!;
  return t.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
}

export interface NewEvent {
  workspaceId: string;
  projectId: string;
  runId: string | null;
  jobId?: string | null;
  attempt?: number;
  localSeq?: number;
  stage: string;
  kind: EventKind;
  severity?: EventSeverity;
  key: string;
  params?: EventParams;
  fraction?: number | null;
}

/** Params are numbers or short plain strings only (no free text from jobs). */
function cleanParams(p: EventParams = {}): EventParams {
  const out: EventParams = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.length <= 40 && /^[\w .:/-]*$/.test(v)) out[k] = v;
  }
  return out;
}

/**
 * Append one entry. Idempotent: the same (job, attempt, local_seq) or (run, stage, kind, local_seq) is
 * ignored. A key outside the allow-list is dropped (returns false) so nothing unvetted is ever stored.
 */
export async function recordEvent(db: Db, e: NewEvent): Promise<boolean> {
  if (!isLogKey(e.key)) return false;
  const stage = toLogStage(e.stage);
  await withWorkspace(db, e.workspaceId, (tx) =>
    tx
      .insert(projectEvents)
      .values({
        workspaceId: e.workspaceId,
        projectId: e.projectId,
        runId: e.runId,
        jobId: e.jobId ?? null,
        attempt: e.attempt ?? 0,
        localSeq: e.localSeq ?? 0,
        stage,
        kind: e.kind,
        severity: e.severity ?? (e.kind === "error" ? "error" : e.kind === "warning" ? "warning" : "info"),
        key: e.key,
        params: cleanParams(e.params),
        fraction: e.fraction ?? null,
      })
      .onConflictDoNothing(),
  );
  return true;
}

/** The user approved a review point: written into the run that is waiting (the newest one). */
export async function recordApproval(
  db: Db,
  workspaceId: string,
  projectId: string,
  point: "script_review" | "storyboard_review",
): Promise<void> {
  const run = await latestRun(db, workspaceId, projectId);
  if (!run) return;
  const stage = point === "script_review" ? "script" : "storyboard";
  await recordEvent(db, {
    workspaceId,
    projectId,
    runId: run.runId,
    stage,
    kind: "approved",
    localSeq: LOCAL_SEQ.approved,
    key: `log.approved.${stage}`,
  });
}

export interface LogEntry {
  seq: number;
  at: string;
  stage: LogStage;
  kind: EventKind;
  severity: EventSeverity;
  text: string;
  fraction: number | null;
}

type Row = typeof projectEvents.$inferSelect;
const toEntry = (r: Row, locale: "vi" | "en"): LogEntry => ({
  seq: r.id,
  at: r.createdAt.toISOString(),
  stage: toLogStage(r.stage),
  kind: r.kind as EventKind,
  severity: r.severity as EventSeverity,
  text: logText(r.key, r.params, locale),
  fraction: r.fraction ?? null,
});

/** Run id of the newest entry: older runs (before an edit or a re-render) are not shown. */
async function latestRun(db: Db, workspaceId: string, projectId: string) {
  return withWorkspace(db, workspaceId, async (tx) => {
    const [r] = await tx
      .select({ runId: projectEvents.runId })
      .from(projectEvents)
      .where(eq(projectEvents.projectId, projectId))
      .orderBy(desc(projectEvents.id))
      .limit(1);
    return r ? { runId: r.runId } : null;
  });
}

export interface ListOptions {
  after?: number;
  before?: number;
  limit?: number;
  locale?: "vi" | "en";
}

/** Entries of the newest run in order. `after` pages forward, `before` returns the page before a cursor. */
export async function listEvents(db: Db, workspaceId: string, projectId: string, o: ListOptions = {}) {
  const limit = Math.min(Math.max(o.limit ?? 200, 1), 200);
  const locale = o.locale ?? "vi";
  const run = await latestRun(db, workspaceId, projectId);
  if (!run) return { entries: [] as LogEntry[], hasMore: false, nextAfter: o.after ?? 0, rows: [] as Row[] };
  const rows = await withWorkspace(db, workspaceId, async (tx) => {
    const same = and(
      eq(projectEvents.projectId, projectId),
      run.runId === null ? sql`${projectEvents.runId} IS NULL` : eq(projectEvents.runId, run.runId),
    );
    if (o.before !== undefined) {
      const r = await tx
        .select()
        .from(projectEvents)
        .where(and(same, lt(projectEvents.id, o.before)))
        .orderBy(desc(projectEvents.id))
        .limit(limit + 1);
      return r.reverse();
    }
    return tx
      .select()
      .from(projectEvents)
      .where(and(same, gt(projectEvents.id, o.after ?? 0)))
      .orderBy(asc(projectEvents.id))
      .limit(limit + 1);
  });
  const hasMore = rows.length > limit;
  const page = o.before !== undefined ? rows.slice(rows.length - Math.min(rows.length, limit)) : rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    entries: page.map((r) => toEntry(r, locale)),
    hasMore,
    nextAfter: last ? last.id : (o.after ?? 0),
    rows: page,
  };
}

/** All entries of the newest run, for stage states (small: a few hundred rows at most). */
export async function runEvents(db: Db, workspaceId: string, projectId: string) {
  const out: Row[] = [];
  let after = 0;
  for (;;) {
    const r = await listEvents(db, workspaceId, projectId, { after, limit: 200 });
    out.push(...r.rows);
    if (!r.hasMore) return out;
    after = r.nextAfter;
  }
}

export type StageState = "waiting" | "running" | "needs_approval" | "done" | "failed";

/**
 * State of every stage from the entries of the newest run and the project status. The last entry of a
 * stage decides; a stage without entries is done when a later stage has started, otherwise waiting.
 */
export function stageStates(
  rows: Pick<Row, "stage" | "kind">[],
  status: string,
): { stage: LogStage; state: StageState }[] {
  const last = new Map<LogStage, EventKind>();
  for (const r of rows) last.set(toLogStage(r.stage), r.kind as EventKind);
  let lastSeen = -1;
  LOG_STAGES.forEach((s, i) => {
    if (last.has(s)) lastSeen = i;
  });
  const out = LOG_STAGES.map((stage, i) => {
    const k = last.get(stage);
    let state: StageState;
    if (!k) state = i < lastSeen ? "done" : "waiting";
    else if (k === "approval_needed") state = "needs_approval";
    else if (k === "error") state = "failed";
    else if (k === "stage_done" || k === "approved" || k === "done") state = "done";
    else state = "running";
    return { stage, state };
  });
  if (status === "awaiting_script_review") out.find((s) => s.stage === "script")!.state = "needs_approval";
  if (status === "awaiting_storyboard_review") out.find((s) => s.stage === "storyboard")!.state = "needs_approval";
  if (status === "ready") for (const s of out) s.state = "done";
  if ((status === "failed" || status === "needs_attention") && !out.some((s) => s.state === "failed")) {
    const running = out.find((s) => s.state === "running");
    if (running && status === "failed") running.state = "failed";
  }
  return out;
}
