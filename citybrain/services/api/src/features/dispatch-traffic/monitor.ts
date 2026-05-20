import { v4 as uuid } from 'uuid';
import * as repo from '../../db/repository.js';
import { broadcast } from '../../ws/hub.js';
import { computeBestRoute, hasGoogleMapsKey } from '../../integrations/google-maps.js';
import { ensureDispatchRoutePolyline } from '../dispatch-tracking/route-polyline.js';

/** Active unit leg tracked for traffic re-routing and live position. */
export interface ActiveDispatchLeg {
  actionId: string;
  unit: string;
  facility?: string;
  facilityLat: number;
  facilityLng: number;
  incidentLat: number;
  incidentLng: number;
  baselineDurationSeconds: number;
  lastDurationSeconds: number;
  lastEtaMinutes: number;
  rerouteCount: number;
  lastCheckedAt?: string;
  dispatchedAt?: string;
  routePolyline?: Array<{ lat: number; lng: number }>;
  currentLat?: number;
  currentLng?: number;
  progress?: number;
  distanceRemainingMeters?: number;
  arrived?: boolean;
}

const TRAFFIC_SLOWDOWN_RATIO = Number(process.env.DISPATCH_TRAFFIC_SLOWDOWN_RATIO ?? 1.2);
const REROUTE_IMPROVEMENT_RATIO = Number(process.env.DISPATCH_REROUTE_IMPROVEMENT_RATIO ?? 0.12);
const MONITOR_INTERVAL_MS = Number(process.env.DISPATCH_TRAFFIC_MONITOR_MS ?? 45_000);

