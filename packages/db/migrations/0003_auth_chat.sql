-- 0003: Better Auth tables (M3, T097), chat messages (T098), production settings on projects.
-- Better Auth's "user" model is mapped onto the existing users table; sessions / accounts / verifications
-- are global (not tenant data) and only the web server's owner connection touches them.

ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN image text;
ALTER TABLE users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts(user_id);

CREATE TABLE auth_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);

-- Workspaces a user belongs to: before a workspace is chosen the app sets app.user_id (withUser) and may
-- read only that user's own memberships and the workspaces they belong to.
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION app_user_id() TO makvid_app;
CREATE POLICY memberships_self ON memberships FOR SELECT USING (user_id = app_user_id());
CREATE POLICY workspaces_member ON workspaces FOR SELECT
  USING (id IN (SELECT workspace_id FROM memberships WHERE user_id = app_user_id()));

-- Production settings chosen at creation (voice, duration, style override) and the current run.
ALTER TABLE projects ADD COLUMN settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN run_id uuid;

CREATE TYPE chat_role AS ENUM ('user', 'assistant');
CREATE TYPE chat_kind AS ENUM ('edit', 'clarify', 'info');

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  kind chat_kind NOT NULL,
  content text NOT NULL,
  target_scene_id text,
  version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_project_idx ON chat_messages(project_id, created_at);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_tenant ON chat_messages
  USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO makvid_app;
