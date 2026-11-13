// 0006: public API keys, webhooks, idempotency keys (US7, T145).
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(),
  hash: text("hash").notNull(),
  scopes: text("scopes").array().notNull(),
  createdBy: uuid("created_by"),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  url: text("url").notNull(),
  secretEnc: text("secret_enc").notNull(),
  events: text("events").array().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    endpointId: uuid("endpoint_id").notNull(),
    eventId: text("event_id").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").$type<"pending" | "delivered" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastHttpStatus: integer("last_http_status"),
    createdAt: ts("created_at").notNull().defaultNow(),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [unique("webhook_deliveries_uq").on(t.endpointId, t.eventId)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    workspaceId: uuid("workspace_id").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: integer("status"),
    response: jsonb("response"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);
