import {
  nearbyPlaces,
  computeRoute,
  hasGoogleMapsKey,
} from '../../integrations/google-maps.js';
import {
  type IncidentKind,
  type EmergencyResourceCategory,
  normalizeIncidentKind,
  getSearchQueriesForIncident,
  getIncidentLabel,
  unitToResourceCategory,
} from './incident-profiles.js';

export type { EmergencyResourceCategory, IncidentKind } from './incident-profiles.js';
export {
  normalizeIncidentKind,
  getIncidentLabel,
  getDispatchActionsForIncident,
} from './incident-profiles.js';

export interface EmergencyResource {
  placeId: string;
  name: string;
  category: EmergencyResourceCategory;
  lat: number;
  lng: number;
  types: string[];
  distanceMeters: number;
  etaMinutes: number | null;
  address?: string;
  source: 'google_places' | 'fallback';
  incidentKind?: IncidentKind;
}

/** Pakistan-wide fallback assets when Places API unavailable (Karachi-centered demo). */
const FALLBACK_RESOURCES: EmergencyResource[] = [
  { placeId: 'fb-jpmc', name: 'Jinnah Postgraduate Medical Centre', category: 'hospital', lat: 24.918, lng: 67.092, types: ['hospital'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-civil', name: 'Civil Hospital Karachi', category: 'hospital', lat: 24.86, lng: 67.01, types: ['hospital'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-aga', name: 'Aga Khan University Hospital', category: 'hospital', lat: 24.935, lng: 67.075, types: ['hospital'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-edhi', name: 'Edhi Ambulance Service — Saddar', category: 'ambulance', lat: 24.865, lng: 67.03, types: ['ambulance'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-chippa', name: 'Chippa Ambulance', category: 'ambulance', lat: 24.87, lng: 67.04, types: ['ambulance'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-fire-saddar', name: 'Karachi Fire Brigade — Saddar', category: 'fire_station', lat: 24.857, lng: 67.025, types: ['fire_station'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-fire-clifton', name: 'Fire Station Clifton', category: 'fire_station', lat: 24.813, lng: 67.03, types: ['fire_station'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-police-saddar', name: 'Saddar Police Station', category: 'police', lat: 24.858, lng: 67.028, types: ['police'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-shelter-expo', name: 'Expo Centre Relief Camp', category: 'shelter', lat: 24.894, lng: 67.078, types: ['shelter'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-shelter-maj', name: 'M.A. Jinnah Road Relief Point', category: 'shelter', lat: 24.865, lng: 67.02, types: ['shelter'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-rescue-ndma', name: 'NDMA Provincial Response Cell', category: 'rescue', lat: 24.87, lng: 67.05, types: ['rescue'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-rescue-rangers', name: 'Pakistan Rangers — Disaster Cell', category: 'rescue', lat: 24.88, lng: 67.04, types: ['rescue'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-civil-def', name: 'Civil Defence Karachi HQ', category: 'civil_defense', lat: 24.852, lng: 67.015, types: ['civil_defense'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-evac-hill', name: 'High-ground Evacuation Point — Burns Road', category: 'evacuation', lat: 24.862, lng: 67.018, types: ['evacuation'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-coast-kpt', name: 'Karachi Port Trust Emergency', category: 'coast_guard', lat: 24.84, lng: 66.98, types: ['coast_guard'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-blood', name: 'Hussaini Blood Bank', category: 'blood_bank', lat: 24.868, lng: 67.032, types: ['blood_bank'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
  { placeId: 'fb-pharmacy', name: '24hr Emergency Pharmacy — Saddar', category: 'pharmacy', lat: 24.859, lng: 67.027, types: ['pharmacy'], distanceMeters: 0, etaMinutes: null, source: 'fallback' },
];

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferCategory(types: string[], keywordCategory: EmergencyResourceCategory): EmergencyResourceCategory {
  if (types.includes('fire_station')) return 'fire_station';
  if (types.includes('police')) return 'police';
  if (types.includes('hospital') || types.includes('doctor')) return 'hospital';
  if (types.includes('pharmacy')) return 'pharmacy';
  return keywordCategory;
}

function filterFallbackForIncident(kind: IncidentKind, radiusMeters: number, lat: number, lng: number): EmergencyResource[] {
  const priority: Record<IncidentKind, EmergencyResourceCategory[]> = {
    flood: ['shelter', 'rescue', 'evacuation', 'civil_defense', 'hospital', 'ambulance', 'fire_station', 'police'],
    urban_flood: ['shelter', 'rescue', 'evacuation', 'civil_defense', 'hospital', 'ambulance', 'fire_station'],
    tsunami: ['coast_guard', 'evacuation', 'shelter', 'rescue', 'hospital', 'ambulance', 'civil_defense'],
    earthquake: ['rescue', 'hospital', 'shelter', 'civil_defense', 'ambulance', 'blood_bank', 'pharmacy', 'fire_station'],
    landslide: ['rescue', 'hospital', 'shelter', 'fire_station', 'ambulance'],
    rain_alert: ['shelter', 'evacuation', 'rescue', 'civil_defense', 'hospital', 'ambulance'],
    fire: ['fire_station', 'hospital', 'ambulance', 'rescue', 'police'],
    accident: ['hospital', 'ambulance', 'police', 'rescue'],
    storm: ['shelter', 'evacuation', 'rescue', 'civil_defense', 'hospital'],
    general: ['hospital', 'ambulance', 'fire_station', 'police', 'rescue', 'shelter'],
  };

  const order = priority[kind] ?? priority.general;
  const ranked = FALLBACK_RESOURCES.map((r) => ({
    ...r,
    distanceMeters: haversineMeters(lat, lng, r.lat, r.lng),
    etaMinutes: Math.max(5, Math.round(haversineMeters(lat, lng, r.lat, r.lng) / 350)),
    incidentKind: kind,
  }))
    .filter((r) => r.distanceMeters <= radiusMeters * 2)
    .sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.distanceMeters - b.distanceMeters;
    });

  return ranked.slice(0, 14);
}

async function enrichWithRoutes(
  incident: { lat: number; lng: number },
  resources: EmergencyResource[]
): Promise<EmergencyResource[]> {
  if (!hasGoogleMapsKey()) {
    return resources.map((r) => ({
      ...r,
      etaMinutes: r.etaMinutes ?? Math.max(3, Math.round(r.distanceMeters / 400)),
    }));
  }

  const top = resources.slice(0, 10);
  const enriched = await Promise.all(
    top.map(async (r) => {
      const route = await computeRoute({ lat: r.lat, lng: r.lng }, incident);
      const etaMinutes = route
        ? Math.max(1, Math.ceil(route.durationSeconds / 60))
        : Math.max(3, Math.round(r.distanceMeters / 400));
      return { ...r, etaMinutes, distanceMeters: route?.distanceMeters ?? r.distanceMeters };
    })
  );

  const rest = resources.slice(10).map((r) => ({
    ...r,
    etaMinutes: r.etaMinutes ?? Math.max(3, Math.round(r.distanceMeters / 400)),
  }));

  return [...enriched, ...rest].sort((a, b) => (a.etaMinutes ?? 99) - (b.etaMinutes ?? 99));
}

export async function findNearbyEmergencyResources(
  lat: number,
  lng: number,
  options?: {
    radiusMeters?: number;
    withRoutes?: boolean;
    incidentKind?: IncidentKind;
    category?: string;
    crisisType?: string;
  }
): Promise<EmergencyResource[]> {
  const radiusMeters = options?.radiusMeters ?? 6000;
  const withRoutes = options?.withRoutes ?? true;
  const kind =
    options?.incidentKind ??
    normalizeIncidentKind(options?.category, options?.crisisType);

  const queries = getSearchQueriesForIncident(kind);

  if (!hasGoogleMapsKey()) {
    return filterFallbackForIncident(kind, radiusMeters, lat, lng);
  }

  const seen = new Set<string>();
  const raw: EmergencyResource[] = [];

  for (const cfg of queries) {
    const places = await nearbyPlaces(lat, lng, {
      keyword: cfg.keyword,
      type: cfg.type,
      radiusMeters,
      limit: cfg.limit ?? 3,
    });

    for (const p of places) {
      const key = p.placeId ?? `${p.name}-${p.lat}`;
      if (seen.has(key)) continue;
      seen.add(key);

      raw.push({
        placeId: p.placeId ?? key,
        name: p.name,
        category: inferCategory(p.types, cfg.category),
        lat: p.lat,
        lng: p.lng,
        types: p.types,
        distanceMeters: haversineMeters(lat, lng, p.lat, p.lng),
        etaMinutes: null,
        address: p.address,
        source: 'google_places',
        incidentKind: kind,
      });
    }
  }

  const sorted = raw.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 18);

  if (sorted.length === 0) {
    return filterFallbackForIncident(kind, radiusMeters, lat, lng);
  }

  if (!withRoutes) {
    return sorted.map((r) => ({
      ...r,
      etaMinutes: Math.max(3, Math.round(r.distanceMeters / 400)),
    }));
  }

  return enrichWithRoutes({ lat, lng }, sorted);
}

export function pickResourcesForUnits(
  units: string[],
  resources: EmergencyResource[],
  explicitTargets?: Array<{ placeId: string; name: string; lat: number; lng: number; category?: string }>
): EmergencyResource[] {
  if (explicitTargets?.length) {
    return explicitTargets.map((t) => {
      const match = resources.find((r) => r.placeId === t.placeId);
      return (
        match ?? {
          placeId: t.placeId,
          name: t.name,
          category: (t.category as EmergencyResourceCategory) ?? 'hospital',
          lat: t.lat,
          lng: t.lng,
          types: [],
          distanceMeters: 0,
          etaMinutes: null,
          source: 'google_places' as const,
        }
      );
    });
  }

  const picked: EmergencyResource[] = [];
  const used = new Set<string>();

  for (const unit of units) {
    const want = unitToResourceCategory(unit);
    const match =
      resources.find((r) => r.category === want && !used.has(r.placeId)) ??
      resources.find((r) => !used.has(r.placeId));

    if (match) {
      used.add(match.placeId);
      picked.push({ ...match, category: want });
    }
  }

  return picked;
}

/** Categories preferred for citizen evacuation (away from hazard). */
const EVAC_PRIORITY: Record<IncidentKind, EmergencyResourceCategory[]> = {
  flood: ['shelter', 'evacuation', 'civil_defense', 'rescue', 'hospital', 'ambulance'],
  urban_flood: ['shelter', 'evacuation', 'civil_defense', 'rescue', 'hospital'],
  tsunami: ['evacuation', 'shelter', 'coast_guard', 'rescue', 'hospital'],
  earthquake: ['shelter', 'rescue', 'hospital', 'civil_defense', 'evacuation'],
  landslide: ['shelter', 'evacuation', 'rescue', 'hospital'],
  rain_alert: ['shelter', 'evacuation', 'civil_defense', 'rescue', 'hospital'],
  fire: ['evacuation', 'shelter', 'hospital', 'rescue', 'fire_station'],
  accident: ['hospital', 'shelter', 'evacuation', 'pharmacy', 'ambulance'],
  storm: ['shelter', 'evacuation', 'rescue', 'hospital', 'civil_defense'],
  general: ['shelter', 'evacuation', 'hospital', 'rescue', 'civil_defense'],
};

const MIN_EVAC_DISTANCE_M = 280;

function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceMeters: number
): { lat: number; lng: number } {
  const R = 6371000;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / R) +
      Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceMeters / R) * Math.cos(lat1),
      Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function evacBearingForKind(kind: IncidentKind, lat: number, lng: number): number {
  const base: Record<IncidentKind, number> = {
    flood: 35,
    urban_flood: 40,
    tsunami: 90,
    earthquake: 120,
    landslide: 200,
    rain_alert: 50,
    fire: 250,
    accident: 75,
    storm: 30,
    general: 60,
  };
  const jitter = ((Math.abs(lat * 1000) + Math.abs(lng * 1000)) % 40) - 20;
  return (base[kind] ?? 60) + jitter;
}

export interface SafeEvacuationDestination {
  lat: number;
  lng: number;
  name: string;
  placeId?: string;
  category?: EmergencyResourceCategory;
  source: 'nearby_resource' | 'query' | 'computed';
}

/** Pick nearest suitable shelter / hospital / evacuation point for safe-route. */
export function pickSafeEvacuationDestination(
  origin: { lat: number; lng: number },
  resources: EmergencyResource[],
  incidentKind: IncidentKind
): SafeEvacuationDestination {
  const order = EVAC_PRIORITY[incidentKind] ?? EVAC_PRIORITY.general;

  const ranked = resources
    .map((r) => ({
      ...r,
      distanceMeters: haversineMeters(origin.lat, origin.lng, r.lat, r.lng),
    }))
    .filter((r) => r.distanceMeters >= MIN_EVAC_DISTANCE_M)
    .sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.distanceMeters - b.distanceMeters;
    });

  if (ranked.length > 0) {
    const best = ranked[0]!;
    return {
      lat: best.lat,
      lng: best.lng,
      name: best.name,
      placeId: best.placeId,
      category: best.category,
      source: 'nearby_resource',
    };
  }

  const bearing = evacBearingForKind(incidentKind, origin.lat, origin.lng);
  const away = destinationPoint(origin.lat, origin.lng, bearing, 2800);
  return {
    lat: away.lat,
    lng: away.lng,
    name: `${getIncidentLabel(incidentKind)} — safe corridor (${Math.round(bearing)}°)`,
    source: 'computed',
  };
}

export async function resolveCrisisCoordinates(crisis: Record<string, unknown>): Promise<{ lat: number; lng: number }> {
  const lat = Number(crisis.centroid_lat);
  const lng = Number(crisis.centroid_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: 24.8607, lng: 67.0011 };
}
