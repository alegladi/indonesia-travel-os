CREATE TABLE IF NOT EXISTS brain_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  area text NOT NULL CHECK (area IN ('VITA PRIVATA','DA NIALTRI','ARREDO SERVICE','ALEGLADI')),
  project text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','doing','waiting','done','cancelled')),
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  due_at timestamptz,
  owner text,
  source_type text,
  source_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_tasks_area_status_idx ON brain_tasks(area, status);
CREATE INDEX IF NOT EXISTS brain_tasks_due_idx ON brain_tasks(due_at) WHERE status NOT IN ('done','cancelled');

CREATE TABLE IF NOT EXISTS brain_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL,
  objective text,
  status text NOT NULL DEFAULT 'active',
  next_action text,
  owner text,
  due_at timestamptz,
  blockers text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, area)
);

CREATE TABLE IF NOT EXISTS brain_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  amount_cents integer,
  currency text NOT NULL DEFAULT 'EUR',
  direction text NOT NULL CHECK (direction IN ('income','expense')),
  due_at timestamptz,
  paid_at timestamptz,
  recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  source_type text,
  source_id text,
  confidence text NOT NULL DEFAULT 'verified',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_finance_due_idx ON brain_finance_entries(due_at);

CREATE TABLE IF NOT EXISTS brain_sync_runs (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  account text,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_seen integer NOT NULL DEFAULT 0,
  items_changed integer NOT NULL DEFAULT 0,
  error text
);

CREATE INDEX IF NOT EXISTS brain_sync_runs_source_idx ON brain_sync_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS brain_activity (
  id bigserial PRIMARY KEY,
  area text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  source_type text,
  source_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS brain_activity_area_time_idx ON brain_activity(area, occurred_at DESC);

-- Revocable, device-aware sessions. Only a SHA-256 token hash is stored.
CREATE TABLE IF NOT EXISTS brain_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  auth_method text NOT NULL DEFAULT 'google',
  user_email text,
  device_label text,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS brain_sessions_active_idx ON brain_sessions(expires_at) WHERE revoked_at IS NULL;

-- OAuth credentials are encrypted application-side with BRAIN_TOKEN_ENCRYPTION_KEY.
-- Never store plaintext access/refresh tokens in this table.
CREATE TABLE IF NOT EXISTS brain_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  account_key text NOT NULL,
  account_email text,
  scopes text[] NOT NULL DEFAULT '{}',
  encrypted_refresh_token text,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, account_key)
);

CREATE INDEX IF NOT EXISTS brain_integrations_provider_idx ON brain_integrations(provider, status);
