-- CityBrain AI v2 — PostgreSQL schema
-- Event sourcing · temporal tracking · severity evolution · optimized indexes
-- Requires: 001_init.sql extensions (uuid-ossp, vector) OR run extensions below

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------------
-- Upgrade from 001_init: drop superseded v1 tables (dev/docker sequential init)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS reasoning_traces CASCADE;
DROP TABLE IF EXISTS agent_runs CASCADE;
DROP TABLE IF EXISTS crisis_signals CASCADE;
DROP TABLE IF EXISTS route_overrides CASCADE;
DROP TABLE IF EXISTS city_state_snapshots CASCADE;
DROP TABLE IF EXISTS execution_logs CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS response_plans CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS crisis_memory CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS crises CASCADE;
DROP TABLE IF EXISTS signals CASCADE;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE crisis_type AS ENUM (
  'flood', 'heatwave', 'accident', 'infrastructure_failure', 'road_blockage'
);

CREATE TYPE crisis_status AS ENUM (
  'detecting', 'analyzing', 'planning', 'executing', 'reflecting',
  'monitoring', 'resolved', 'failed', 'archived'
);

CREATE TYPE severity_level AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE escalation_level AS ENUM (
  'watch', 'advisory', 'operational', 'critical'
);

CREATE TYPE action_status AS ENUM (
  'draft', 'approved', 'executing', 'completed', 'failed', 'cancelled'
);

CREATE TYPE report_source AS ENUM (
  'social', 'weather', 'traffic', 'field_report', 'sensor', 'citizen_app', 'operator'
);

CREATE TYPE report_language AS ENUM (
  'en', 'ur', 'roman_ur', 'mixed'
);

CREATE TYPE team_status AS ENUM (
  'available', 'dispatched', 'on_scene', 'returning', 'offline'
);

CREATE TYPE alert_delivery_status AS ENUM (
  'draft', 'queued', 'simulated', 'delivered', 'failed'
);

-- =============================================================================
-- EVENT STORE (append-only — source of truth for event sourcing)
-- =============================================================================

CREATE TABLE domain_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_type  VARCHAR(64) NOT NULL DEFAULT 'crisis',
  aggregate_id    UUID NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  event_version   INTEGER NOT NULL,
  payload         JSONB NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  correlation_id  UUID,
  causation_id    UUID,
  actor           VARCHAR(64) DEFAULT 'system',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_domain_events_version
    UNIQUE (aggregate_type, aggregate_id, event_version),
  CONSTRAINT chk_domain_events_version_positive
    CHECK (event_version > 0)
);

COMMENT ON TABLE domain_events IS 'Append-only event log. Projections (crisis_events, etc.) are rebuildable from this store.';

-- =============================================================================
-- CRISIS EVENTS (aggregate root / current projection)
-- =============================================================================

CREATE TABLE crisis_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_version   INTEGER NOT NULL DEFAULT 0,
  scenario_key        VARCHAR(64),
  crisis_type         crisis_type NOT NULL,
  status              crisis_status NOT NULL DEFAULT 'detecting',
  title               VARCHAR(256) NOT NULL,
  area_label          VARCHAR(128),
  summary             TEXT,

  -- Current severity snapshot (latest; history in escalation_history)
  severity            severity_level,
  escalation          escalation_level NOT NULL DEFAULT 'watch',
  confidence          REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Geospatial
  centroid_lat        DOUBLE PRECISION,
  centroid_lng        DOUBLE PRECISION,
  affected_radius_m   INTEGER DEFAULT 500,
  bbox_json           JSONB,

  -- Temporal (bi-temporal lite: system time + valid period for replanning)
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to            TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Denormalized dossier for fast reads
  dossier_json        JSONB NOT NULL DEFAULT '{}',
  metrics_json        JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT chk_crisis_events_confidence
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

COMMENT ON TABLE crisis_events IS 'Crisis aggregate current state. aggregate_version mirrors last domain_events.event_version.';
COMMENT ON COLUMN crisis_events.valid_from IS 'Business-time start of current projection version (replan bumps valid_from).';
COMMENT ON COLUMN crisis_events.valid_to IS 'NULL = current active projection row semantics at app layer.';

