-- 0002: projects, versions, jobs, render cache/outputs, QA reports, usage records (data-model.md, T068).
-- Every tenant table carries workspace_id and is protected by RLS like 0001.

CREATE TYPE project_mode AS ENUM ('auto', 'review');
CREATE TYPE project_status AS ENUM (
  'draft', 'ingesting', 'scripting', 'awaiting_script_review', 'styling', 'storyboarding',
  'awaiting_storyboard_review', 'producing_audio', 'compiling', 'qa', 'rendering',
  'ready', 'needs_attention', 'failed'
);
CREATE TYPE source_kind AS ENUM ('prompt', 'script', 'url', 'github', 'table', 'media');
CREATE TYPE pipeline_step AS ENUM (
  'ingest', 'script', 'style_suggest', 'storyboard', 'tts', 'align', 'compile', 'qa', 'render_scene', 'mux'
);
CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'skipped_cached');

CREATE TABLE source_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind source_kind NOT NULL,
  markdown text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  attachments uuid[] NOT NULL DEFAULT '{}',
  transcript jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  mode project_mode NOT NULL DEFAULT 'auto',
  status project_status NOT NULL DEFAULT 'draft',
  head_version_id uuid,
  source_material_id uuid REFERENCES source_materials(id),
  primary_aspect text NOT NULL DEFAULT '9:16',
  export_aspects text[] NOT NULL DEFAULT '{9:16}',
  is_template boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX projects_workspace_idx ON projects(workspace_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_version_id uuid REFERENCES project_versions(id),
  seq integer NOT NULL,
  spec jsonb NOT NULL,
  spec_version text NOT NULL,
  patch jsonb,
  author text NOT NULL, -- 'ai' or a user id
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_versions_seq_uq UNIQUE (project_id, seq)
);
ALTER TABLE projects ADD CONSTRAINT projects_head_fk FOREIGN KEY (head_version_id) REFERENCES project_versions(id);

-- Versions are immutable: block UPDATE of content columns.
CREATE FUNCTION project_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'project_versions are immutable';
END $$;
CREATE TRIGGER project_versions_no_update BEFORE UPDATE ON project_versions
  FOR EACH ROW EXECUTE FUNCTION project_versions_immutable();

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  step pipeline_step NOT NULL,
  input_hash text NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 5,
  progress real NOT NULL DEFAULT 0,
  user_message_key text,
  error_code text,
  error_detail text, -- internal only, never shown to users
  output jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_idempotency_uq UNIQUE (version_id, step, input_hash)
);
CREATE INDEX jobs_project_idx ON jobs(project_id, created_at);

-- Global content-addressed render cache (no workspace data inside; access is checked by the caller).
CREATE TABLE render_cache (
  cache_key text PRIMARY KEY,
  storage_key text NOT NULL,
  frames integer NOT NULL,
  duration_ms integer NOT NULL,
  engine text NOT NULL,
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE render_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  aspect text NOT NULL,
  storage_key text NOT NULL,
  srt_key text,
  thumbnail_key text,
  duration_ms integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  fps integer NOT NULL,
  loudness_lufs real,
  watermarked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE qa_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scene_id text NOT NULL,
  frame_ms integer NOT NULL,
  checks jsonb NOT NULL,
  score real,
  passed boolean NOT NULL,
  fix_attempt integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  step text NOT NULL,
  provider text NOT NULL,
  model text,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  tts_chars integer NOT NULL DEFAULT 0,
  images integer NOT NULL DEFAULT 0,
  video_seconds_generated real NOT NULL DEFAULT 0,
  render_seconds real NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_records_workspace_idx ON usage_records(workspace_id, created_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['source_materials','projects','project_versions','jobs','render_outputs','qa_reports','usage_records'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id())', t || '_tenant', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO makvid_app', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE ON render_cache TO makvid_app;
