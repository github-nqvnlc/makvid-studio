// T137: quota decision (unit) and reserve / commit / release with real Postgres, including concurrent
// reservations that must never overshoot a limit (MAKVID_INFRA_TESTS=1 for the database part).
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  connect,
  creditLedger,
  memberships,
  migrate,
  paymentOrders,
  subscriptions,
  users,
  withWorkspace,
  workspaces,
  type Db,
  type PlanLimits,
} from "@makvid/db";
import { creditBalance, decide, handlePaymentEvent, QuotaError, reserve, settle, usageSummary } from "../src";

const FREE: PlanLimits = {
  videos: 3,
  video_seconds: 180,
  tts_chars: 6000,
  ai_images: 0,
  storage_bytes: 1,
  concurrent_jobs: 1,
  max_video_seconds: 60,
  batch_enabled: false,
  api_enabled: false,
  mediagen_enabled: false,
};

describe("decide (no I/O)", () => {
  it("free plan: 60 s max, no batch/API/AI images, 3 videos", () => {
    expect(decide(FREE, {}, {}, 0, { videoSeconds: 61 })).toEqual({ ok: false, reason: "max_video_seconds" });
    expect(decide(FREE, {}, {}, 0, { videoSeconds: 30, feature: "batch" })).toEqual({
      ok: false,
      reason: "batch_disabled",
    });
    expect(decide(FREE, {}, {}, 0, { videoSeconds: 30, feature: "api" })).toEqual({
      ok: false,
      reason: "api_disabled",
    });
    expect(decide(FREE, {}, {}, 0, { videoSeconds: 30, aiImages: 1 })).toEqual({
      ok: false,
      reason: "mediagen_disabled",
    });
    expect(decide(FREE, { videos: 2 }, { videos: 1 }, 0, { videoSeconds: 30 })).toEqual({
      ok: false,
      reason: "videos",
    });
    expect(decide(FREE, { videos: 2 }, {}, 0, { videoSeconds: 30, ttsChars: 500 })).toEqual({
      ok: true,
      amounts: { videos: 1, video_seconds: 30, tts_chars: 500 },
    });
  });

  it("seconds beyond the plan come from credits, else the request is refused", () => {
    const pro = { ...FREE, videos: null, max_video_seconds: 600, video_seconds: 100 };
    expect(decide(pro, { video_seconds: 80 }, {}, 0, { videoSeconds: 50 })).toEqual({
      ok: false,
      reason: "video_seconds",
    });
    expect(decide(pro, { video_seconds: 80 }, {}, 60, { videoSeconds: 50 })).toEqual({
      ok: true,
      amounts: { videos: 1, video_seconds: 20, credit_seconds: 30 },
    });
  });
});

