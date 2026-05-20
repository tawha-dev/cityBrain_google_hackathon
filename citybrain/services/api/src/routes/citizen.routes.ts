import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import * as repo from '../db/repository.js';
import { broadcast } from '../ws/hub.js';
import { processCitizenChat } from '../features/citizen-chat/service.js';
import { processSafetyChat, streamSafetyChat } from '../features/citizen-safety-chat/service.js';
import { processCitizenReport } from '../features/citizen-ingest/service.js';
import {
  getCitizenDemoScenario,
  listCitizenDemoScenarios,
  mapScenarioToCitizenCategory,
  pickPrimaryCitizenSignal,
} from '../features/citizen-demo/scenarios.js';
import { hasOpenRouter } from '../llm/openrouter.js';
import { computeRouteWithFallback, computeBestRoute, hasGoogleMapsKey } from '../integrations/google-maps.js';
import { registerActiveDispatches } from '../features/dispatch-traffic/monitor.js';
import {
  ensureDispatchRoutePolyline,
  enrichDispatchLegPolylines,
  needsRoadPolyline,
} from '../features/dispatch-tracking/route-polyline.js';
import {
  findNearbyEmergencyResources,
  pickResourcesForUnits,
  pickSafeEvacuationDestination,
  resolveCrisisCoordinates,
  normalizeIncidentKind,
  getIncidentLabel,
  type EmergencyResource,
} from '../features/nearby-resources/service.js';

export const citizenRouter = Router();

citizenRouter.get('/demo/scenarios', (_req, res) => {
  res.json({ scenarios: listCitizenDemoScenarios() });
});

citizenRouter.post('/demo/scenarios/:key/run', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.body?.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header or deviceId required' });
    }

    const key = String(req.params.key ?? '').trim();
    const scenario = getCitizenDemoScenario(key);
    if (!scenario) {
      return res.status(404).json({
        error: 'Unknown demo scenario',
        available: listCitizenDemoScenarios().map((s) => s.key),
      });
    }

    const primary = pickPrimaryCitizenSignal(scenario);
    const result = await processCitizenReport(
      {
        deviceId,
        rawText: primary.rawText,
        category: mapScenarioToCitizenCategory(scenario.crisisType),
        language: primary.language,
        location: primary.location
          ? { lat: primary.location.lat, lng: primary.location.lng }
          : undefined,
      },
      { demoScenarioKey: key }
    );

    res.status(202).json({
      reportId: result.reportId,
      crisisId: result.crisisId,
      status: 'validating',
      correlationId: result.correlationId,
      scenario: key,
      expectedConfidence: result.expectedConfidence,
    });
  } catch (err) {
    next(err);
  }
});

citizenRouter.post('/reports', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.body?.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header or deviceId required' });
    }
    const rawText = String(req.body?.rawText ?? '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const result = await processCitizenReport({
      deviceId,
      rawText,
      category: String(req.body?.category ?? 'other'),
      language: req.body?.language,
      location: req.body?.location,
      mediaUrls: req.body?.mediaUrls,
    });

    res.status(202).json({
      reportId: result.reportId,
      crisisId: result.crisisId,
      status: 'validating',
      correlationId: result.correlationId,
    });
  } catch (err) {
    next(err);
  }
});

citizenRouter.get('/reports', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.query.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id required' });
    }
    const reports = await repo.getCitizenReportsByDevice(deviceId);
    res.json({
      reports: reports.map(formatReportRow),
    });
  } catch (err) {
    next(err);
  }
});

citizenRouter.get('/reports/:id', async (req, res, next) => {
  try {
    const row = await repo.getCitizenReport(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });
    res.json({ report: formatReportRow(row) });
  } catch (err) {
    next(err);
  }
});