function parseMeta(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object') return metadata as Record<string, unknown>;
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export async function registerActiveDispatches(
  crisisId: string,
  reportId: string | undefined,
  incident: { lat: number; lng: number },
  units: Array<{
    unit: string;
    actionId: string;
    etaMinutes: number;
    facility?: string;
    lat?: number;
    lng?: number;
    routeDurationSeconds?: number;
    routePolyline?: Array<{ lat: number; lng: number }>;
  }>
) {
  if (!reportId) return;

  const legs: ActiveDispatchLeg[] = [];
  for (const u of units.filter((x) => x.lat != null && x.lng != null)) {
    const durationSec = u.routeDurationSeconds ?? Math.max(60, u.etaMinutes * 60);
    const from = { lat: u.lat!, lng: u.lng! };
    const polyline = await ensureDispatchRoutePolyline(from, incident, u.routePolyline);
    legs.push({
      actionId: u.actionId,
      unit: u.unit,
      facility: u.facility,
      facilityLat: u.lat!,
      facilityLng: u.lng!,
      incidentLat: incident.lat,
      incidentLng: incident.lng,
      baselineDurationSeconds: durationSec,
      lastDurationSeconds: durationSec,
      lastEtaMinutes: u.etaMinutes,
      rerouteCount: 0,
      lastCheckedAt: new Date().toISOString(),
      dispatchedAt: new Date().toISOString(),
      routePolyline: polyline,
      progress: 0,
      currentLat: u.lat,
      currentLng: u.lng,
      distanceRemainingMeters: undefined,
      arrived: false,
    });
  }

  if (legs.length === 0) return;

  await repo.updateCitizenReportMetadata(reportId, {
    activeDispatches: legs,
    dispatchTrafficMonitor: true,
  });

  console.log(`[dispatch-traffic] tracking ${legs.length} unit leg(s) for crisis ${crisisId}`);
}

async function applyTrafficReroute(
  crisisId: string,
  reportId: string | undefined,
  leg: ActiveDispatchLeg,
  newRoute: {
    alternateRoute: string;
    durationSeconds: number;
    polyline: Array<{ lat: number; lng: number }>;
    distanceMeters: number;
  },
  reason: string
) {
  const etaMinutes = Math.max(1, Math.ceil(newRoute.durationSeconds / 60));

  await repo.createAction(crisisId, {
    id: uuid(),
    type: 'traffic_reroute',
    title: `Traffic reroute: ${leg.unit} → ${leg.facility ?? 'unit'}`,
    payload: {
      unit: leg.unit,
      facility: leg.facility,
      actionId: leg.actionId,
      reason,
      previousEtaMinutes: leg.lastEtaMinutes,
      newEtaMinutes: etaMinutes,
      autoReroute: true,
    },
    priority: 1,
  });

  await repo.createRouteOverride(crisisId, {
    from: { lat: leg.facilityLat, lng: leg.facilityLng },
    to: { lat: leg.incidentLat, lng: leg.incidentLng },
    alternatePolyline: newRoute.polyline,
    reason,
    congestionDelta: -0.15,
  });

  broadcast({
    type: 'dispatch.rerouted',
    crisisId,
    reportId,
    timestamp: new Date().toISOString(),
    payload: {
      crisisId,
      reportId,
      unit: leg.unit,
      facility: leg.facility,
      reason,
      etaMinutes,
      previousEtaMinutes: leg.lastEtaMinutes,
      polyline: newRoute.polyline,
      auto: true,
    },
  });

  if (reportId) {
    broadcast({
      type: 'citizen.alert',
      reportId,
      crisisId,
      timestamp: new Date().toISOString(),
      payload: {
        reportId,
        message: `Traffic alert: ${leg.unit} rerouted — ${reason}`,
        route: {
          alternateRoute: newRoute.alternateRoute,
          durationSeconds: newRoute.durationSeconds,
          polyline: newRoute.polyline,
          source: 'google',
        },
      },
    });
  }

  console.log(`[dispatch-traffic] rerouted ${leg.unit} (${leg.facility}) crisis=${crisisId} ETA ${etaMinutes}m`);
}

async function checkLeg(
  crisisId: string,
  reportId: string,
  leg: ActiveDispatchLeg
): Promise<ActiveDispatchLeg> {
  const updated = { ...leg, lastCheckedAt: new Date().toISOString() };

  if (!hasGoogleMapsKey()) return updated;

  const routes = await computeBestRoute(
    { lat: leg.facilityLat, lng: leg.facilityLng },
    { lat: leg.incidentLat, lng: leg.incidentLng }
  );

  if (!routes) return updated;

  const { best } = routes;
  const currentDuration = best.durationSeconds;
  const slowdown =
    currentDuration >= leg.baselineDurationSeconds * TRAFFIC_SLOWDOWN_RATIO ||
    currentDuration >= leg.lastDurationSeconds * TRAFFIC_SLOWDOWN_RATIO;

  const improvementVsLast =
    leg.lastDurationSeconds > 0 &&
    currentDuration < leg.lastDurationSeconds * (1 - REROUTE_IMPROVEMENT_RATIO);

  const hasAlternateCorridor = routes.alternatives.length > 1;

  if (slowdown && (improvementVsLast || hasAlternateCorridor) && leg.rerouteCount < 5) {
    const savedMin = Math.round((leg.lastDurationSeconds - currentDuration) / 60);
    const reason =
      savedMin > 0
        ? `Heavy traffic on previous corridor — alternate route saves ~${savedMin} min (Google traffic data)`
        : `Heavy traffic detected — switched to faster alternate corridor`;

    await applyTrafficReroute(crisisId, reportId, leg, best, reason);

    updated.rerouteCount = leg.rerouteCount + 1;
    updated.lastDurationSeconds = currentDuration;
    updated.lastEtaMinutes = Math.ceil(currentDuration / 60);
    updated.baselineDurationSeconds = currentDuration;
    updated.routePolyline = best.polyline;
    updated.dispatchedAt = new Date().toISOString();
    updated.progress = Math.min(leg.progress ?? 0, 0.35);
    return updated;
  }

  updated.lastDurationSeconds = currentDuration;
  updated.lastEtaMinutes = Math.ceil(currentDuration / 60);
  return updated;
}

export async function runDispatchTrafficMonitorTick() {
  const crises = await repo.listExecutingCrises();
  if (crises.length === 0) return;

  for (const crisis of crises) {
    const crisisId = String(crisis.id);
    const report = await repo.getCitizenReportForCrisis(crisisId);
    if (!report) continue;

    const reportId = String(report.id);
    const meta = parseMeta(report.metadata);
    const legs = meta.activeDispatches as ActiveDispatchLeg[] | undefined;
    if (!legs?.length) continue;

    const updatedLegs: ActiveDispatchLeg[] = [];
    for (const leg of legs) {
      try {
        updatedLegs.push(await checkLeg(crisisId, reportId, leg));
      } catch (err) {
        console.warn('[dispatch-traffic] leg check failed', leg.actionId, err);
        updatedLegs.push(leg);
      }
    }

    await repo.updateCitizenReportMetadata(reportId, {
      activeDispatches: updatedLegs,
      lastTrafficMonitorAt: new Date().toISOString(),
    });
  }
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

export function startDispatchTrafficMonitor() {
  if (monitorTimer) return;
  if (!hasGoogleMapsKey()) {
    console.warn('[dispatch-traffic] GOOGLE_MAPS_API_KEY missing — auto reroute disabled');
    return;
  }

  console.log(`[dispatch-traffic] monitor every ${MONITOR_INTERVAL_MS}ms`);
  monitorTimer = setInterval(() => {
    runDispatchTrafficMonitorTick().catch((err) =>
      console.error('[dispatch-traffic] tick error', err)
    );
  }, MONITOR_INTERVAL_MS);

  runDispatchTrafficMonitorTick().catch((err) =>
    console.error('[dispatch-traffic] initial tick', err)
  );
}

export function stopDispatchTrafficMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
}
