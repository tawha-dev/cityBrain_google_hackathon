-- Citizen reports (v1 schema — links to crises table)
CREATE TABLE IF NOT EXISTS citizen_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crisis_id UUID REFERENCES crises(id) ON DELETE SET NULL,
  device_id VARCHAR(64),
  source VARCHAR(32) NOT NULL DEFAULT 'citizen_app',
  category VARCHAR(32),
  raw_text TEXT NOT NULL,
  normalized_text TEXT,
  language VARCHAR(16) DEFAULT 'en',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  area_label VARCHAR(128),
  confidence REAL DEFAULT 0.7,
  verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(32) DEFAULT 'validating',
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  linked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_device ON citizen_reports (device_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_citizen_reports_crisis ON citizen_reports (crisis_id, ingested_at DESC);
