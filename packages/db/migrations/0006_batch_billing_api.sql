-- 0006: M5 — templates + batches (US5), roles/invitations, plans, quota, payments (US6), API keys + webhooks
-- (US7), platform admin (US9). Tenant tables use RLS like 0002/0005.
--
-- Two scoped escapes from tenant isolation, both opt-in per transaction and only used by server code:
--   app.scope = 'service' : full access, for flows that start without a tenant (payment webhooks, API-key
--                           lookup, invitation acceptance, batch dispatch). See withService() in packages/db.
--   app.scope = 'admin'   : read-only access to every tenant, for the platform admin area (withAdmin()).

CREATE FUNCTION app_scope() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.scope', true), '') $$;
GRANT EXECUTE ON FUNCTION app_scope() TO makvid_app;

-- Platform admins (US9): set by an operator in SQL, never through the app.
ALTER TABLE users ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------- templates and batches (US5)

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  -- Frozen copy of the source version's spec: later edits of the project do not change the template.
  version_id uuid NOT NULL,
  spec jsonb NOT NULL,
  name text NOT NULL,
  -- [{name, type: "text"|"number", required, maxLength}]
  variables jsonb NOT NULL DEFAULT '[]',
  -- production settings copied from the project (voice, aspects, brand kit id)
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX templates_workspace_idx ON templates(workspace_id, created_at DESC);

ALTER TABLE projects ADD COLUMN template_id uuid REFERENCES templates(id) ON DELETE SET NULL;

CREATE TYPE batch_status AS ENUM (
  'validating', 'queued', 'running', 'completed', 'completed_with_errors', 'paused_quota', 'cancelled'
);
CREATE TYPE batch_item_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES templates(id),
  source_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  name text NOT NULL,
  status batch_status NOT NULL DEFAULT 'validating',
  total integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  -- items in flight at once for this batch (capped by the plan's concurrent_jobs)
  concurrency integer NOT NULL DEFAULT 2 CHECK (concurrency BETWEEN 1 AND 64),
  zip_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX batches_workspace_idx ON batches(workspace_id, created_at DESC);

CREATE TABLE batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  variables jsonb NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  status batch_item_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_code text,
  render_output_id uuid REFERENCES render_outputs(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batch_items_row_uq UNIQUE (batch_id, row_index)
);
CREATE INDEX batch_items_status_idx ON batch_items(batch_id, status, row_index);
CREATE INDEX batch_items_project_idx ON batch_items(project_id);

-- ---------------------------------------------------------------- invitations (US6)

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role membership_role NOT NULL CHECK (role <> 'owner'),
  -- sha256 of the token sent by email; the token itself is never stored
  token_hash text NOT NULL UNIQUE,
  invited_by uuid,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_workspace_idx ON invitations(workspace_id, created_at DESC);

-- ---------------------------------------------------------------- plans, subscriptions, credits, quota

-- Global catalog (not tenant data). Limits and prices are edited by platform admins.
CREATE TABLE plans (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{2,32}$'),
  name_i18n jsonb NOT NULL,
  interval text CHECK (interval IN ('month', 'year')),
  price_usd numeric(10, 2) NOT NULL DEFAULT 0,
  price_vnd integer NOT NULL DEFAULT 0,
  -- {videos, video_seconds, tts_chars, ai_images, storage_bytes, concurrent_jobs, max_video_seconds,
  --  batch_enabled, api_enabled, mediagen_enabled}; null limit = unlimited
  limits jsonb NOT NULL,
  watermark boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30,
  polar_product_id text,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON plans TO makvid_app;

-- Default catalog. Prices and limits are placeholders until the product owner sets them (M5 report).
INSERT INTO plans (id, name_i18n, interval, price_usd, price_vnd, limits, watermark, retention_days, sort) VALUES
  ('free', '{"vi": "Miễn phí", "en": "Free"}', 'month', 0, 0,
   '{"videos": 3, "video_seconds": 180, "tts_chars": 6000, "ai_images": 0, "storage_bytes": 524288000,
     "concurrent_jobs": 1, "max_video_seconds": 60, "batch_enabled": false, "api_enabled": false,
     "mediagen_enabled": false}', true, 7, 0),
  ('starter', '{"vi": "Cơ bản", "en": "Starter"}', 'month', 19, 490000,
   '{"videos": 60, "video_seconds": 3600, "tts_chars": 150000, "ai_images": 100, "storage_bytes": 10737418240,
     "concurrent_jobs": 2, "max_video_seconds": 180, "batch_enabled": true, "api_enabled": true,
     "mediagen_enabled": true}', false, 30, 1),
  ('pro', '{"vi": "Chuyên nghiệp", "en": "Pro"}', 'month', 49, 1250000,
   '{"videos": 300, "video_seconds": 18000, "tts_chars": 750000, "ai_images": 500, "storage_bytes": 53687091200,
     "concurrent_jobs": 4, "max_video_seconds": 600, "batch_enabled": true, "api_enabled": true,
     "mediagen_enabled": true}', false, 90, 2);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  provider text NOT NULL CHECK (provider IN ('polar', 'payos', 'manual', 'mock')),
  provider_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'revoked')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_provider_ref_uq UNIQUE (provider, provider_ref)
);
CREATE INDEX subscriptions_workspace_idx ON subscriptions(workspace_id, current_period_end DESC);

