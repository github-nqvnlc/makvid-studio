-- 0005: brand kits and the asset library (US8, T121; data-model.md). Tenant tables with RLS.
CREATE TYPE asset_kind AS ENUM (
  'image', 'video', 'audio', 'music', 'voice_recording', 'font', 'generated_image', 'generated_video'
);
CREATE TYPE asset_origin AS ENUM ('upload', 'ingest', 'ai', 'library');

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind asset_kind NOT NULL,
  name text NOT NULL,
  storage_key text NOT NULL,
  mime text NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  width integer,
  height integer,
  duration_ms integer,
  -- {source, terms, attribution}; for fonts also {family, weight}
  license jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  origin asset_origin NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_workspace_sha_uq UNIQUE (workspace_id, sha256)
);
CREATE INDEX assets_workspace_kind_idx ON assets(workspace_id, kind, created_at DESC);

CREATE TABLE brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  -- token overrides, e.g. {"bg": "#102a43", "accent": "#f7c948"}
  colors jsonb NOT NULL DEFAULT '{}',
  -- {"display": "<font asset id>", "body": "<font asset id>"}
  fonts jsonb NOT NULL DEFAULT '{}',
  logo_position text NOT NULL DEFAULT 'top-right' CHECK (logo_position IN ('top-left', 'top-right')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_kits_workspace_idx ON brand_kits(workspace_id);
-- At most one default kit per workspace.
CREATE UNIQUE INDEX brand_kits_default_uq ON brand_kits(workspace_id) WHERE is_default;

-- Media generation cache: identical requests reuse the stored result (T124).
CREATE TABLE media_gen_cache (
  cache_key text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  cost_usd numeric(12, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assets','brand_kits','media_gen_cache'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id())', t || '_tenant', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO makvid_app', t);
  END LOOP;
END $$;

-- A project may use a brand kit.
ALTER TABLE projects ADD COLUMN brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL;