const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_quota_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("quota with Postgres", () => {
  let db: Db;
  let close: () => Promise<void>;
  const ws = "66666666-6666-4666-8666-666666666666";

  beforeAll(async () => {
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    await migrate(url);
    ({ db, close } = connect(url, 12));
    const [u] = await db.insert(users).values({ email: "q@example.test" }).returning();
    await withWorkspace(db, ws, async (tx) => {
      await tx.insert(workspaces).values({ id: ws, name: "Q", slug: "q", createdBy: u!.id });
      await tx.insert(memberships).values({ workspaceId: ws, userId: u!.id, role: "owner" });
    });
  }, 60_000);
  afterAll(async () => {
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.end();
  });

  it("10 concurrent reservations on the free plan: exactly 3 succeed, 7 are refused before any cost", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => reserve(db, ws, { videoSeconds: 45, ttsChars: 600 })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(refused.every((r) => (r as PromiseRejectedResult).reason instanceof QuotaError)).toBe(true);
    expect(((refused[0] as PromiseRejectedResult).reason as QuotaError).reason).toBe("videos");
    const s = await usageSummary(db, ws);
    expect(s.plan.id).toBe("free");
    expect(s.reserved).toMatchObject({ videos: 3, video_seconds: 135, tts_chars: 1800 });
    expect(s.used).toEqual({});
  });

  it("commit uses the real amounts (never more than reserved); release frees everything; settle is idempotent", async () => {
    const before = await usageSummary(db, ws);
    const res = await withWorkspace(db, ws, (tx) =>
      tx.execute(
        // the three reservations from the previous test
        `SELECT id FROM quota_reservations WHERE status = 'reserved' ORDER BY created_at` as never,
      ),
    );
    const ids = (res as unknown as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toHaveLength(3);
    expect(
      await settle(db, ws, { reservationId: ids[0]! }, true, { videoSeconds: 40.2, ttsChars: 580 }),
    ).toBe(true);
    expect(await settle(db, ws, { reservationId: ids[0]! }, true)).toBe(false);
    expect(await settle(db, ws, { reservationId: ids[1]! }, false)).toBe(true);
    const after = await usageSummary(db, ws);
    expect(after.used).toMatchObject({ videos: 1, video_seconds: 41, tts_chars: 580 });
    expect(after.reserved).toMatchObject({ videos: 1, video_seconds: 45, tts_chars: 600 });
    expect(before.reserved.videos).toBe(3);
    // A released slot can be reserved again.
    const again = await reserve(db, ws, { videoSeconds: 30 });
    expect(again.amounts.videos).toBe(1);
    await expect(reserve(db, ws, { videoSeconds: 30 })).rejects.toBeInstanceOf(QuotaError);
  });

  it("a paid plan (via payment webhook) lifts limits; credits cover overflow and are refunded on failure", async () => {
    const [order] = await withWorkspace(db, ws, (tx) =>
      tx
        .insert(paymentOrders)
        .values({
          workspaceId: ws,
          provider: "mock",
          kind: "plan",
          planId: "starter",
          months: 1,
          amount: "19.00",
          currency: "USD",
        })
        .returning(),
    );
    // Underpaid: nothing granted.
    expect(
      await handlePaymentEvent(db, "mock", {
        kind: "paid",
        eventId: "x0",
        orderId: order!.id,
        amount: 1,
        currency: "USD",
      }),
    ).toBe("rejected");
    expect(
      await handlePaymentEvent(db, "mock", {
        kind: "paid",
        eventId: "x1",
        orderId: order!.id,
        amount: 19,
        currency: "USD",
      }),
    ).toBe("processed");
    expect(
      await handlePaymentEvent(db, "mock", {
        kind: "paid",
        eventId: "x1",
        orderId: order!.id,
        amount: 19,
        currency: "USD",
      }),
    ).toBe("duplicate");
    const subs = await withWorkspace(db, ws, (tx) => tx.select().from(subscriptions));
    expect(subs.map((s) => [s.planId, s.status])).toEqual([["starter", "active"]]);
    const s = await usageSummary(db, ws);
    expect(s.plan.id).toBe("starter");
    expect(s.plan.watermark).toBe(false);

    // Starter: 3600 s/month. Fill it, then buy credits for the overflow.
    await withWorkspace(db, ws, (tx) =>
      tx.execute(
        `INSERT INTO usage_periods (workspace_id, period_start, period_end, used) VALUES ('${ws}', '${s.plan.periodStart.toISOString()}', '${s.plan.periodEnd.toISOString()}', '{"video_seconds": 3590}') ON CONFLICT (workspace_id, period_start) DO UPDATE SET used = EXCLUDED.used` as never,
      ),
    );
    await expect(reserve(db, ws, { videoSeconds: 60 })).rejects.toMatchObject({ reason: "video_seconds" });
    const [credits] = await withWorkspace(db, ws, (tx) =>
      tx
        .insert(paymentOrders)
        .values({
          workspaceId: ws,
          provider: "mock",
          kind: "credits",
          creditSeconds: 1800,
          amount: "9.00",
          currency: "USD",
        })
        .returning(),
    );
    await handlePaymentEvent(db, "mock", {
      kind: "paid",
      eventId: "x2",
      orderId: credits!.id,
      amount: 9,
      currency: "USD",
    });
    const r = await reserve(db, ws, { videoSeconds: 60 });
    expect(r.amounts).toMatchObject({ video_seconds: 10, credit_seconds: 50 });
    expect(await withWorkspace(db, ws, (tx) => creditBalance(tx, ws))).toBe(1750);
    await settle(db, ws, { reservationId: r.id }, false);
    expect(await withWorkspace(db, ws, (tx) => creditBalance(tx, ws))).toBe(1800);
    // Refund of the credit order claws the credits back.
    await handlePaymentEvent(db, "mock", { kind: "refund", eventId: "x3", orderId: credits!.id, amount: 9 });
    const ledger = await withWorkspace(db, ws, (tx) =>
      tx.select().from(creditLedger).where(eq(creditLedger.ref, credits!.id)),
    );
    expect(ledger.map((l) => l.reason).sort()).toEqual(["clawback", "purchase"]);
  });
});
