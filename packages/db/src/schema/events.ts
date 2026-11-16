// 0008: persisted activity log of a production run. DDL + RLS in migrations/0008_project_events.sql.
import { bigserial, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectEvents = pgTable("project_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  runId: uuid("run_id"),
  jobId: uuid("job_id"),
  attempt: integer("attempt").notNull().default(0),
  localSeq: integer("local_seq").notNull().default(0),
  stage: text("stage").notNull(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull().default("info"),
  key: text("key").notNull(),
  params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
  fraction: real("fraction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
