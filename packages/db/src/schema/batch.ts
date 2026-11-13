// 0006: templates and batches (US5, T129). DDL + RLS in migrations/0006_batch_billing_api.sql.
import { integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export interface TemplateVariable {
  name: string;
  type: "text" | "number";
  required: boolean;
  maxLength: number;
}

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  versionId: uuid("version_id").notNull(),
  spec: jsonb("spec").notNull(),
  name: text("name").notNull(),
  variables: jsonb("variables").$type<TemplateVariable[]>().notNull().default([]),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const batchStatus = pgEnum("batch_status", [
  "validating",
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "paused_quota",
  "cancelled",
]);
export const batchItemStatus = pgEnum("batch_item_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type BatchStatus = (typeof batchStatus.enumValues)[number];
export type BatchItemStatus = (typeof batchItemStatus.enumValues)[number];

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  templateId: uuid("template_id").notNull(),
  sourceAssetId: uuid("source_asset_id"),
  name: text("name").notNull(),
  status: batchStatus("status").notNull().default("validating"),
  total: integer("total").notNull().default(0),
  succeeded: integer("succeeded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  concurrency: integer("concurrency").notNull().default(2),
  zipKey: text("zip_key"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
});

export const batchItems = pgTable(
  "batch_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    rowIndex: integer("row_index").notNull(),
    variables: jsonb("variables").$type<Record<string, string>>().notNull(),
    projectId: uuid("project_id"),
    status: batchItemStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    errorCode: text("error_code"),
    renderOutputId: uuid("render_output_id"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("batch_items_row_uq").on(t.batchId, t.rowIndex)],
);