-- =============================================================================
-- SEVERITY / ESCALATION EVOLUTION (temporal tracking)
-- =============================================================================

CREATE TABLE escalation_history (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  from_severity       severity_level,
  to_severity         severity_level NOT NULL,
  from_escalation     escalation_level,
  to_escalation       escalation_level NOT NULL,
  reason              TEXT NOT NULL,
  triggered_by        VARCHAR(64) NOT NULL DEFAULT 'severity_reasoning_agent',
  confidence          REAL,
  factors             JSONB NOT NULL DEFAULT '[]',
  domain_event_id     UUID REFERENCES domain_events(id) ON DELETE SET NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE escalation_history IS 'Immutable audit of severity and escalation ladder changes over time.';

-- =============================================================================
-- CITIZEN REPORTS (ingestion / signals)
-- =============================================================================

CREATE TABLE citizen_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID REFERENCES crisis_events(id) ON DELETE SET NULL,
  source              report_source NOT NULL,
  raw_text            TEXT NOT NULL,
  normalized_text     TEXT,
  language            report_language NOT NULL DEFAULT 'en',
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  area_label          VARCHAR(128),
  entities            JSONB NOT NULL DEFAULT '[]',
  sentiment           REAL,
  confidence          REAL NOT NULL DEFAULT 0.7,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_at           TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT chk_citizen_reports_confidence
    CHECK (confidence >= 0 AND confidence <= 1)
);

-- =============================================================================
-- PIPELINE RUNS (orchestration sessions)
-- =============================================================================

CREATE TABLE pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  plan_version        INTEGER NOT NULL DEFAULT 1,
  status              VARCHAR(32) NOT NULL DEFAULT 'running',
  correlation_id      UUID,
  model               VARCHAR(64),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT
);

-- =============================================================================
-- REASONING LOGS (agent decisions — replaces agent_runs + reasoning_traces)
-- =============================================================================

CREATE TABLE reasoning_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  pipeline_run_id     UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  agent_name          VARCHAR(64) NOT NULL,
  step_index          INTEGER NOT NULL DEFAULT 0,
  status              VARCHAR(16) NOT NULL DEFAULT 'completed',
  thought             TEXT NOT NULL,
  evidence_refs       JSONB NOT NULL DEFAULT '[]',
  input_json          JSONB,
  output_json         JSONB,
  model               VARCHAR(64),
  latency_ms          INTEGER,
  domain_event_id     UUID REFERENCES domain_events(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EMERGENCY ACTIONS (planned + executed)
-- =============================================================================

CREATE TABLE emergency_actions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  pipeline_run_id     UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  plan_version        INTEGER NOT NULL DEFAULT 1,
  action_type         VARCHAR(48) NOT NULL,
  title               VARCHAR(256) NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  priority            SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status              action_status NOT NULL DEFAULT 'draft',
  idempotency_key     VARCHAR(128),
  scheduled_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_emergency_actions_idempotency
    UNIQUE NULLS NOT DISTINCT (crisis_id, idempotency_key)
);

-- =============================================================================
-- EXECUTION LOGS (tool / simulation audit)
-- =============================================================================

CREATE TABLE execution_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  action_id           UUID REFERENCES emergency_actions(id) ON DELETE SET NULL,
  tool_name           VARCHAR(64) NOT NULL,
  request_json        JSONB,
  response_json       JSONB,
  state_delta         JSONB NOT NULL DEFAULT '{}',
  status              VARCHAR(16) NOT NULL DEFAULT 'success',
  duration_ms         INTEGER,
  correlation_id      UUID,
  executed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TRAFFIC UPDATES (rerouting simulation)
-- =============================================================================

CREATE TABLE traffic_updates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  action_id           UUID REFERENCES emergency_actions(id) ON DELETE SET NULL,
  segment_label       VARCHAR(128),
  from_lat            DOUBLE PRECISION NOT NULL,
  from_lng            DOUBLE PRECISION NOT NULL,
  to_lat              DOUBLE PRECISION NOT NULL,
  to_lng              DOUBLE PRECISION NOT NULL,
  polyline_json       JSONB NOT NULL DEFAULT '[]',
  reason              TEXT,
  congestion_before   REAL,
  congestion_after    REAL,
  congestion_delta    REAL,
  effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ALERTS (citizen notification)
