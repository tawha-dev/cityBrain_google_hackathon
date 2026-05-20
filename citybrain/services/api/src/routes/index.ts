import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type { Signal } from '@citybrain/shared';
import { runPipelineInBackground } from '../orchestrator/pipeline-runner.js';
import { broadcast } from '../ws/hub.js';
import {
  citizenRouter,
  getCrisisDossier,
  getNearbyResourcesHandler,
  dispatchCrisisHandler,
  rerouteCrisisHandler,
} from './citizen.routes.js';
import * as repo from '../db/repository.js';
import { SCENARIOS } from '../seed/scenarios.js';
import { llmStatus } from '../llm/config.js';
import { probeLlm } from '../llm/health-probe.js';
import { fetchLiveWeather } from '../integrations/openweather.js';
import { fetchLiveNews } from '../integrations/newsapi.js';
import { enrichDispatchLegPolylines } from '../features/dispatch-tracking/route-polyline.js';

export const router = Router();

router.use('/citizen', citizenRouter);

router.get('/crises/:id/dossier', async (req, res, next) => {
  try {
    const dossier = await getCrisisDossier(req.params.id);
    if (!dossier) return res.status(404).json({ error: 'Crisis not found' });
    res.json(dossier);
  } catch (err) {
    next(err);
  }
});

router.get('/crises/:id/nearby-resources', getNearbyResourcesHandler);
router.post('/crises/:id/dispatch', dispatchCrisisHandler);
router.post('/crises/:id/reroute', rerouteCrisisHandler);

router.post('/crises/:id/dispatch/check-traffic', async (req, res, next) => {
  try {
    const { runDispatchTrafficMonitorTick } = await import(
      '../features/dispatch-traffic/monitor.js'
    );
    await runDispatchTrafficMonitorTick();
    res.json({ status: 'ok', message: 'Traffic monitor tick completed' });
  } catch (err) {
    next(err);
  }
});

/** Accepts a signal array, `{ signals: [...] }`, or a single signal object from mobile/web clients. */
function parseIngestSignals(body: unknown): Signal[] {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body)) return body as Signal[];
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.signals)) return obj.signals as Signal[];
  if (typeof obj.rawText === 'string' && obj.rawText.trim()) {
    return [obj as Signal];
  }
  return [];
}

router.get('/health', (_req, res) => {
  const integrations = llmStatus();
  res.json({
    status: 'ok',
    service: 'citybrain-api',
    timestamp: new Date().toISOString(),
    integrations: {
      ...integrations,
      googleMaps: integrations.googleMaps,
      socialVerify: integrations.socialVerify,
    },
  });
});

router.get('/live/status', (_req, res) => {
  res.json(llmStatus());
});

router.get('/health/llm', async (_req, res) => {
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

router.get('/live/weather', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat ?? 24.8607);
    const lon = Number(req.query.lon ?? 67.0011);
    const areaLabel = req.query.area as string | undefined;
    const weather = await fetchLiveWeather(lat, lon, areaLabel);
    if (!weather) {
      return res.status(503).json({ error: 'OpenWeather unavailable — set OPENWEATHER_API_KEY' });
    }
    res.json({ weather });
  } catch (err) {
    next(err);
  }
});

router.get('/live/news', async (req, res, next) => {
  try {
    const query = (req.query.q as string) ?? 'Karachi Pakistan flood emergency';
    const feed = await fetchLiveNews(query, Number(req.query.limit ?? 8));
    if (!feed) {
      return res.status(503).json({ error: 'News API unavailable — set NEWS_API_KEY' });
    }
    res.json(feed);
  } catch (err) {
    next(err);
  }
});

