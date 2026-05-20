import type { MapOverlayFull, GeoPoint } from './types';
import { overlayColor } from './constants';

let legacyId = 0;
const nextId = () => `map-${++legacyId}-${Date.now()}`;

function asPoint(v: unknown): GeoPoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { lat?: number; lng?: number };
  if (typeof o.lat !== 'number' || typeof o.lng !== 'number') return null;
  return { lat: o.lat, lng: o.lng };
}

function normalizeOverlay(raw: Record<string, unknown>, index: number): MapOverlayFull | null {
  const geometry = raw.geometry as MapOverlayFull['geometry'] | undefined;
  if (!geometry?.kind || !Array.isArray(geometry.coordinates)) return null;

  const type = String(raw.type ?? 'unknown');
  const styleRaw = (raw.style ?? {}) as Record<string, unknown>;

  return {
    id: String(raw.id ?? `overlay-${index}`),
    type,
    label: raw.label ? String(raw.label) : undefined,
    geometry: {
      kind: geometry.kind,
      coordinates: geometry.coordinates.map((c) => ({
        lat: Number((c as GeoPoint).lat),
        lng: Number((c as GeoPoint).lng),
      })),
      radiusMeters: geometry.radiusMeters,
    },
    style: {
      color: String(styleRaw.color ?? overlayColor(type)),
      opacity: Number(styleRaw.opacity ?? 0.6),
      weight: styleRaw.weight != null ? Number(styleRaw.weight) : undefined,
      pulse: Boolean(styleRaw.pulse),
    },
    metadata: (raw.metadata as Record<string, unknown>) ?? undefined,
  };
}

/** Convert legacy execution map state into typed overlays. */
function overlaysFromLegacy(payload: Record<string, unknown>): MapOverlayFull[] {
  const overlays: MapOverlayFull[] = [];
  const centroid = asPoint(payload.centroid);
  const c = centroid ?? { lat: 33.6844, lng: 73.0479 };

  overlays.push({
    id: 'hotspot-legacy',
    type: 'emergency_hotspot',
    label: 'Crisis epicenter',
    geometry: { kind: 'point', coordinates: [c] },
    style: { color: '#FF3B5C', opacity: 1, pulse: true },
  });

  const floodZones = (payload.floodZones as unknown[]) ?? [];
  for (const fz of floodZones) {
    const p = asPoint(fz);
    if (!p) continue;
    overlays.push({
      id: nextId(),
      type: 'flood_zone',
      label: 'Flood zone',
      geometry: { kind: 'circle', coordinates: [p], radiusMeters: 450 },
      style: { color: '#0066FF', opacity: 0.4, pulse: true },
    });
  }

  const routes = (payload.routes as Array<Record<string, unknown>>) ?? [];
  for (const route of routes) {
    const poly = (route.alternatePolyline as GeoPoint[]) ?? [];
    if (poly.length < 2) continue;
    overlays.push({
      id: String(route.id ?? nextId()),
      type: 'reroute_path',
      label: 'Detour',
      geometry: { kind: 'polyline', coordinates: poly },
      style: { color: '#00FFC6', opacity: 0.9, weight: 5 },
    });
  }

  const resources = (payload.resources as Array<Record<string, unknown>>) ?? [];
  for (const r of resources) {
    const p = asPoint({ lat: r.lat, lng: r.lng });
    if (!p) continue;
    overlays.push({
      id: String(r.unitId ?? nextId()),
      type: 'rescue_unit',
      label: String(r.type ?? 'unit'),
      geometry: { kind: 'point', coordinates: [p] },
      style: { color: '#00FF88', opacity: 1 },
    });
  }

  return overlays;
}

/** Normalize map.delta / simulation.frame payloads into renderable overlays. */
export function parseMapPayload(payload: unknown): MapOverlayFull[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const rawOverlays = p.overlays;

  if (Array.isArray(rawOverlays) && rawOverlays.length > 0) {
    const first = rawOverlays[0] as Record<string, unknown>;
    if (first?.geometry) {
      return rawOverlays
        .map((o, i) => normalizeOverlay(o as Record<string, unknown>, i))
        .filter((o): o is MapOverlayFull => o !== null);
    }
  }

  return overlaysFromLegacy(p);
}
