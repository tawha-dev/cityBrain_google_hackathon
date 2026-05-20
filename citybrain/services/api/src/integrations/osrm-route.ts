import type { RouteResult } from './google-maps.js';

/**
 * Free road-following routes via public OSRM (OpenStreetMap).
 * Used when Google Routes API is unavailable or fails.
 */
export async function computeRouteOsrm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coords}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn('[osrm] route', res.status);
      return null;
    }

    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    if (data.code !== 'Ok') return null;

    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;

    const polyline = coordinates.map(([lng, lat]) => ({ lat, lng }));

    return {
      alternateRoute: 'Road route via OpenStreetMap',
      distanceMeters: Math.round(route.distance ?? 0),
      durationSeconds: Math.round(route.duration ?? 0),
      polyline,
      source: 'osrm',
    };
  } catch (err) {
    console.warn('[osrm] route error', err);
    return null;
  }
}
