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
