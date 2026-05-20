import http from 'http';
import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';
import { createWsServer } from './ws/hub.js';
import { seedResources } from './db/repository.js';
import { query } from './db/pool.js';
import { registerLiveTools } from './tools/live-registry.js';
import { startDispatchTrafficMonitor } from './features/dispatch-traffic/monitor.js';
import { startDispatchPositionTracker } from './features/dispatch-tracking/position.js';
import { setupSwagger } from './swagger/setup.js';
import { llmStatus } from './llm/config.js';
import { probeLlm } from './llm/health-probe.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
  })
);
app.use(express.json());

setupSwagger(app);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'citybrain-api' });
});

app.get('/health/llm', async (_req, res) => {
  try {
    const result = await probeLlm();
    res.status(result.ok ? 200 : 503).json({
      status: result.ok ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      ok: false,
      error: err instanceof Error ? err.message : 'LLM probe failed',
      config: llmStatus(),
    });
  }
});

app.use('/api/v1', router);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

const server = http.createServer(app);
createWsServer(server);

async function ensureCitizenReportsTable() {
  await query(`
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
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_citizen_reports_device ON citizen_reports (device_id, ingested_at DESC)`
  ).catch(() => {});
}

async function assertV1Schema() {
  const check = await query<{ crises: string | null; crisis_events: string | null }>(
    `SELECT to_regclass('public.crises') AS crises, to_regclass('public.crisis_events') AS crisis_events`
  );
  const { crises, crisis_events } = check.rows[0] ?? {};
  if (!crises && crisis_events) {
    throw new Error(
      'Database has v2 schema only (crisis_events) but API requires v1 (crises). ' +
        'Run: docker compose down -v && docker compose up --build -d'
    );
  }
  if (!crises && !crisis_events) {
    throw new Error('Database schema not initialized. Wait for Postgres migrations or reset the volume.');
  }
}

async function start() {
  try {
    await assertV1Schema();
    await ensureCitizenReportsTable();
    registerLiveTools();
    startDispatchTrafficMonitor();
    startDispatchPositionTracker();
    await seedResources();
    const status = llmStatus();
    console.log(
      '[integrations]',
      `gemini=${status.gemini} (${status.geminiModel})`,
      `openrouter=${status.openrouter} (${status.openRouterModel})`,
      `weather=${status.openweather}`,
      `news=${status.news}`,
      `provider=${status.provider}`,
      status.openrouter ? `or-key=…${process.env.OPENROUTER_API_KEY?.slice(-6) ?? '?'}` : ''
    );
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`CityBrain API running on http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (API kept alive):', reason);
});

start();
