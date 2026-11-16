-- 0008: persisted, user-friendly activity log of a production run (spec 003, FR-019..FR-021).
-- Rows hold a message key + numeric params only; text is localized on read, so nothing technical is stored.

CREATE TABLE project_events (
  id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id uuid,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  attempt integer NOT NULL DEFAULT 0,
  local_seq integer NOT NULL DEFAULT 0,
  stage text NOT NULL,
  kind text NOT NULL CHECK (kind IN
    ('stage_start','progress','stage_done','approval_needed','approved','warning','error','retry','done')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error')),
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 120),
  params jsonb NOT NULL DEFAULT '{}',
  fraction real CHECK (fraction IS NULL OR (fraction >= 0 AND fraction <= 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent writes: a retried hook never duplicates a line.
CREATE UNIQUE INDEX project_events_job_uq ON project_events(project_id, job_id, attempt, local_seq)
  WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX project_events_nojob_uq ON project_events(project_id, run_id, stage, kind, local_seq)
  WHERE job_id IS NULL;
CREATE INDEX project_events_cursor_idx ON project_events(project_id, id);

-- Same policies as every other tenant table (see 0006).
ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_events FORCE ROW LEVEL SECURITY;
CREATE POLICY project_events_tenant ON project_events
  USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id());
CREATE POLICY project_events_service ON project_events
  USING (app_scope() = 'service') WITH CHECK (app_scope() = 'service');
CREATE POLICY project_events_admin ON project_events FOR SELECT USING (app_scope() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON project_events TO makvid_app;
GRANT USAGE, SELECT ON SEQUENCE project_events_id_seq TO makvid_app;