-- =============================================================================

CREATE TABLE alerts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  action_id           UUID REFERENCES emergency_actions(id) ON DELETE SET NULL,
  zone_label          VARCHAR(128) NOT NULL,
  message_en          TEXT NOT NULL,
  message_ur          TEXT,
  message_roman_ur    TEXT,
  reach_estimate      INTEGER NOT NULL DEFAULT 0,
  delivery_status     alert_delivery_status NOT NULL DEFAULT 'draft',
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- HOSPITALS (reference + capacity during crisis)
-- =============================================================================

CREATE TABLE hospitals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(256) NOT NULL,
  code                VARCHAR(32) UNIQUE,
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  beds_total          INTEGER NOT NULL DEFAULT 0,
  beds_available      INTEGER NOT NULL DEFAULT 0,
  ed_wait_minutes     INTEGER,
  heat_stress_load    REAL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RESCUE TEAMS (deployable units)
-- =============================================================================

CREATE TABLE rescue_teams (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_code           VARCHAR(32) NOT NULL UNIQUE,
  team_type           VARCHAR(48) NOT NULL,
  name                VARCHAR(128) NOT NULL,
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  status              team_status NOT NULL DEFAULT 'available',
  capacity            INTEGER NOT NULL DEFAULT 1,
  crisis_id           UUID REFERENCES crisis_events(id) ON DELETE SET NULL,
  assigned_task       TEXT,
  eta_minutes         INTEGER,
  hospital_id         UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CRISIS MEMORY (vector + lessons)
-- =============================================================================

CREATE TABLE crisis_memory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID REFERENCES crisis_events(id) ON DELETE SET NULL,
  crisis_type         crisis_type,
  area_label          VARCHAR(128),
  summary             TEXT NOT NULL,
  lessons             JSONB NOT NULL DEFAULT '[]',
  outcome_score       REAL CHECK (outcome_score >= 0 AND outcome_score <= 1),
  embedding           vector(384),
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CITY STATE SNAPSHOTS (before/after — dashboard)
-- =============================================================================

CREATE TABLE city_state_snapshots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id           UUID NOT NULL REFERENCES crisis_events(id) ON DELETE CASCADE,
  pipeline_run_id     UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  phase               VARCHAR(16) NOT NULL CHECK (phase IN ('before', 'after', 'checkpoint')),
  metrics_json        JSONB NOT NULL,
  map_state_json      JSONB NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES — optimized for ops queries
-- =============================================================================

-- Event store: replay + stream by aggregate
CREATE INDEX idx_domain_events_aggregate
  ON domain_events (aggregate_type, aggregate_id, event_version DESC);

CREATE INDEX idx_domain_events_occurred
  ON domain_events (occurred_at DESC);

CREATE INDEX idx_domain_events_correlation
  ON domain_events (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX idx_domain_events_type
  ON domain_events (event_type, occurred_at DESC);

-- Crisis events: live board + type/area filters
CREATE INDEX idx_crisis_events_status_opened
  ON crisis_events (status, opened_at DESC)
  WHERE status NOT IN ('resolved', 'archived', 'failed');

CREATE INDEX idx_crisis_events_type_area
  ON crisis_events (crisis_type, area_label);

CREATE INDEX idx_crisis_events_escalation
  ON crisis_events (escalation, opened_at DESC);

CREATE INDEX idx_crisis_events_centroid
  ON crisis_events (centroid_lat, centroid_lng)
  WHERE centroid_lat IS NOT NULL;

-- Temporal: current crises in valid window
CREATE INDEX idx_crisis_events_valid
  ON crisis_events (valid_from, valid_to)
  WHERE valid_to IS NULL;

-- Escalation history: timeline per crisis
CREATE INDEX idx_escalation_history_crisis_time
  ON escalation_history (crisis_id, recorded_at DESC);

CREATE INDEX idx_escalation_history_to_severity
  ON escalation_history (to_severity, recorded_at DESC);

-- Citizen reports: ingest feed + linkage
CREATE INDEX idx_citizen_reports_ingested
  ON citizen_reports (ingested_at DESC);

CREATE INDEX idx_citizen_reports_crisis
  ON citizen_reports (crisis_id, ingested_at DESC)
  WHERE crisis_id IS NOT NULL;

CREATE INDEX idx_citizen_reports_source
  ON citizen_reports (source, ingested_at DESC);

CREATE INDEX idx_citizen_reports_geo
  ON citizen_reports (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Pipeline + reasoning
CREATE INDEX idx_pipeline_runs_crisis
  ON pipeline_runs (crisis_id, started_at DESC);

CREATE INDEX idx_reasoning_logs_crisis_agent
  ON reasoning_logs (crisis_id, agent_name, created_at);

CREATE INDEX idx_reasoning_logs_pipeline
  ON reasoning_logs (pipeline_run_id, step_index);

-- Actions + execution
CREATE INDEX idx_emergency_actions_crisis_status
  ON emergency_actions (crisis_id, status, priority);

CREATE INDEX idx_emergency_actions_type
  ON emergency_actions (action_type, created_at DESC);

CREATE INDEX idx_execution_logs_crisis_time
  ON execution_logs (crisis_id, executed_at DESC);

CREATE INDEX idx_execution_logs_action
  ON execution_logs (action_id)
  WHERE action_id IS NOT NULL;

-- Traffic + alerts
CREATE INDEX idx_traffic_updates_crisis
  ON traffic_updates (crisis_id, effective_from DESC);

CREATE INDEX idx_alerts_crisis
  ON alerts (crisis_id, created_at DESC);

CREATE INDEX idx_alerts_delivery
  ON alerts (delivery_status, created_at DESC);

-- Resources
CREATE INDEX idx_hospitals_geo
  ON hospitals (lat, lng);

CREATE INDEX idx_rescue_teams_status
  ON rescue_teams (status, team_type);

CREATE INDEX idx_rescue_teams_crisis
  ON rescue_teams (crisis_id)
  WHERE crisis_id IS NOT NULL;

-- Memory: type filter + vector (create after data seed)
CREATE INDEX idx_crisis_memory_type_area
  ON crisis_memory (crisis_type, area_label);

CREATE INDEX idx_crisis_memory_valid
  ON crisis_memory (valid_from, valid_to)
  WHERE valid_to IS NULL;

-- Optional: run after ~1000 rows for vector search
-- CREATE INDEX idx_crisis_memory_embedding ON crisis_memory
--   USING hnsw (embedding vector_cosine_ops);

-- Snapshots
CREATE INDEX idx_city_state_snapshots_crisis
  ON city_state_snapshots (crisis_id, phase, recorded_at DESC);

-- =============================================================================
-- TRIGGERS — auto-update timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crisis_events_updated
  BEFORE UPDATE ON crisis_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_hospitals_updated
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rescue_teams_updated
  BEFORE UPDATE ON rescue_teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- HELPER: append domain event + bump aggregate version
-- =============================================================================

CREATE OR REPLACE FUNCTION append_domain_event(
  p_aggregate_type VARCHAR,
  p_aggregate_id UUID,
  p_event_type VARCHAR,
  p_payload JSONB,
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL,
  p_actor VARCHAR DEFAULT 'system'
)
RETURNS domain_events AS $$
DECLARE
  v_next_version INTEGER;
  v_row domain_events;
BEGIN
  SELECT COALESCE(MAX(event_version), 0) + 1 INTO v_next_version
  FROM domain_events
  WHERE aggregate_type = p_aggregate_type AND aggregate_id = p_aggregate_id;

  INSERT INTO domain_events (
    aggregate_type, aggregate_id, event_type, event_version,
    payload, correlation_id, causation_id, actor
  ) VALUES (
    p_aggregate_type, p_aggregate_id, p_event_type, v_next_version,
    p_payload, p_correlation_id, p_causation_id, p_actor
  )
  RETURNING * INTO v_row;

  UPDATE crisis_events
  SET aggregate_version = v_next_version, updated_at = NOW()
  WHERE id = p_aggregate_id;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql;
