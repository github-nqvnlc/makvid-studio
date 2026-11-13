// 0006: invitations, plans, subscriptions, credits, quota, payments, abuse signals (US6, T138).
import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
// Same Postgres type as schema.ts membershipRole (declared once in SQL).
const role = pgEnum("membership_role", ["owner", "admin", "editor", "viewer"]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  email: text("email").notNull(),
  role: role("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by"),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  revokedAt: ts("revoked_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export interface PlanLimits {
  /** null = unlimited */
  videos: number | null;
  video_seconds: number | null;
  tts_chars: number | null;
  ai_images: number | null;
  storage_bytes: number | null;
  concurrent_jobs: number;
  max_video_seconds: number;
  batch_enabled: boolean;
  api_enabled: boolean;
  mediagen_enabled: boolean;
}

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  nameI18n: jsonb("name_i18n").$type<{ vi: string; en: string }>().notNull(),
  interval: text("interval").$type<"month" | "year">(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  priceVnd: integer("price_vnd").notNull().default(0),
  limits: jsonb("limits").$type<PlanLimits>().notNull(),
  watermark: boolean("watermark").notNull().default(false),
  retentionDays: integer("retention_days").notNull().default(30),
  polarProductId: text("polar_product_id"),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type SubscriptionProvider = "polar" | "payos" | "manual" | "mock";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "revoked";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    planId: text("plan_id").notNull(),
    provider: text("provider").$type<SubscriptionProvider>().notNull(),
    providerRef: text("provider_ref").notNull(),
    status: text("status").$type<SubscriptionStatus>().notNull(),
    currentPeriodStart: ts("current_period_start").notNull(),
    currentPeriodEnd: ts("current_period_end").notNull(),
    cancelAt: ts("cancel_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("subscriptions_provider_ref_uq").on(t.provider, t.providerRef)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    deltaSeconds: integer("delta_seconds").notNull(),
    reason: text("reason").$type<"purchase" | "consume" | "refund" | "grant" | "clawback">().notNull(),
    ref: text("ref").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("credit_ledger_ref_uq").on(t.workspaceId, t.reason, t.ref)],
);

export type QuotaKey = "videos" | "video_seconds" | "tts_chars" | "ai_images" | "credit_seconds";
export type QuotaCounters = Partial<Record<QuotaKey, number>>;

export const usagePeriods = pgTable(
  "usage_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    periodStart: ts("period_start").notNull(),
    periodEnd: ts("period_end").notNull(),
    used: jsonb("used").$type<QuotaCounters>().notNull().default({}),
    reserved: jsonb("reserved").$type<QuotaCounters>().notNull().default({}),
  },
  (t) => [unique("usage_periods_uq").on(t.workspaceId, t.periodStart)],
);

export const quotaReservations = pgTable("quota_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  periodId: uuid("period_id").notNull(),
  projectId: uuid("project_id"),
  amounts: jsonb("amounts").$type<QuotaCounters>().notNull(),
  status: text("status").$type<"reserved" | "committed" | "released">().notNull().default("reserved"),
  createdAt: ts("created_at").notNull().defaultNow(),
  settledAt: ts("settled_at"),
});

export const paymentOrders = pgTable("payment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  provider: text("provider").$type<"polar" | "payos" | "mock">().notNull(),
  kind: text("kind").$type<"plan" | "credits">().notNull(),
  planId: text("plan_id"),
  creditSeconds: integer("credit_seconds"),
  months: integer("months"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").$type<"USD" | "VND">().notNull(),
  orderCode: bigint("order_code", { mode: "number" }).unique(),
  providerRef: text("provider_ref"),
  status: text("status").$type<"pending" | "paid" | "canceled" | "refunded">().notNull().default("pending"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  paidAt: ts("paid_at"),
});

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    workspaceId: uuid("workspace_id"),
    payload: jsonb("payload").notNull(),
    processedAt: ts("processed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("payment_events_uq").on(t.provider, t.eventId)],
);

export const abuseSignals = pgTable("abuse_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  ipHash: text("ip_hash"),
  deviceHash: text("device_hash"),
  emailDomain: text("email_domain"),
  kind: text("kind").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
