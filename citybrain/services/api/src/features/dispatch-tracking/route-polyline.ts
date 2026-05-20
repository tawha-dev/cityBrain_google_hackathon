import { computeRouteWithFallback } from '../../integrations/google-maps.js';

/** Fewer points than this is treated as a straight-line fallback. */
const MIN_ROAD_POINTS = 8;

export function needsRoadPolyline(polyline?: Array<{ lat: number; lng: number }>): boolean {
  return !polyline || polyline.length < MIN_ROAD_POINTS;
}

/** Resolve a road-following polyline (Google → OSRM) for dispatch legs. */
export async function ensureDispatchRoutePolyline(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  existing?: Array<{ lat: number; lng: number }>
): Promise<Array<{ lat: number; lng: number }>> {
  if (existing && existing.length >= MIN_ROAD_POINTS) {
    return existing;
  }

  const route = await computeRouteWithFallback(from, to);
  if (route && route.polyline.length >= MIN_ROAD_POINTS) {
    return route.polyline;
  }
  if (route && route.polyline.length >= 2) {
    return route.polyline;
  }

  if (existing && existing.length >= 2) return existing;
  return [
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
  ];
}

export async function enrichDispatchLegPolylines<
  T extends {
    facilityLat?: number;
    facilityLng?: number;
    incidentLat?: number;
    incidentLng?: number;
    routePolyline?: Array<{ lat: number; lng: number }>;
  },
>(legs: T[], incident: { lat: number; lng: number } | null): Promise<T[]> {
  if (!incident) return legs;

  return Promise.all(
    legs.map(async (leg) => {
      const fromLat = leg.facilityLat;
      const fromLng = leg.facilityLng;
      if (fromLat == null || fromLng == null) return leg;

      const to = {
        lat: leg.incidentLat ?? incident.lat,
        lng: leg.incidentLng ?? incident.lng,
      };

      const polyline = await ensureDispatchRoutePolyline(
        { lat: Number(fromLat), lng: Number(fromLng) },
        to,
        leg.routePolyline as Array<{ lat: number; lng: number }> | undefined
      );

      return { ...leg, routePolyline: polyline };
    })
  );
}
