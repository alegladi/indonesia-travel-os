CREATE TABLE IF NOT EXISTS brain_system_events (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  component text NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  title text NOT NULL,
  detail text,
  actor text NOT NULL DEFAULT 'system',
  version text,
  previous_state jsonb,
  new_state jsonb,
  rollback_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_system_events_time_idx ON brain_system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS brain_system_events_component_idx ON brain_system_events(component,created_at DESC);

CREATE TABLE IF NOT EXISTS brain_health_samples (
  id bigserial PRIMARY KEY,
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','attention','problem')),
  latency_ms integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brain_health_samples_component_time_idx ON brain_health_samples(component,checked_at DESC);

CREATE TABLE IF NOT EXISTS brain_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem text NOT NULL,
  cause text,
  solution text,
  result text,
  learned_rule text,
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','verified','rejected','superseded')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS brain_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  title text NOT NULL,
  reason text,
  expected_impact text,
  risk text,
  estimated_cost text,
  reversible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','applied','rejected','failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  applied_at timestamptz
);
CREATE INDEX IF NOT EXISTS brain_suggestions_status_idx ON brain_suggestions(status,created_at DESC);
