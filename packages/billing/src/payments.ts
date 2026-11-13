// Checkout orders and payment webhooks (ADR 0004): provider-neutral, idempotent per (provider, event_id).
// Nothing is granted unless the paid amount matches the order we created.
import { and, eq, sql } from "drizzle-orm";
import {
  creditLedger,
  paymentEvents,
  paymentOrders,
  plans,
  subscriptions,
  withService,
  withWorkspace,
  type Db,
  type Tx,
} from "@makvid/db";
import type { PaymentEvent, PaymentProvider } from "./providers/types";

/** Credit packs (extra video seconds). Prices are placeholders until the product owner sets them. */
export const CREDIT_PACKS = [
  { id: "min30", seconds: 30 * 60, usd: 9, vnd: 230_000 },
  { id: "min120", seconds: 120 * 60, usd: 29, vnd: 740_000 },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export class PaymentError extends Error {
  constructor(readonly code: "unknown_plan" | "unknown_pack" | "not_purchasable" | "provider_unavailable") {
    super(code);
    this.name = "PaymentError";
  }
}

export interface CheckoutInput {
  workspaceId: string;
  userId: string;
  email?: string;
  provider: PaymentProvider;
  item: { kind: "plan"; planId: string; months?: number } | { kind: "credits"; packId: CreditPackId };
  successUrl: string;
  cancelUrl: string;
  /** Polar product id of a credit pack (env), when buying credits with Polar. */
  packProductId?: string;
}

/** Create our order, then the provider checkout; returns the URL to send the customer to. */
export async function startCheckout(db: Db, c: CheckoutInput): Promise<{ orderId: string; url: string }> {
  const currency = c.provider.id === "payos" ? ("VND" as const) : ("USD" as const);
  const order = await withWorkspace(db, c.workspaceId, async (tx) => {
    let amount: number;
    let planId: string | null = null;
    let creditSeconds: number | null = null;
    let months: number | null = null;
    let productId: string | undefined;
    if (c.item.kind === "plan") {
      const [p] = await tx.select().from(plans).where(eq(plans.id, c.item.planId));
      if (!p || !p.active || p.id === "free") throw new PaymentError("unknown_plan");
      planId = p.id;
      if (currency === "VND") {
        months = Math.max(1, Math.min(12, c.item.months ?? 1));
        amount = p.priceVnd * months;
      } else {
        if (!p.polarProductId && c.provider.id === "polar") throw new PaymentError("not_purchasable");
        if (p.polarProductId) productId = p.polarProductId;
        amount = Number(p.priceUsd);
      }
    } else {
      const pack = CREDIT_PACKS.find((x) => x.id === (c.item as { packId: string }).packId);
      if (!pack) throw new PaymentError("unknown_pack");
      creditSeconds = pack.seconds;
      amount = currency === "VND" ? pack.vnd : pack.usd;
      if (currency === "USD") {
        if (!c.packProductId && c.provider.id === "polar") throw new PaymentError("not_purchasable");
        productId = c.packProductId;
      }
    }
    const orderCode =
      c.provider.id === "payos"
        ? Number((await tx.execute(sql`SELECT nextval('payment_order_code_seq') AS n`))[0]!.n)
        : null;
    const [o] = await tx
      .insert(paymentOrders)
      .values({
        workspaceId: c.workspaceId,
        provider: c.provider.id,
        kind: c.item.kind,
        planId,
        creditSeconds,
        months,
        amount: amount.toFixed(2),
        currency,
        orderCode,
        createdBy: c.userId,
      })
      .returning();
    return { row: o!, productId };
  });
  const session = await c.provider.createCheckout({
    workspaceId: c.workspaceId,
    orderId: order.row.id,
    kind: c.item.kind,
    amount: Number(order.row.amount),
    ...(order.productId ? { productId: order.productId } : {}),
    ...(order.row.orderCode ? { orderCode: order.row.orderCode } : {}),
    description: `MKV${order.row.orderCode ?? ""}`,
    ...(c.email ? { customerEmail: c.email } : {}),
    successUrl: c.successUrl,
    cancelUrl: c.cancelUrl,
  });
  await withWorkspace(db, c.workspaceId, (tx) =>
    tx
      .update(paymentOrders)
      .set({ providerRef: session.providerRef })
      .where(eq(paymentOrders.id, order.row.id)),
  );
  return { orderId: order.row.id, url: session.url };
}

export type HandleResult = "processed" | "duplicate" | "ignored" | "rejected";

const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
};

async function grantPlan(
  tx: Tx,
  o: typeof paymentOrders.$inferSelect,
  e: Extract<PaymentEvent, { kind: "paid" }>,
): Promise<void> {
  if (o.provider === "polar" && e.subscriptionRef) {
    const start = e.periodStart ?? new Date();
    const end = e.periodEnd ?? addMonths(start, 1);
    await tx
      .insert(subscriptions)
      .values({
        workspaceId: o.workspaceId,
        planId: o.planId!,
        provider: "polar",
        providerRef: e.subscriptionRef,
        status: "active",
        currentPeriodStart: start,
        currentPeriodEnd: end,
      })
      .onConflictDoUpdate({
        target: [subscriptions.provider, subscriptions.providerRef],
        set: { status: "active", currentPeriodStart: start, currentPeriodEnd: end, updatedAt: new Date() },
      });
    return;
  }
  // One-off prepaid period (PayOS, mock): extends the current prepaid period of the same plan.
  const now = new Date();
  const [cur] = await tx
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.workspaceId, o.workspaceId),
        eq(subscriptions.planId, o.planId!),
        eq(subscriptions.provider, o.provider),
        sql`${subscriptions.currentPeriodEnd} > now()`,
      ),
    )
    .limit(1);
  const months = o.months ?? 1;
  if (cur)
    await tx
      .update(subscriptions)
      .set({ currentPeriodEnd: addMonths(cur.currentPeriodEnd, months), status: "active", updatedAt: now })
      .where(eq(subscriptions.id, cur.id));
  else
    await tx.insert(subscriptions).values({
      workspaceId: o.workspaceId,
      planId: o.planId!,
      provider: o.provider,
      providerRef: o.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, months),
    });
}

