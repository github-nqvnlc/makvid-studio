// Quota (US6, T139): plan limits per billing period, checked and *reserved* atomically before any paid work
// is enqueued (SC-008), then committed with the real amounts or released when the work fails.
//
// - The plan is the workspace's active subscription, else "free". The period is the subscription's current
//   period, else the calendar month (UTC).
// - usage_periods holds `used` and `reserved` counters; the row is locked (SELECT ... FOR UPDATE) for every
//   reserve/settle, so concurrent reservations can never overshoot a limit.
// - Video seconds beyond the plan come from bought credits (credit_ledger, unit = seconds): a reservation
//   consumes credits up front and refunds what was not used.
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  creditLedger,
  plans,
  quotaReservations,
  subscriptions,
  usagePeriods,
  withWorkspace,
  type Db,
  type PlanLimits,
  type QuotaCounters,
  type Tx,
} from "@makvid/db";

export type QuotaDenial =
  | "videos"
  | "video_seconds"
  | "tts_chars"
  | "ai_images"
  | "max_video_seconds"
  | "batch_disabled"
  | "api_disabled"
  | "mediagen_disabled";

export class QuotaError extends Error {
  constructor(readonly reason: QuotaDenial) {
    super(`quota: ${reason}`);
    this.name = "QuotaError";
  }
}

export interface Estimate {
  videos?: number;
  videoSeconds: number;
  ttsChars?: number;
  aiImages?: number;
  /** Which feature asks (batch rows also need batch_enabled, API calls api_enabled). */
  feature?: "batch" | "api";
}

export interface ActivePlan {
  id: string;
  limits: PlanLimits;
  watermark: boolean;
  retentionDays: number;
  periodStart: Date;
  periodEnd: Date;
  subscriptionId: string | null;
}

/** Calendar month (UTC) containing `now`. */
export function monthPeriod(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function activePlan(tx: Tx, workspaceId: string, now = new Date()): Promise<ActivePlan> {
  const [sub] = await tx
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        sql`${subscriptions.status} IN ('active', 'canceled', 'past_due')`,
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);
  const planId = sub?.planId ?? "free";
  const [p] = await tx.select().from(plans).where(eq(plans.id, planId));
  if (!p) throw new Error(`plan "${planId}" missing`);
  // A subscription period longer than a month (yearly plans) still resets the counters monthly.
  const month = monthPeriod(now);
  const yearly = sub && sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime() > 40 * 86400_000;
  const periodStart = sub && !yearly ? sub.currentPeriodStart : month.start;
  const periodEnd = sub && !yearly ? sub.currentPeriodEnd : month.end;
  return {
    id: p.id,
    limits: p.limits,
    watermark: p.watermark,
    retentionDays: p.retentionDays,
    periodStart,
    periodEnd,
    subscriptionId: sub?.id ?? null,
  };
}

const add = (a: QuotaCounters, b: QuotaCounters, sign = 1): QuotaCounters => {
  const out: QuotaCounters = { ...a };
  for (const [k, v] of Object.entries(b) as Array<[keyof QuotaCounters, number]>)
    out[k] = Math.max(0, (out[k] ?? 0) + sign * v);
  return out;
};

async function lockPeriod(tx: Tx, workspaceId: string, plan: ActivePlan) {
  await tx
    .insert(usagePeriods)
    .values({ workspaceId, periodStart: plan.periodStart, periodEnd: plan.periodEnd })
    .onConflictDoNothing();
  await tx.execute(
    sql`SELECT id FROM usage_periods WHERE workspace_id = ${workspaceId} AND period_start = ${plan.periodStart.toISOString()} FOR UPDATE`,
  );
  const [row] = await tx
    .select()
    .from(usagePeriods)
    .where(and(eq(usagePeriods.workspaceId, workspaceId), eq(usagePeriods.periodStart, plan.periodStart)));
  return row!;
}

export async function creditBalance(tx: Tx, workspaceId: string): Promise<number> {
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${creditLedger.deltaSeconds}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.workspaceId, workspaceId));
  return r?.s ?? 0;
}

/** The decision itself, without I/O (unit-tested): what to reserve, or why not. */
export function decide(
  limits: PlanLimits,
  used: QuotaCounters,
  reserved: QuotaCounters,
  credits: number,
  e: Estimate,
): { ok: true; amounts: QuotaCounters } | { ok: false; reason: QuotaDenial } {
  if (e.feature === "batch" && !limits.batch_enabled) return { ok: false, reason: "batch_disabled" };
  if (e.feature === "api" && !limits.api_enabled) return { ok: false, reason: "api_disabled" };
  if ((e.aiImages ?? 0) > 0 && !limits.mediagen_enabled) return { ok: false, reason: "mediagen_disabled" };
  if (e.videoSeconds > limits.max_video_seconds) return { ok: false, reason: "max_video_seconds" };
  const taken = (k: keyof QuotaCounters) => (used[k] ?? 0) + (reserved[k] ?? 0);
  const room = (limit: number | null, k: keyof QuotaCounters) =>
    limit === null ? Number.POSITIVE_INFINITY : limit - taken(k);
  const videos = e.videos ?? 1;
  if (videos > room(limits.videos, "videos")) return { ok: false, reason: "videos" };
  if ((e.ttsChars ?? 0) > room(limits.tts_chars, "tts_chars")) return { ok: false, reason: "tts_chars" };
  if ((e.aiImages ?? 0) > room(limits.ai_images, "ai_images")) return { ok: false, reason: "ai_images" };
  const secRoom = Math.max(0, room(limits.video_seconds, "video_seconds"));
  const fromPlan = Math.min(e.videoSeconds, secRoom);
  const fromCredits = e.videoSeconds - fromPlan;
  if (fromCredits > credits) return { ok: false, reason: "video_seconds" };
  return {
    ok: true,
    amounts: {
      videos,
      video_seconds: fromPlan,
      ...(e.ttsChars ? { tts_chars: e.ttsChars } : {}),
      ...(e.aiImages ? { ai_images: e.aiImages } : {}),
      ...(fromCredits > 0 ? { credit_seconds: fromCredits } : {}),
    },
  };
}

