// Drizzle schema mirroring migrations/*.sql (SQL files are the source of truth for DDL + RLS).
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", ["owner", "admin", "editor", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("vi"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("memberships_workspace_user_uq").on(t.workspaceId, t.userId)],
);

export type Role = (typeof membershipRole.enumValues)[number];

// ---- 0002: projects & pipeline (migrations/0002_projects_pipeline.sql) ----

export const projectMode = pgEnum("project_mode", ["auto", "review"]);
export const projectStatus = pgEnum("project_status", [
  "draft",
  "ingesting",
  "scripting",
  "awaiting_script_review",
  "styling",
  "storyboarding",
  "awaiting_storyboard_review",
  "producing_audio",
  "compiling",
  "qa",
  "rendering",
  "ready",
  "needs_attention",
  "failed",
]);
export const sourceKind = pgEnum("source_kind", ["prompt", "script", "url", "github", "table", "media"]);
export const pipelineStep = pgEnum("pipeline_step", [
  "ingest",
  "script",
  "style_suggest",
  "storyboard",
  "tts",
  "align",
  "compile",
  "qa",
  "render_scene",
  "mux",
]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "skipped_cached"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const sourceMaterials = pgTable("source_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  kind: sourceKind("kind").notNull(),
  markdown: text("markdown").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  attachments: uuid("attachments").array().notNull().default([]),
  transcript: jsonb("transcript"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  title: text("title").notNull(),
  mode: projectMode("mode").notNull().default("auto"),
  status: projectStatus("status").notNull().default("draft"),
  headVersionId: uuid("head_version_id"),
  sourceMaterialId: uuid("source_material_id"),
  primaryAspect: text("primary_aspect").notNull().default("9:16"),
  exportAspects: text("export_aspects").array().notNull().default(["9:16"]),
  isTemplate: boolean("is_template").notNull().default(false),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
  settings: jsonb("settings").notNull().default({}),
  runId: uuid("run_id"),
  brandKitId: uuid("brand_kit_id"),
  templateId: uuid("template_id"),
});

export const projectVersions = pgTable("project_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  parentVersionId: uuid("parent_version_id"),
  seq: integer("seq").notNull(),
  spec: jsonb("spec").notNull(),
  specVersion: text("spec_version").notNull(),
  patch: jsonb("patch"),
  author: text("author").notNull(),
  message: text("message"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  versionId: uuid("version_id").notNull(),
  step: pipelineStep("step").notNull(),
  inputHash: text("input_hash").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(0),
  priority: integer("priority").notNull().default(5),
  progress: real("progress").notNull().default(0),
  userMessageKey: text("user_message_key"),
  errorCode: text("error_code"),
  errorDetail: text("error_detail"),
  output: jsonb("output"),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const renderCache = pgTable("render_cache", {
  cacheKey: text("cache_key").primaryKey(),
  storageKey: text("storage_key").notNull(),
  frames: integer("frames").notNull(),
  durationMs: integer("duration_ms").notNull(),
  engine: text("engine").notNull(),
  engineVersion: text("engine_version").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastHitAt: ts("last_hit_at").notNull().defaultNow(),
});

export const renderOutputs = pgTable("render_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  versionId: uuid("version_id").notNull(),
  aspect: text("aspect").notNull(),
  storageKey: text("storage_key").notNull(),
  srtKey: text("srt_key"),
  thumbnailKey: text("thumbnail_key"),
  durationMs: integer("duration_ms").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fps: integer("fps").notNull(),
  loudnessLufs: real("loudness_lufs"),
  watermarked: boolean("watermarked").notNull().default(false),
  expiresAt: ts("expires_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const qaReports = pgTable("qa_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  jobId: uuid("job_id").notNull(),
  sceneId: text("scene_id").notNull(),
  frameMs: integer("frame_ms").notNull(),
  checks: jsonb("checks").notNull(),
  score: real("score"),
  passed: boolean("passed").notNull(),
  fixAttempt: integer("fix_attempt").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  jobId: uuid("job_id"),
  step: text("step").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  ttsChars: integer("tts_chars").notNull().default(0),
  images: integer("images").notNull().default(0),
  videoSecondsGenerated: real("video_seconds_generated").notNull().default(0),
  renderSeconds: real("render_seconds").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---- 0003: auth (Better Auth) + chat (migrations/0003_auth_chat.sql) ----

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const authVerifications = pgTable("auth_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const chatRole = pgEnum("chat_role", ["user", "assistant"]);
export const chatKind = pgEnum("chat_kind", ["edit", "clarify", "info"]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  role: chatRole("role").notNull(),
  kind: chatKind("kind").notNull(),
  content: text("content").notNull(),
  targetSceneId: text("target_scene_id"),
  versionId: uuid("version_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---- 0005: brand kits + asset library (migrations/0005_brand_assets.sql) ----

export const assetKind = pgEnum("asset_kind", [
  "image",
  "video",
  "audio",
  "music",
  "voice_recording",
  "font",
  "generated_image",
  "generated_video",
]);
export const assetOrigin = pgEnum("asset_origin", ["upload", "ingest", "ai", "library"]);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    kind: assetKind("kind").notNull(),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    license: jsonb("license").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    origin: assetOrigin("origin").notNull().default("upload"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("assets_workspace_sha_uq").on(t.workspaceId, t.sha256)],
);

export const brandKits = pgTable("brand_kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  logoAssetId: uuid("logo_asset_id"),
  colors: jsonb("colors").notNull().default({}),
  fonts: jsonb("fonts").notNull().default({}),
  logoPosition: text("logo_position").notNull().default("top-right"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const mediaGenCache = pgTable("media_gen_cache", {
  cacheKey: text("cache_key").primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---- 0006: templates/batches, billing, public API ----
export * from "./schema/batch";
export * from "./schema/billing";
export * from "./schema/api";