/** Apply a verified provider event. Safe to call again with the same event (returns "duplicate"). */
export async function handlePaymentEvent(
  db: Db,
  provider: PaymentProvider["id"],
  e: PaymentEvent,
): Promise<HandleResult> {
  return withService(db, async (tx) => {
    const [stored] = await tx
      .insert(paymentEvents)
      .values({
        provider,
        eventId: e.eventId,
        type: e.kind === "ignored" ? e.type : e.kind,
        payload: e as unknown as Record<string, unknown>,
        ...("workspaceId" in e && e.workspaceId ? { workspaceId: e.workspaceId } : {}),
      })
      .onConflictDoNothing()
      .returning();
    if (!stored) return "duplicate";
    const done = async (r: HandleResult, workspaceId?: string) => {
      await tx
        .update(paymentEvents)
        .set({ processedAt: new Date(), ...(workspaceId ? { workspaceId } : {}) })
        .where(eq(paymentEvents.id, stored.id));
      return r;
    };
    switch (e.kind) {
      case "ignored":
        return done("ignored");
      case "paid": {
        const [o] = e.orderId
          ? await tx
              .select()
              .from(paymentOrders)
              .where(and(eq(paymentOrders.id, e.orderId), eq(paymentOrders.provider, provider)))
          : e.orderCode
            ? await tx
                .select()
                .from(paymentOrders)
                .where(and(eq(paymentOrders.orderCode, e.orderCode), eq(paymentOrders.provider, provider)))
            : [];
        if (!o) {
          // Polar renewal: the order has no metadata from our checkout; extend the subscription.
          if (e.subscriptionRef && e.periodEnd) {
            const r = await tx
              .update(subscriptions)
              .set({
                status: "active",
                currentPeriodEnd: e.periodEnd,
                ...(e.periodStart ? { currentPeriodStart: e.periodStart } : {}),
                updatedAt: new Date(),
              })
              .where(
                and(eq(subscriptions.provider, provider), eq(subscriptions.providerRef, e.subscriptionRef)),
              )
              .returning();
            return done(r.length ? "processed" : "ignored", r[0]?.workspaceId);
          }
          return done("ignored");
        }
        if (o.status === "paid") return done("duplicate", o.workspaceId);
        // The paid amount must cover the order (currency and value), or nothing is granted.
        if (e.currency !== o.currency || e.amount + 1e-6 < Number(o.amount))
          return done("rejected", o.workspaceId);
        await tx
          .update(paymentOrders)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(paymentOrders.id, o.id));
        if (o.kind === "credits")
          await tx
            .insert(creditLedger)
            .values({
              workspaceId: o.workspaceId,
              deltaSeconds: o.creditSeconds!,
              reason: "purchase",
              ref: o.id,
            })
            .onConflictDoNothing();
        else await grantPlan(tx, o, e);
        return done("processed", o.workspaceId);
      }
      case "subscription": {
        const [plan] = e.productId
          ? await tx.select().from(plans).where(eq(plans.polarProductId, e.productId))
          : [];
        const [existing] = await tx
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.provider, provider), eq(subscriptions.providerRef, e.subscriptionRef)));
        if (existing) {
          await tx
            .update(subscriptions)
            .set({
              status: e.status,
              currentPeriodStart: e.periodStart,
              // revoked = access ends now
              currentPeriodEnd: e.status === "revoked" ? new Date() : e.periodEnd,
              cancelAt: e.cancelAt ?? null,
              ...(plan ? { planId: plan.id } : {}),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, existing.id));
          return done("processed", existing.workspaceId);
        }
        if (!plan || !e.workspaceId || e.status === "revoked") return done("ignored");
        await tx.insert(subscriptions).values({
          workspaceId: e.workspaceId,
          planId: plan.id,
          provider: provider as "polar",
          providerRef: e.subscriptionRef,
          status: e.status,
          currentPeriodStart: e.periodStart,
          currentPeriodEnd: e.periodEnd,
          ...(e.cancelAt ? { cancelAt: e.cancelAt } : {}),
        });
        return done("processed", e.workspaceId);
      }
      case "refund": {
        const [o] = e.orderId
          ? await tx.select().from(paymentOrders).where(eq(paymentOrders.id, e.orderId))
          : [];
        if (!o) return done("ignored");
        await tx.update(paymentOrders).set({ status: "refunded" }).where(eq(paymentOrders.id, o.id));
        if (o.kind === "credits")
          await tx
            .insert(creditLedger)
            .values({
              workspaceId: o.workspaceId,
              deltaSeconds: -o.creditSeconds!,
              reason: "clawback",
              ref: o.id,
            })
            .onConflictDoNothing();
        return done("processed", o.workspaceId);
      }
    }
  });
}
