import * as repo from '../../db/repository.js';
import { broadcast } from '../../ws/hub.js';
import type { ActiveDispatchLeg } from '../dispatch-traffic/monitor.js';

const POSITION_TICK_MS = Number(process.env.DISPATCH_POSITION_TICK_MS ?? 8_000);

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

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function polylineLengthMeters(points: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1]!, points[i]!);
  }
  return total;
}

/** Position along polyline at progress 0..1 (by distance). */
export function interpolateOnPolyline(
  points: Array<{ lat: number; lng: number }>,
  progress: number
): { lat: number; lng: number } {
  if (points.length === 0) return { lat: 0, lng: 0 };
  if (points.length === 1 || progress <= 0) return { ...points[0]! };
  if (progress >= 1) return { ...points[points.length - 1]! };

  const total = polylineLengthMeters(points);
  if (total <= 0) return { ...points[0]! };

  const target = total * progress;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = haversineMeters(points[i - 1]!, points[i]!);
    if (walked + segLen >= target) {
      const t = segLen > 0 ? (target - walked) / segLen : 0;
      return {
        lat: points[i - 1]!.lat + (points[i]!.lat - points[i - 1]!.lat) * t,
        lng: points[i - 1]!.lng + (points[i]!.lng - points[i - 1]!.lng) * t,
      };
    }
    walked += segLen;
  }
  return { ...points[points.length - 1]! };
}

function buildFallbackPolyline(leg: ActiveDispatchLeg): Array<{ lat: number; lng: number }> {
  return [
    { lat: leg.facilityLat, lng: leg.facilityLng },
    { lat: leg.incidentLat, lng: leg.incidentLng },
  ];
}

function advanceLeg(leg: ActiveDispatchLeg, nowMs: number): ActiveDispatchLeg {
  if (leg.arrived) return leg;

  const dispatchedAt = leg.dispatchedAt ? Date.parse(leg.dispatchedAt) : nowMs;
  const durationMs = Math.max(60_000, (leg.lastDurationSeconds ?? leg.baselineDurationSeconds) * 1000);
  const elapsed = Math.max(0, nowMs - dispatchedAt);
  const progress = Math.min(0.99, elapsed / durationMs);

  const polyline =
    leg.routePolyline && leg.routePolyline.length >= 2
      ? leg.routePolyline
      : buildFallbackPolyline(leg);

  const pos = interpolateOnPolyline(polyline, progress);
  const incident = { lat: leg.incidentLat, lng: leg.incidentLng };
  const distanceRemainingMeters = Math.round(haversineMeters(pos, incident));

  const arrived = progress >= 0.98 || distanceRemainingMeters < 80;

  return {
    ...leg,
    progress,
    currentLat: pos.lat,
    currentLng: pos.lng,
    distanceRemainingMeters,
    arrived,
    lastEtaMinutes: arrived ? 0 : Math.max(1, Math.ceil((durationMs - elapsed) / 60_000)),
  };
}

export async function runDispatchPositionTick() {
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

    const nowMs = Date.now();
    const updatedLegs: ActiveDispatchLeg[] = [];
    const incident = { lat: Number(report.lat), lng: Number(report.lng) };

    for (const leg of legs) {
      const advanced = advanceLeg(leg, nowMs);
      updatedLegs.push(advanced);

      if (advanced.arrived && leg.arrived) continue;

      const polyline =
        advanced.routePolyline && advanced.routePolyline.length >= 2
          ? advanced.routePolyline
          : buildFallbackPolyline(advanced);

      broadcast({
        type: 'dispatch.position',
        crisisId,
        reportId,
        timestamp: new Date().toISOString(),
        payload: {
          crisisId,
          reportId,
          actionId: advanced.actionId,
          unit: advanced.unit,
          facility: advanced.facility,
          lat: advanced.currentLat,
          lng: advanced.currentLng,
          progress: advanced.progress,
          etaMinutes: advanced.lastEtaMinutes,
          distanceRemainingMeters: advanced.distanceRemainingMeters,
          arrived: advanced.arrived,
          routePolyline: polyline.length > 500 ? polyline.slice(0, 500) : polyline,
          incident,
        },
      });

      if (advanced.lastEtaMinutes !== leg.lastEtaMinutes && !advanced.arrived) {
        broadcast({
          type: 'dispatch.eta_update',
          crisisId,
          reportId,
          timestamp: new Date().toISOString(),
          payload: {
            crisisId,
            reportId,
            actionId: advanced.actionId,
            unit: advanced.unit,
            etaMinutes: advanced.lastEtaMinutes,
            distanceRemainingMeters: advanced.distanceRemainingMeters,
          },
        });
      }
    }

    await repo.updateCitizenReportMetadata(reportId, {
      activeDispatches: updatedLegs,
      lastPositionTickAt: new Date().toISOString(),
    });
  }
}

let positionTimer: ReturnType<typeof setInterval> | null = null;

export function startDispatchPositionTracker() {
  if (positionTimer) return;
  console.log(`[dispatch-tracking] position tick every ${POSITION_TICK_MS}ms`);
  positionTimer = setInterval(() => {
    runDispatchPositionTick().catch((err) =>
      console.error('[dispatch-tracking] tick error', err)
    );
  }, POSITION_TICK_MS);
  runDispatchPositionTick().catch((err) =>
    console.error('[dispatch-tracking] initial tick', err)
  );
}

export function stopDispatchPositionTracker() {
  if (positionTimer) clearInterval(positionTimer);
  positionTimer = null;
}