citizenRouter.post('/chat', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.body?.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header or deviceId required' });
    }

    if (!hasOpenRouter()) {
      return res.status(503).json({
        error: 'AI assistant unavailable — OPENROUTER_API_KEY not configured',
      });
    }

    const rawMessages = req.body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (rawMessages.length > 20) {
      return res.status(400).json({ error: 'Too many messages (max 20)' });
    }

    const messages = rawMessages.map((m: { role?: string; content?: string }) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content ?? '').trim(),
    }));

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 4000) {
      return res.status(400).json({ error: 'Conversation too long (max 4000 characters)' });
    }

    if (messages.some((m) => !m.content)) {
      return res.status(400).json({ error: 'Each message must have non-empty content' });
    }

    const last = messages[messages.length - 1];
    if (last.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    const result = await processCitizenChat({ messages });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

citizenRouter.post('/chat/safety', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.body?.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header or deviceId required' });
    }

    if (!hasOpenRouter()) {
      return res.status(503).json({
        error: 'AI assistant unavailable — OPENROUTER_API_KEY not configured',
      });
    }

    const rawMessages = req.body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (rawMessages.length > 20) {
      return res.status(400).json({ error: 'Too many messages (max 20)' });
    }

    const messages = rawMessages.map((m: { role?: string; content?: string }) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content ?? '').trim(),
    }));

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 4000) {
      return res.status(400).json({ error: 'Conversation too long (max 4000 characters)' });
    }

    if (messages.some((m) => !m.content)) {
      return res.status(400).json({ error: 'Each message must have non-empty content' });
    }

    const last = messages[messages.length - 1];
    if (last.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    const result = await processSafetyChat({ messages });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

citizenRouter.post('/chat/safety/stream', async (req, res, next) => {
  try {
    const deviceId = String(req.headers['x-device-id'] ?? req.body?.deviceId ?? '');
    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header or deviceId required' });
    }

    const rawMessages = req.body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (rawMessages.length > 20) {
      return res.status(400).json({ error: 'Too many messages (max 20)' });
    }

    const messages = rawMessages.map((m: { role?: string; content?: string }) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content ?? '').trim(),
    }));

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 4000) {
      return res.status(400).json({ error: 'Conversation too long (max 4000 characters)' });
    }

    if (messages.some((m) => !m.content)) {
      return res.status(400).json({ error: 'Each message must have non-empty content' });
    }

    const last = messages[messages.length - 1];
    if (last.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    for await (const event of streamSafetyChat({ messages })) {
      if (event.type === 'delta') {
        res.write(`event: delta\ndata: ${JSON.stringify({ reply: event.reply })}\n\n`);
      } else if (event.type === 'done') {
        res.write(`event: done\ndata: ${JSON.stringify(event.result)}\n\n`);
      } else if (event.type === 'error') {
        res.write(`event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`);
      }
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

citizenRouter.get('/reports/:id/route', async (req, res, next) => {
  try {
    const row = await repo.getCitizenReport(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });

    const incidentLat = Number(row.lat);
    const incidentLng = Number(row.lng);
    if (!Number.isFinite(incidentLat) || !Number.isFinite(incidentLng)) {
      return res.status(400).json({ error: 'Report has no valid incident location' });
    }

    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : {};

    const incidentKind = normalizeIncidentKind(
      String(row.category ?? ''),
      String(meta.incidentKind ?? '')
    );

    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const origin = {
      lat: Number.isFinite(originLat) ? originLat : incidentLat,
      lng: Number.isFinite(originLng) ? originLng : incidentLng,
    };

    let destination: ReturnType<typeof pickSafeEvacuationDestination>;

    const queryDestLat = Number(req.query.destLat);
    const queryDestLng = Number(req.query.destLng);
    if (Number.isFinite(queryDestLat) && Number.isFinite(queryDestLng)) {
      destination = {
        lat: queryDestLat,
        lng: queryDestLng,
        name: String(req.query.destName ?? 'Selected safe point'),
        source: 'query',
      };
    } else {
      let nearbyList = (meta.nearbyResources as EmergencyResource[] | undefined) ?? [];
      if (!nearbyList.length) {
        nearbyList = await findNearbyEmergencyResources(incidentLat, incidentLng, {
          withRoutes: false,
          incidentKind,
          category: String(row.category ?? ''),
        });
        await repo.updateCitizenReportMetadata(String(row.id), {
          nearbyResources: nearbyList,
          incidentKind,
        });
      }
      destination = pickSafeEvacuationDestination(origin, nearbyList, incidentKind);
    }

    const routeCore =
      (await computeRouteWithFallback(origin, { lat: destination.lat, lng: destination.lng })) ??
      ({
        alternateRoute: `Evacuate to ${destination.name}`,
        distanceMeters: Math.round(
          Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng) * 111_000
        ),
        durationSeconds: 600,
        polyline: [
          { lat: origin.lat, lng: origin.lng },
          {
            lat: (origin.lat + destination.lat) / 2,
            lng: (origin.lng + destination.lng) / 2,
          },
          { lat: destination.lat, lng: destination.lng },
        ],
        source: 'simulated' as const,
      });

    const route = {
      ...routeCore,
      alternateRoute: `Safe route → ${destination.name}`,
      origin: { lat: origin.lat, lng: origin.lng, label: 'Your position / incident' },
      destination: {
        lat: destination.lat,
        lng: destination.lng,
        name: destination.name,
        category: destination.category,
        placeId: destination.placeId,
      },
      incident: { lat: incidentLat, lng: incidentLng },
      incidentKind,
      destinationSource: destination.source,
    };

    if (row.crisis_id) {
      await repo.createRouteOverride(String(row.crisis_id), {
        from: origin,
        to: { lat: destination.lat, lng: destination.lng },
        alternatePolyline: route.polyline,
        reason: route.alternateRoute,
        congestionDelta: -0.25,
      });
    }

    broadcast({
      type: 'citizen.alert',
      reportId: req.params.id,
      crisisId: row.crisis_id ? String(row.crisis_id) : undefined,
      timestamp: new Date().toISOString(),
      payload: {
        reportId: req.params.id,
        message: `Safe evacuation route to ${destination.name}`,
        route,
      },
    });

    res.json({ route });
  } catch (err) {
    next(err);
  }
});

