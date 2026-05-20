export interface GeocodeResult {
  lat: number;
  lng: number;
  areaLabel: string;
  formattedAddress: string;
  source: 'google' | 'fallback';
}

export interface RouteResult {
  alternateRoute: string;
  distanceMeters: number;
  durationSeconds: number;
  polyline: Array<{ lat: number; lng: number }>;
  source: 'google' | 'osrm' | 'simulated';
}

/** Google Routes API first, then OSRM road geometry, then null. */
export async function computeRouteWithFallback(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const google = await computeRoute(origin, destination);
  if (google) return google;

  const { computeRouteOsrm } = await import('./osrm-route.js');
  return computeRouteOsrm(origin, destination);
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  types: string[];
  lat: number;
  lng: number;
  address?: string;
}

export interface NearbySearchOptions {
  keyword?: string;
  type?: string;
  radiusMeters?: number;
  limit?: number;
}

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn('[google-maps] geocode', res.status);
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }>;
  };
  const first = data.results?.[0];
  if (!first) return null;

  const neighborhood =
    first.address_components?.find((c) => c.types.includes('sublocality') || c.types.includes('neighborhood'))
      ?.long_name ??
    first.address_components?.find((c) => c.types.includes('locality'))?.long_name ??
    'Unknown area';

  return {
    lat,
    lng,
    areaLabel: neighborhood,
    formattedAddress: first.formatted_address ?? neighborhood,
    source: 'google',
  };
}

function parseRouteDuration(duration?: string): number {
  const match = duration?.match(/(\d+)s/);
  return match ? Number(match[1]) : 600;
}

function mapGoogleRoute(route: {
  description?: string;
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
}): RouteResult | null {
  if (!route.polyline?.encodedPolyline) return null;
  return {
    alternateRoute: route.description ?? 'Traffic-aware route',
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseRouteDuration(route.duration),
    polyline: decodePolyline(route.polyline.encodedPolyline),
    source: 'google',
  };
}

/** Fetch all traffic-aware route options and return the fastest. */
export async function computeBestRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ best: RouteResult; alternatives: RouteResult[] } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.routeLabels',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: true,
    }),
  });

  if (!res.ok) {
    console.warn('[google-maps] routes', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = (await res.json()) as {
    routes?: Array<{
      description?: string;
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const parsed = (data.routes ?? [])
    .map(mapGoogleRoute)
    .filter((r): r is RouteResult => r != null)
    .sort((a, b) => a.durationSeconds - b.durationSeconds);

  if (parsed.length === 0) return null;
  return { best: parsed[0]!, alternatives: parsed };
}

export async function computeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const result = await computeBestRoute(origin, destination);
  return result?.best ?? null;
}

export async function nearbyPlaces(
  lat: number,
  lng: number,
  keywordOrOptions: string | NearbySearchOptions = 'hospital police emergency'
): Promise<NearbyPlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];

  const opts: NearbySearchOptions =
    typeof keywordOrOptions === 'string' ? { keyword: keywordOrOptions } : keywordOrOptions;

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(opts.radiusMeters ?? 5000));
  if (opts.keyword) url.searchParams.set('keyword', opts.keyword);
  if (opts.type) url.searchParams.set('type', opts.type);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      place_id?: string;
      name?: string;
      types?: string[];
      vicinity?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  };

  const limit = opts.limit ?? 5;
  return (data.results ?? []).slice(0, limit).map((p) => ({
    placeId: p.place_id ?? `${p.name}-${p.geometry?.location?.lat}`,
    name: p.name ?? 'POI',
    types: p.types ?? [],
    lat: p.geometry?.location?.lat ?? lat,
    lng: p.geometry?.location?.lng ?? lng,
    address: p.vicinity,
  }));
}

export function hasGoogleMapsKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}