export interface Reservation {
  id: string;
  amounts: QuotaCounters;
}

/** Reserve quota for one piece of work. Throws QuotaError (nothing reserved) when it does not fit. */
export async function reserve(
  db: Db,
  workspaceId: string,
  e: Estimate,
  projectId: string | null = null,
): Promise<Reservation> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const plan = await activePlan(tx, workspaceId);
    const period = await lockPeriod(tx, workspaceId, plan);
    const credits = await creditBalance(tx, workspaceId);
    const d = decide(plan.limits, period.used, period.reserved, credits, e);
    if (!d.ok) throw new QuotaError(d.reason);
    const { credit_seconds: credit = 0, ...counted } = d.amounts;
    await tx
      .update(usagePeriods)
      .set({ reserved: add(period.reserved, counted) })
      .where(eq(usagePeriods.id, period.id));
    const [r] = await tx
      .insert(quotaReservations)
      .values({ workspaceId, periodId: period.id, projectId, amounts: d.amounts })
      .returning();
    if (credit > 0)
      await tx
        .insert(creditLedger)
        .values({ workspaceId, deltaSeconds: -credit, reason: "consume", ref: r!.id });
    return { id: r!.id, amounts: d.amounts };
  });
}

/** Link a reservation made before the project existed. */
export async function attachReservation(
  db: Db,
  workspaceId: string,
  reservationId: string,
  projectId: string,
) {
  await withWorkspace(db, workspaceId, (tx) =>
    tx.update(quotaReservations).set({ projectId }).where(eq(quotaReservations.id, reservationId)),
  );
}

export interface Actual {
  videoSeconds?: number;
  ttsChars?: number;
  aiImages?: number;
}

/**
 * Settle a reservation: `ok` commits it (with real amounts when known, never more than reserved) and frees the
 * rest; otherwise everything is released and consumed credits are refunded. Idempotent.
 */
export async function settle(
  db: Db,
  workspaceId: string,
  by: { reservationId: string } | { projectId: string },
  ok: boolean,
  actual: Actual = {},
): Promise<boolean> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const [r] = await tx
      .select()
      .from(quotaReservations)
      .where(
        and(
          "reservationId" in by
            ? eq(quotaReservations.id, by.reservationId)
            : eq(quotaReservations.projectId, by.projectId),
          eq(quotaReservations.status, "reserved"),
        ),
      )
      .orderBy(desc(quotaReservations.createdAt))
      .limit(1);
    if (!r) return false;
    await tx.execute(sql`SELECT id FROM usage_periods WHERE id = ${r.periodId} FOR UPDATE`);
    const [period] = await tx.select().from(usagePeriods).where(eq(usagePeriods.id, r.periodId));
    const { credit_seconds: credit = 0, ...counted } = r.amounts;
    let commit: QuotaCounters = {};
    let refund = credit;
    if (ok) {
      const cap = (v: number | undefined, max: number | undefined) =>
        v === undefined ? (max ?? 0) : Math.min(Math.ceil(v), max ?? 0);
      const realSeconds = actual.videoSeconds === undefined ? undefined : Math.ceil(actual.videoSeconds);
      const planSeconds = cap(realSeconds, counted.video_seconds);
      const creditUsed =
        realSeconds === undefined ? credit : Math.max(0, Math.min(credit, realSeconds - planSeconds));
      commit = {
        videos: counted.videos ?? 0,
        video_seconds: planSeconds,
        ...(counted.tts_chars !== undefined ? { tts_chars: cap(actual.ttsChars, counted.tts_chars) } : {}),
        ...(counted.ai_images !== undefined ? { ai_images: cap(actual.aiImages, counted.ai_images) } : {}),
      };
      refund = credit - creditUsed;
    }
    await tx
      .update(usagePeriods)
      .set({ reserved: add(period!.reserved, counted, -1), used: add(period!.used, commit) })
      .where(eq(usagePeriods.id, period!.id));
    await tx
      .update(quotaReservations)
      .set({ status: ok ? "committed" : "released", settledAt: new Date() })
      .where(eq(quotaReservations.id, r.id));
    if (refund > 0)
      await tx
        .insert(creditLedger)
        .values({ workspaceId, deltaSeconds: refund, reason: "refund", ref: r.id })
        .onConflictDoNothing();
    return true;
  });
}

export interface UsageSummary {
  plan: ActivePlan;
  used: QuotaCounters;
  reserved: QuotaCounters;
  credits: number;
}

export async function usageSummary(db: Db, workspaceId: string): Promise<UsageSummary> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const plan = await activePlan(tx, workspaceId);
    const [p] = await tx
      .select()
      .from(usagePeriods)
      .where(and(eq(usagePeriods.workspaceId, workspaceId), eq(usagePeriods.periodStart, plan.periodStart)));
    return {
      plan,
      used: p?.used ?? {},
      reserved: p?.reserved ?? {},
      credits: await creditBalance(tx, workspaceId),
    };
  });
}

/** Plan of a workspace (limits + watermark), outside any caller transaction. */
export async function planOf(db: Db, workspaceId: string): Promise<ActivePlan> {
  return withWorkspace(db, workspaceId, (tx) => activePlan(tx, workspaceId));
}