citizenRouter.get('/reports/:id/tracking', async (req, res, next) => {
  try {
    const row = await repo.getCitizenReport(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });

    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : {};

    const incident =
      row.lat != null && row.lng != null
        ? { lat: Number(row.lat), lng: Number(row.lng) }
        : null;

    const rawUnits = (meta.activeDispatches as Array<Record<string, unknown>> | undefined) ?? [];
    const enriched = await enrichDispatchLegPolylines(rawUnits, incident);

    if (incident && enriched.length > 0) {
      const shouldPersist = enriched.some((u, i) => {
        const before = rawUnits[i]?.routePolyline as
          | Array<{ lat: number; lng: number }>
          | undefined;
        const after = u.routePolyline as Array<{ lat: number; lng: number }> | undefined;
        return needsRoadPolyline(before) && !needsRoadPolyline(after);
      });
      if (shouldPersist) {
        await repo.updateCitizenReportMetadata(req.params.id, { activeDispatches: enriched });
      }
    }

    res.json({
      reportId: req.params.id,
      crisisId: row.crisis_id ? String(row.crisis_id) : null,
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

export async function getCrisisDossier(crisisId: string) {
  const crisis = await repo.getCrisis(crisisId);
  if (!crisis) return null;

  const report = await repo.getCitizenReportForCrisis(crisisId);
  const signals = await repo.getSignalsForCrisis(crisisId);
  const traces = await repo.getAgentRuns(crisisId);

  const meta =
    report?.metadata && typeof report.metadata === 'object'
      ? (report.metadata as Record<string, unknown>)
      : typeof report?.metadata === 'string'
        ? JSON.parse(report.metadata)
        : {};

  const nearbyResources = (meta.nearbyResources as EmergencyResource[] | undefined) ?? null;
  const incidentKind = normalizeIncidentKind(
    String(report?.category ?? ''),
    String(crisis.type ?? '')
  );

  return {
    crisis,
    citizenReport: report ? formatReportRow(report) : null,
    validation: meta.validation ?? null,
    social: meta.social ?? null,
    timeline: meta.timeline ?? [],
    nearbyResources,
    incidentKind,
    incidentLabel: getIncidentLabel(incidentKind),
    signalCount: signals.length,
    agentRunCount: traces.length,
    signals: signals.slice(0, 10),
  };
}

export async function getNearbyResourcesHandler(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  try {
    const crisisId = String(req.params.id);
    const crisis = await repo.getCrisis(crisisId);
    if (!crisis) return res.status(404).json({ error: 'Crisis not found' });

    const report = await repo.getCitizenReportForCrisis(crisisId);
    const coords = report?.lat != null
      ? { lat: Number(report.lat), lng: Number(report.lng) }
      : await resolveCrisisCoordinates(crisis);

    const refresh = req.query.refresh === 'true';
    const meta =
      report?.metadata && typeof report.metadata === 'object'
        ? (report.metadata as Record<string, unknown>)
        : {};

    const incidentKind = normalizeIncidentKind(
      String(report?.category ?? ''),
      String(crisis.type ?? '')
    );

    let resources = meta.nearbyResources as EmergencyResource[] | undefined;
    const storedKind = meta.incidentKind as string | undefined;
    const kindMismatch = storedKind && storedKind !== incidentKind;
    if (!resources?.length || refresh || kindMismatch) {
      resources = await findNearbyEmergencyResources(coords.lat, coords.lng, {
        withRoutes: true,
        incidentKind,
        category: String(report?.category ?? ''),
        crisisType: String(crisis.type ?? ''),
      });
      if (report) {
        await repo.updateCitizenReportMetadata(String(report.id), {
          nearbyResources: resources,
          incidentKind,
        });
      }
    }

    res.json({
      crisisId,
      incident: coords,
      incidentKind,
      incidentLabel: getIncidentLabel(incidentKind),
      resources,
      source: resources[0]?.source ?? 'google_places',
    });
  } catch (err) {
    next(err);
  }
}

export async function rerouteCrisisHandler(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  try {
    const crisisId = String(req.params.id);
    const crisis = await repo.getCrisis(crisisId);
    if (!crisis) return res.status(404).json({ error: 'Crisis not found' });

    const note = String(req.body?.note ?? 'Authority-approved traffic reroute');
    const lat = Number(crisis.centroid_lat ?? 24.8607);
    const lng = Number(crisis.centroid_lng ?? 67.0011);

    const actionId = await repo.createAction(crisisId, {
      id: uuid(),
      type: 'traffic_reroute',
      title: 'Authority traffic reroute',
      payload: { note, congestionDelta: -0.32 },
      priority: 1,
    });

    await repo.createRouteOverride(crisisId, {
      from: { lat, lng },
      to: { lat: lat + 0.015, lng: lng + 0.02 },
      alternatePolyline: [
        { lat, lng },
        { lat: lat + 0.008, lng: lng + 0.01 },
        { lat: lat + 0.015, lng: lng + 0.02 },
      ],
      reason: note,
      congestionDelta: -0.32,
    });

    const report = await repo.getCitizenReportForCrisis(crisisId);
    const reportId = report ? String(report.id) : undefined;

    broadcast({
      type: 'dispatch.updated',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: { crisisId, reportId, reroute: true, note, actionId },
    });

    if (reportId) {
      broadcast({
        type: 'citizen.alert',
        reportId,
        crisisId,
        timestamp: new Date().toISOString(),
        payload: {
          reportId,
          message: `Traffic rerouted: ${note}`,
          route: {
            alternateRoute: note,
            polyline: [
              { lat, lng },
              { lat: lat + 0.015, lng: lng + 0.02 },
            ],
          },
        },
      });
    }

    res.json({ status: 'rerouted', crisisId, actionId, note });
  } catch (err) {
    next(err);
  }
}

export async function dispatchCrisisHandler(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  try {
    const crisisId = String(req.params.id);
    const crisis = await repo.getCrisis(crisisId);
    if (!crisis) return res.status(404).json({ error: 'Crisis not found' });

    const units: string[] = Array.isArray(req.body?.units)
      ? req.body.units
      : ['ambulance'];
    const note = String(req.body?.note ?? 'Units dispatched per authority approval');
    const targets = Array.isArray(req.body?.targets)
      ? (req.body.targets as Array<{ placeId: string; name: string; lat: number; lng: number; category?: string }>)
      : undefined;

    const report = await repo.getCitizenReportForCrisis(crisisId);
    const reportId = report ? String(report.id) : undefined;

    const coords = report?.lat != null
      ? { lat: Number(report.lat), lng: Number(report.lng) }
      : await resolveCrisisCoordinates(crisis);

    const meta =
      report?.metadata && typeof report.metadata === 'object'
        ? (report.metadata as Record<string, unknown>)
        : {};

    const incidentKind = normalizeIncidentKind(
      String(report?.category ?? ''),
      String(crisis.type ?? '')
    );

    let nearbyList = (meta.nearbyResources as EmergencyResource[] | undefined) ?? [];
    if (!nearbyList.length) {
      nearbyList = await findNearbyEmergencyResources(coords.lat, coords.lng, {
        withRoutes: true,
        incidentKind,
        category: String(report?.category ?? ''),
        crisisType: String(crisis.type ?? ''),
      });
      if (report) {
        await repo.updateCitizenReportMetadata(String(report.id), {
          nearbyResources: nearbyList,
          incidentKind,
        });
      }
    }

    const assigned = pickResourcesForUnits(units, nearbyList, targets);

    const dispatched: Array<{
      unit: string;
      actionId: string;
      etaMinutes: number;
      facility?: string;
      placeId?: string;
      lat?: number;
      lng?: number;
      routeSource: 'google_routes' | 'estimated';
      facilitySource: 'google_places' | 'fallback' | 'manual_selection';
      routeDurationSeconds?: number;
      routePolyline?: Array<{ lat: number; lng: number }>;
    }> = [];

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      const resource = assigned[i] ?? assigned[0];
      const routeResult =
        resource && hasGoogleMapsKey()
          ? await computeBestRoute({ lat: resource.lat, lng: resource.lng }, coords)
          : null;
      const route = routeResult?.best ?? null;

      const etaMinutes =
        route != null
          ? Math.max(1, Math.ceil(route.durationSeconds / 60))
          : resource?.etaMinutes ?? 6 + i * 4;

      const routeSource = route?.source === 'google' ? 'google_routes' : 'estimated';
      const routeDurationSeconds = route?.durationSeconds;
      const facilitySource = targets?.length
        ? 'manual_selection'
        : resource?.source === 'fallback'
          ? 'fallback'
          : 'google_places';

      let routePolyline = route?.polyline;
      if (resource) {
        routePolyline = await ensureDispatchRoutePolyline(
          { lat: resource.lat, lng: resource.lng },
          coords,
          routePolyline
        );
      }

      const actionId = await repo.createAction(crisisId, {
        id: uuid(),
        type: 'dispatch_emergency',
        title: resource ? `Dispatch ${unit} → ${resource.name}` : `Dispatch ${unit}`,
        payload: {
          unit,
          note,
          facility: resource?.name,
          placeId: resource?.placeId,
          facilityLat: resource?.lat,
          facilityLng: resource?.lng,
          etaMinutes,
          routeSource,
          facilitySource,
          routePolyline: routePolyline,
          routeDurationSeconds,
          alternativeRoutes: routeResult?.alternatives?.length ?? 0,
          dispatchedAt: new Date().toISOString(),
        },
        priority: 1,
      });

      dispatched.push({
        unit,
        actionId,
        etaMinutes,
        facility: resource?.name,
        placeId: resource?.placeId,
        lat: resource?.lat,
        lng: resource?.lng,
        routeSource,
        facilitySource,
        routeDurationSeconds,
        routePolyline: routePolyline,
      });
    }

    broadcast({
      type: 'dispatch.updated',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: { crisisId, reportId, units: dispatched, note, incident: coords },
    });

    if (reportId) {
      const facilityNames = dispatched.map((d) => d.facility).filter(Boolean).join(', ');
      broadcast({
        type: 'citizen.progress',
        crisisId,
        reportId,
        timestamp: new Date().toISOString(),
        payload: {
          reportId,
          step: 'dispatched',
          label: facilityNames
            ? `${units.join(', ')} dispatched from ${facilityNames} — ETA ${dispatched[0]?.etaMinutes ?? '?'} min`
            : `${units.join(', ')} dispatched — ${note}`,
          units: dispatched,
        },
      });
    }

    await repo.updateCrisis(crisisId, { status: 'executing' });

    if (reportId) {
      await registerActiveDispatches(crisisId, reportId, coords, dispatched);
    }

    res.json({
      status: 'dispatched',
      crisisId,
      dispatchedAt: new Date().toISOString(),
      units: dispatched,
      assigned,
    });
  } catch (err) {
    next(err);
  }
}

function formatReportRow(row: Record<string, unknown>) {
  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : {};

  return {
    id: row.id,
    crisisId: row.crisis_id,
    deviceId: row.device_id,
    category: row.category,
    rawText: row.raw_text,
    language: row.language,
    lat: row.lat,
    lng: row.lng,
    areaLabel: row.area_label,
    status: row.status,
    verified: row.verified,
    confidence: row.confidence,
    validationScore: (meta.validation as { total?: number })?.total ?? null,
    validation: meta.validation ?? null,
    timeline: meta.timeline ?? [],
    escalation: meta.escalation ?? null,
    ingestedAt: row.ingested_at,
  };
}
