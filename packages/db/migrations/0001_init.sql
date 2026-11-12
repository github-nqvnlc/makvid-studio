-- 0001: users, workspaces, memberships + row-level security by workspace (data-model.md, constitution VII).
-- The application queries tenant data as role makvid_app inside withWorkspace(), which sets
-- app.workspace_id for the transaction; FORCE RLS makes policies apply even to the table owner.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE makvid_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  locale text NOT NULL DEFAULT 'vi',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_workspace_user_uq UNIQUE (workspace_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id);

-- Current tenant for this transaction (NULL when unset -> policies match nothing).
CREATE FUNCTION app_workspace_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspaces_tenant ON workspaces USING (id = app_workspace_id()) WITH CHECK (id = app_workspace_id());

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_tenant ON memberships USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id());

GRANT USAGE ON SCHEMA public TO makvid_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, workspaces, memberships TO makvid_app;
GRANT EXECUTE ON FUNCTION app_workspace_id() TO makvid_app;
