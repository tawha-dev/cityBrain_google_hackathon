CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(32) NOT NULL,
  raw_text TEXT NOT NULL,
  normalized_json JSONB,
  language VARCHAR(16) DEFAULT 'en',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  area_label VARCHAR(128),
  confidence REAL DEFAULT 0.7,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_key VARCHAR(64),
  type VARCHAR(48) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'detecting',
  title VARCHAR(256) NOT NULL,
  area_label VARCHAR(128),
  severity VARCHAR(16),
  confidence REAL,
  escalation_level VARCHAR(16) DEFAULT 'watch',
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  summary TEXT,
  dossier_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crisis_signals (
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(id) ON DELETE CASCADE,
  PRIMARY KEY (crisis_id, signal_id)
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  agent_name VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'completed',
  input_hash VARCHAR(64),
  output_json JSONB,
  model VARCHAR(64),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reasoning_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  thought TEXT NOT NULL,
  evidence_refs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE response_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  plan_json JSONB NOT NULL,
  approved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES response_plans(id) ON DELETE CASCADE,
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  action_type VARCHAR(48) NOT NULL,
  title VARCHAR(256),
  payload JSONB DEFAULT '{}',
  status VARCHAR(16) DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  tool_name VARCHAR(64) NOT NULL,
  request_json JSONB,
  response_json JSONB,
  state_delta JSONB,
  status VARCHAR(16) DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE city_state_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  phase VARCHAR(16) NOT NULL,
  metrics_json JSONB NOT NULL,
  map_state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crisis_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  crisis_type VARCHAR(48),
  area_label VARCHAR(128),
  outcome_score REAL,
  lessons JSONB DEFAULT '[]',
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(48) NOT NULL,
  name VARCHAR(128),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status VARCHAR(32) DEFAULT 'available',
  capacity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  zone_label VARCHAR(128),
  languages_json JSONB NOT NULL,
  reach_estimate INTEGER DEFAULT 0,
  delivery_status VARCHAR(32) DEFAULT 'simulated',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE route_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE CASCADE,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  polyline_json JSONB,
  reason TEXT,
  congestion_delta REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_ingested ON signals(ingested_at DESC);
CREATE INDEX idx_crises_status ON crises(status, created_at DESC);
CREATE INDEX idx_agent_runs_crisis ON agent_runs(crisis_id, created_at);
CREATE INDEX idx_execution_logs_crisis ON execution_logs(crisis_id, created_at);
CREATE INDEX idx_crisis_memory_type ON crisis_memory(crisis_type);