router.post('/live/sync', async (req, res, next) => {
  try {
    const lat = Number(req.body?.lat ?? 24.8607);
    const lon = Number(req.body?.lon ?? 67.0011);
    const query = String(req.body?.query ?? 'Karachi Pakistan crisis');
    const ids: string[] = [];

    const weather = await fetchLiveWeather(lat, lon, req.body?.areaLabel);
    if (weather) {
      const id = await repo.createSignal({
        source: 'weather',
        rawText: `LIVE WEATHER: ${weather.description} — ${weather.temperatureC}°C, rain ${weather.rainfallMm}mm/h, wind ${weather.windSpeedMs}m/s (${weather.areaLabel ?? 'zone'})`,
        language: 'en',
        lat: weather.lat,
        lng: weather.lon,
        areaLabel: weather.areaLabel,
        confidence: 0.92,
      });
      ids.push(id);
      broadcast({
        type: 'signal.new',
        timestamp: new Date().toISOString(),
        payload: { id, source: 'weather', rawText: weather.description, areaLabel: weather.areaLabel },
      });
    }

    const news = await fetchLiveNews(query, 5);
    if (news) {
      for (const article of news.articles.slice(0, 5)) {
        const id = await repo.createSignal({
          source: 'social',
          rawText: `[NEWS] ${article.title}${article.description ? ` — ${article.description}` : ''}`,
          language: 'en',
          lat,
          lng: lon,
          areaLabel: query.split(' ')[0],
          confidence: 0.75,
        });
        ids.push(id);
        broadcast({
          type: 'signal.new',
          timestamp: new Date().toISOString(),
          payload: { id, source: 'social', rawText: article.title, areaLabel: query },
        });
      }
    }

    res.json({
      ingested: ids.length,
      ids,
      weather: weather ?? null,
      newsCount: news?.articles.length ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/crises', async (_req, res) => {
  const crises = await repo.listCrises();
  const enriched = await Promise.all(
    crises.map(async (c: Record<string, unknown>) => {
      const report = await repo.getCitizenReportForCrisis(String(c.id));
      if (!report) return c;
      const meta =
        report.metadata && typeof report.metadata === 'object'
          ? (report.metadata as Record<string, unknown>)
          : typeof report.metadata === 'string'
            ? JSON.parse(report.metadata)
            : {};
      const validation = meta.validation as { total?: number } | undefined;
      return {
        ...c,
        citizen_origin: true,
        validation_score: validation?.total ?? (report.confidence != null ? Math.round(Number(report.confidence) * 100) : null),
      };
    })
  );
  res.json({ crises: enriched });
});

router.get('/crises/:id', async (req, res) => {
  const crisis = await repo.getCrisis(req.params.id);
  if (!crisis) return res.status(404).json({ error: 'Crisis not found' });
  const signals = await repo.getSignalsForCrisis(req.params.id);
  res.json({ crisis, signals });
});

router.get('/crises/:id/traces', async (req, res) => {
  const traces = await repo.getAgentRuns(req.params.id);
  res.json({ traces });
});

router.get('/crises/:id/executions', async (req, res) => {
  const logs = await repo.getExecutionLogs(req.params.id);
  res.json({ executions: logs });
});

router.get('/crises/:id/tracking', async (req, res, next) => {
  try {
    const report = await repo.getCitizenReportForCrisis(req.params.id);
    if (!report) {
      return res.json({ crisisId: req.params.id, incident: null, units: [], trackingActive: false });
    }
    const meta =
      report.metadata && typeof report.metadata === 'object'
        ? (report.metadata as Record<string, unknown>)
        : typeof report.metadata === 'string'
          ? JSON.parse(report.metadata)
          : {};
    const incident =
      report.lat != null && report.lng != null
        ? { lat: Number(report.lat), lng: Number(report.lng) }
        : null;
    const rawUnits = (meta.activeDispatches as Array<Record<string, unknown>> | undefined) ?? [];
    const enriched = await enrichDispatchLegPolylines(rawUnits, incident);
    res.json({
      crisisId: req.params.id,
      reportId: String(report.id),
      incident,
      units: enriched.map((u) => ({
        actionId: u.actionId,
        unit: u.unit,
        facility: u.facility,
        etaMinutes: u.lastEtaMinutes,
        lat: u.currentLat ?? u.facilityLat,
        lng: u.currentLng ?? u.facilityLng,
        facilityLat: u.facilityLat,
        facilityLng: u.facilityLng,
        progress: u.progress ?? 0,
        distanceRemainingMeters: u.distanceRemainingMeters,
        arrived: u.arrived ?? false,
        routePolyline: u.routePolyline ?? [],
        rerouteCount: u.rerouteCount ?? 0,
      })),
      trackingActive: enriched.length > 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/crises/:id/dispatches', async (req, res, next) => {
  try {
    const rows = await repo.getDispatchActionsForCrisis(req.params.id);
    const dispatches = rows.map((row: Record<string, unknown>) => {
      const payload =
        row.payload && typeof row.payload === 'object'
          ? (row.payload as Record<string, unknown>)
          : typeof row.payload === 'string'
            ? JSON.parse(row.payload)
            : {};
      return {
        id: row.id,
        type: row.action_type,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        unit: payload.unit,
        facility: payload.facility,
        etaMinutes: payload.etaMinutes,
        note: payload.note,
      };
    });
    res.json({ dispatches });
  } catch (err) {
    next(err);
  }
});

router.get('/crises/:id/state', async (req, res) => {
  const snapshots = await repo.getSnapshots(req.params.id);
  const before = snapshots.find((s) => String(s.phase) === 'before');
  const after = snapshots.find((s) => String(s.phase) === 'after');
  res.json({ before, after });
});

router.get('/crises/:id/simulation', async (req, res) => {
  const { getSimulationRun, compareBeforeAfter } = await import('../simulator/index.js');
  const run = getSimulationRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'No simulation run for this crisis' });
  const comparison = compareBeforeAfter(req.params.id);
  res.json({ run, comparison });
});

router.get('/crises/:id/simulation/replay', async (req, res) => {
  const { getReplayFrames, getTimelineReplay } = await import('../simulator/index.js');
  const fromTick = Number(req.query.fromTick ?? 0);
  const toTick = req.query.toTick != null ? Number(req.query.toTick) : undefined;
  const interpolate = Number(req.query.interpolate ?? 0);
  const frames = getReplayFrames(req.params.id, fromTick, toTick, interpolate);
  const timeline = getTimelineReplay(
    req.params.id,
    Number(req.query.fromSimTimeMs ?? 0)
  );
  res.json({ frames, timeline, count: frames.length });
});

router.post('/crises/:id/simulation/run', async (req, res) => {
  const crisis = await repo.getCrisis(req.params.id);
  if (!crisis) return res.status(404).json({ error: 'Crisis not found' });

  const { runPhysicsSimulation } = await import('../simulator/index.js');
  const state = (req.body?.state ?? crisis.dossier_json ?? {}) as import('@citybrain/shared').CrisisRunState;
  const tickDelayMs = Number(req.body?.tickDelayMs ?? 80);
  const skipExecution = Boolean(req.body?.skipExecution ?? true);

  if (!skipExecution) {
    return res.status(400).json({
      error: 'Use demo scenario run for full execution+simulation pipeline',
    });
  }

  const run = await runPhysicsSimulation(
    {
      ...state,
      crisisId: req.params.id,
      runId: state.runId ?? req.params.id,
      rawSignals: state.rawSignals ?? [],
      normalizedSignals: state.normalizedSignals ?? [],
      candidate: state.candidate ?? {
        type: 'flood',
        title: crisis.title,
        areaLabel: crisis.area_label,
        centroid: { lat: Number(crisis.centroid_lat ?? 33.68), lng: Number(crisis.centroid_lng ?? 73.04) },
        signalIds: [],
        confidence: 0.8,
        summary: crisis.summary ?? '',
      },
    },
    req.params.id,
    [],
    { tickDelayMs, stream: true }
  );

  res.json({ status: 'completed', simulation: run });
});

router.get('/memory', async (req, res) => {
  const type = req.query.type as string | undefined;
  const memory = await repo.getMemory(type);
  res.json({ memory });
});

router.get('/resources', async (_req, res, next) => {
  try {
    const resources = await repo.listAvailableResources();
    res.json({ resources });
  } catch (err) {
    next(err);
  }
});

router.post('/signals/ingest', async (req, res) => {
  const signals = parseIngestSignals(req.body);
  if (signals.length === 0) {
    return res.status(400).json({
      error: 'No signals to ingest',
      hint: 'Send a signal object with rawText, or { signals: [...] }',
    });
  }
  const ids: string[] = [];

  for (const sig of signals) {
    const id = await repo.createSignal({
      source: sig.source,
      rawText: sig.rawText,
      language: sig.language,
      lat: sig.location?.lat,
      lng: sig.location?.lng,
      areaLabel: sig.areaLabel,
      confidence: sig.confidence,
    });
    ids.push(id);
    broadcast({
      type: 'signal.new',
      timestamp: new Date().toISOString(),
      payload: { id, ...sig },
    });
  }

  res.json({ ingested: ids.length, ids });
});

router.post('/crises/:id/analyze', async (req, res) => {
  const crisisId = req.params.id;
  const crisis = await repo.getCrisis(crisisId);
  if (!crisis) return res.status(404).json({ error: 'Crisis not found' });

  const signalRows = await repo.getSignalsForCrisis(crisisId);
  const rawSignals: Signal[] = signalRows.map((s: Record<string, unknown>) => ({
    id: String(s.id),
    source: s.source as Signal['source'],
    rawText: String(s.raw_text),
    language: (s.language as Signal['language']) ?? 'en',
    entities: [],
    location:
      s.lat != null ? { lat: Number(s.lat), lng: Number(s.lng) } : undefined,
    areaLabel: s.area_label ? String(s.area_label) : undefined,
    confidence: Number(s.confidence),
  }));

  res.json({ status: 'pipeline_started', crisisId });

  runPipelineInBackground(crisisId, rawSignals, crisis.scenario_key).catch(console.error);
});

router.post('/demo/scenarios/:key/run', async (req, res) => {
  const key = req.params.key;
  const scenario = SCENARIOS[key];
  if (!scenario) {
    return res.status(404).json({ error: 'Unknown scenario', available: Object.keys(SCENARIOS) });
  }

  const crisisId = await repo.createCrisis({
    scenarioKey: key,
    type: scenario.crisisType,
    title: scenario.title,
    areaLabel: scenario.areaLabel,
    status: 'detecting',
  });

  const signalIds: string[] = [];
  for (const sig of scenario.signals) {
    const id = await repo.createSignal({
      source: sig.source,
      rawText: sig.rawText,
      language: sig.language,
      lat: sig.location?.lat,
      lng: sig.location?.lng,
      areaLabel: sig.areaLabel,
      confidence: sig.confidence,
    });
    await repo.linkSignalToCrisis(crisisId, id);
    signalIds.push(id);

    broadcast({
      type: 'signal.new',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: { id, ...sig },
    });

    await delay(400);
  }

  broadcast({
    type: 'crisis.updated',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { crisisId, status: 'detecting', title: scenario.title },
  });

  res.json({ crisisId, scenario: key, status: 'started', signalCount: signalIds.length });

  const rawSignals: Signal[] = scenario.signals.map((s, i) => ({
    ...s,
    entities: s.entities ?? [],
    id: signalIds[i],
    ingestedAt: new Date().toISOString(),
  }));

  runPipelineInBackground(crisisId, rawSignals, key).catch(console.error);
});

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
