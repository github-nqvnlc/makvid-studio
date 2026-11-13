// Platform admin (US9, T149; FR-051): users and workspaces, AI cost vs revenue per workspace, plans, and
// queue / worker health. Reads use the read-only admin scope (withAdmin); the few writes (plan edits, manual
// plan grants) use the service scope and are only reachable by platform admins.
import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import {
  memberships,
  paymentOrders,
  plans,
  subscriptions,
  usageRecords,
  users,
  withAdmin,
  withService,
  workspaces,
  type PlanLimits,
} from "@makvid/db";
import { WEBHOOK_QUEUE } from "@makvid/pipeline";
import { server } from "./deps";

export interface WorkspaceRow {
  id: string;
  name: string;
  owner: string;
  members: number;
  plan: string;
  videos: number;
  costUsd: number;
  revenueUsd: number;
  revenueVnd: number;
  createdAt: Date;
}

/** Workspaces with AI cost (usage_records, all time) and paid revenue (payment_orders). */
export async function adminWorkspaces(): Promise<WorkspaceRow[]> {
  return withAdmin(server().db, async (tx) => {
    const ws = await tx.select().from(workspaces).orderBy(desc(workspaces.createdAt)).limit(500);
    const cost = await tx
      .select({
        ws: usageRecords.workspaceId,
        usd: sql<string>`coalesce(sum(${usageRecords.costUsd}), 0)`,
        videos: sql<number>`count(distinct ${usageRecords.projectId})::int`,
      })
      .from(usageRecords)
      .groupBy(usageRecords.workspaceId);
    const rev = await tx
      .select({
        ws: paymentOrders.workspaceId,
        currency: paymentOrders.currency,
        total: sql<string>`coalesce(sum(${paymentOrders.amount}), 0)`,
      })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, "paid"))
      .groupBy(paymentOrders.workspaceId, paymentOrders.currency);
    const ms = await tx
      .select({ ws: memberships.workspaceId, role: memberships.role, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId));
    const subs = await tx
      .select({
        ws: subscriptions.workspaceId,
        plan: subscriptions.planId,
        end: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions);
    const now = Date.now();
    return ws.map((w) => {
      const c = cost.find((x) => x.ws === w.id);
      const r = (cur: string) => Number(rev.find((x) => x.ws === w.id && x.currency === cur)?.total ?? 0);
      const mine = ms.filter((m) => m.ws === w.id);
      const active = subs
        .filter((s) => s.ws === w.id && s.end.getTime() > now)
        .sort((a, b) => +b.end - +a.end)[0];
      return {
        id: w.id,
        name: w.name,
        owner: mine.find((m) => m.role === "owner")?.email ?? "",
        members: mine.length,
        plan: active?.plan ?? "free",
        videos: c?.videos ?? 0,
        costUsd: Number(c?.usd ?? 0),
        revenueUsd: r("USD"),
        revenueVnd: r("VND"),
        createdAt: w.createdAt,
      };
    });
  });
}

/** AI cost per pipeline step and provider (all workspaces), for the cost breakdown. */
export async function adminCostByStep() {
  return withAdmin(server().db, (tx) =>
    tx
      .select({
        step: usageRecords.step,
        provider: usageRecords.provider,
        usd: sql<string>`coalesce(sum(${usageRecords.costUsd}), 0)`,
        calls: sql<number>`count(*)::int`,
      })
      .from(usageRecords)
      .groupBy(usageRecords.step, usageRecords.provider)
      .orderBy(usageRecords.step),
  );
}

export async function adminUsers() {
  return server()
    .db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      admin: users.isPlatformAdmin,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(500);
}

export async function adminPlans() {
  return server().db.select().from(plans).orderBy(plans.sort);
}

export async function updatePlan(
  id: string,
  p: {
    priceUsd: number;
    priceVnd: number;
    limits: PlanLimits;
    watermark: boolean;
    polarProductId: string | null;
    active: boolean;
  },
) {
  await withService(server().db, (tx) =>
    tx
      .update(plans)
      .set({
        priceUsd: p.priceUsd.toFixed(2),
        priceVnd: Math.round(p.priceVnd),
        limits: p.limits,
        watermark: p.watermark,
        polarProductId: p.polarProductId,
        active: p.active,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id)),
  );
}

/** Put a workspace on a plan for N days without payment (support, partners). */
export async function grantPlan(workspaceId: string, planId: string, days: number, by: string) {
  const now = new Date();
  await withService(server().db, (tx) =>
    tx.insert(subscriptions).values({
      workspaceId,
      planId,
      provider: "manual",
      providerRef: `manual:${by}:${now.getTime()}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + days * 86400_000),
    }),
  );
}

export interface QueueHealth {
  name: string;
  counts: Record<string, number>;
  workers: number;
}

/** Waiting/active/failed counts and connected workers per queue. */
export async function queueHealth(): Promise<QueueHealth[]> {
  const { deps } = server();
  const out: QueueHealth[] = [];
  for (const name of ["ai", "audio", "render", "align", WEBHOOK_QUEUE]) {
    const q = new Queue(name, { connection: deps.connection, prefix: deps.prefix ?? "mkv" });
    try {
      const [counts, workers] = await Promise.all([
        q.getJobCounts("waiting", "prioritized", "active", "delayed", "failed", "completed"),
        q.getWorkersCount(),
      ]);
      out.push({ name, counts, workers });
    } finally {
      await q.close();
    }
  }
  return out;
}