-- Extra video seconds bought as credit packs. Balance = sum(delta).
CREATE TABLE credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  delta_seconds integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('purchase', 'consume', 'refund', 'grant', 'clawback')),
  ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_ledger_ref_uq UNIQUE (workspace_id, reason, ref)
);

-- Counters per billing period. Reservations move amounts into `reserved`; settle moves them to `used`.
CREATE TABLE usage_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  used jsonb NOT NULL DEFAULT '{}',
  reserved jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT usage_periods_uq UNIQUE (workspace_id, period_start)
);

CREATE TABLE quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES usage_periods(id) ON DELETE CASCADE,
  project_id uuid,
  -- {videos, video_seconds, tts_chars, ai_images, credit_seconds}
  amounts jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX quota_reservations_project_idx ON quota_reservations(project_id) WHERE status = 'reserved';

-- Checkout orders we created (amount checked against the webhook before anything is granted).
CREATE TABLE payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('polar', 'payos', 'mock')),
  kind text NOT NULL CHECK (kind IN ('plan', 'credits')),
  plan_id text REFERENCES plans(id),
  credit_seconds integer,
  -- prepaid months for one-off plan purchases (PayOS)
  months integer,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL CHECK (currency IN ('USD', 'VND')),
  -- PayOS orderCode (integer, unique per merchant)
  order_code bigint UNIQUE,
  provider_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled', 'refunded')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX payment_orders_workspace_idx ON payment_orders(workspace_id, created_at DESC);
CREATE SEQUENCE payment_order_code_seq START 100001;
GRANT USAGE ON SEQUENCE payment_order_code_seq TO makvid_app;

-- Webhook deliveries from payment providers: unique (provider, event_id) makes processing idempotent.
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  type text NOT NULL,
  workspace_id uuid,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_uq UNIQUE (provider, event_id)
);

-- Free-plan abuse signals (hashed; no raw IP or device id stored).
CREATE TABLE abuse_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text,
  device_hash text,
  email_domain text,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX abuse_signals_ip_idx ON abuse_signals(ip_hash, created_at);
CREATE INDEX abuse_signals_device_idx ON abuse_signals(device_hash, created_at);

-- ---------------------------------------------------------------- public API (US7)

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- first characters of the key, shown in the UI and used to find the row; the rest is only hashed
  prefix text NOT NULL UNIQUE,
  hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['videos:write', 'videos:read'],
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_workspace_idx ON api_keys(workspace_id);

CREATE TABLE webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~ '^https?://'),
  -- AES-256-GCM with MAKVID_SECRET_KEY (iv.tag.ciphertext, base64url)
  secret_enc text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['video.completed', 'video.failed', 'batch.completed'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_endpoints_workspace_idx ON webhook_endpoints(workspace_id);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_http_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT webhook_deliveries_uq UNIQUE (endpoint_id, event_id)
);

CREATE TABLE idempotency_keys (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  request_hash text NOT NULL,
  status integer,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, key)
);

-- ---------------------------------------------------------------- row-level security

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['templates','batches','batch_items','invitations','subscriptions','credit_ledger',
                           'usage_periods','quota_reservations','payment_orders','api_keys','webhook_endpoints',
                           'webhook_deliveries','idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (workspace_id = app_workspace_id()) WITH CHECK (workspace_id = app_workspace_id())', t || '_tenant', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO makvid_app', t);
  END LOOP;
END $$;

-- Service and admin scopes on every tenant table (existing and new).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','memberships','source_materials','projects','project_versions','jobs',
                           'render_outputs','qa_reports','usage_records','chat_messages','assets','brand_kits',
                           'media_gen_cache','templates','batches','batch_items','invitations','subscriptions',
                           'credit_ledger','usage_periods','quota_reservations','payment_orders','api_keys',
                           'webhook_endpoints','webhook_deliveries','idempotency_keys'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I USING (app_scope() = ''service'') WITH CHECK (app_scope() = ''service'')', t || '_service', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (app_scope() = ''admin'')', t || '_admin', t);
  END LOOP;
END $$;

-- payment_events and abuse_signals are platform data (no tenant): only service code touches them.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_events','abuse_signals'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (app_scope() = ''service'') WITH CHECK (app_scope() = ''service'')', t || '_service', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (app_scope() = ''admin'')', t || '_admin', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO makvid_app', t);
  END LOOP;
END $$;
-- Plans are edited only by platform admins through service code.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON plans FOR SELECT USING (true);
CREATE POLICY plans_service ON plans USING (app_scope() = 'service') WITH CHECK (app_scope() = 'service');
GRANT UPDATE ON plans TO makvid_app;
