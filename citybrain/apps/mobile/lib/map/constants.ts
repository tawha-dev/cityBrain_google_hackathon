import type { MapOverlayFull } from './types';

/** Z-order: lower renders first (underneath). */
export const LAYER_Z_INDEX: Record<string, number> = {
  alert_zone: 10,
  flood_zone: 20,
  congestion_corridor: 30,
  closed_road: 35,
  reroute_path: 40,
  heatmap: 45,
  rescue_unit: 50,
  emergency_hotspot: 60,
};

export const OVERLAY_COLORS: Record<string, string> = {
  flood_zone: '#0066FF',
  congestion_corridor: '#FF3B5C',
  rescue_unit: '#00FF88',
  reroute_path: '#00FFC6',
  alert_zone: '#FFB020',
  closed_road: '#FF3B5C',
  emergency_hotspot: '#FF3B5C',
  heatmap: '#FF6B35',
};

export function overlayColor(type: string, fallback?: string): string {
  return fallback ?? OVERLAY_COLORS[type] ?? '#00FFC6';
}

export function sortOverlaysByZ(overlays: MapOverlayFull[]): MapOverlayFull[] {
  return [...overlays].sort(
    (a, b) => (LAYER_Z_INDEX[a.type] ?? 25) - (LAYER_Z_INDEX[b.type] ?? 25)
  );
}

export const LEGEND_ITEMS: Array<{ type: string; label: string }> = [
  { type: 'emergency_hotspot', label: 'Hotspot' },
  { type: 'flood_zone', label: 'Flood' },
  { type: 'congestion_corridor', label: 'Congestion' },
  { type: 'reroute_path', label: 'Detour' },
  { type: 'rescue_unit', label: 'Rescue' },
  { type: 'closed_road', label: 'Closure' },
  { type: 'alert_zone', label: 'Alerts' },
];
