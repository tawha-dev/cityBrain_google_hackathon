/** Client-side incident helpers (mirrors API incident-profiles). */

export type IncidentKind =
  | 'flood'
  | 'urban_flood'
  | 'tsunami'
  | 'earthquake'
  | 'landslide'
  | 'rain_alert'
  | 'fire'
  | 'accident'
  | 'storm'
  | 'general';

export type EmergencyResourceCategory =
  | 'hospital'
  | 'fire_station'
  | 'police'
  | 'ambulance'
  | 'shelter'
  | 'evacuation'
  | 'rescue'
  | 'civil_defense'
  | 'pharmacy'
  | 'blood_bank'
  | 'coast_guard';

export interface DispatchActionDef {
  id: string;
  label: string;
  icon: string;
  units: string[];
  tone: 'info' | 'ok' | 'warn' | 'danger';
}

const CATEGORY_ALIASES: Record<string, IncidentKind> = {
  flood: 'flood',
  urban_flood: 'urban_flood',
  tsunami: 'tsunami',
  earthquake: 'earthquake',
  landslide: 'landslide',
  rain_alert: 'rain_alert',
  heavy_rain: 'rain_alert',
  fire: 'fire',
  accident: 'accident',
  storm: 'storm',
  other: 'general',
};

export function normalizeIncidentKind(category?: string, crisisType?: string): IncidentKind {
  const c = (category ?? '').toLowerCase().replace(/\s+/g, '_');
  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  const t = (crisisType ?? '').toLowerCase();
  if (t === 'flood') return 'flood';
  if (t === 'accident') return 'accident';
  if (t === 'infrastructure_failure') return 'fire';
  if (t === 'tsunami') return 'tsunami';
  if (t === 'earthquake') return 'earthquake';
  return 'general';
}

export function getDispatchActionsForIncident(kind: IncidentKind): DispatchActionDef[] {
  const common: DispatchActionDef[] = [
    { id: 'ambulance', label: 'Medical / Ambulance', icon: '🚑', units: ['ambulance'], tone: 'info' },
    { id: 'rescue', label: 'Rescue Teams', icon: '⛑', units: ['rescue'], tone: 'ok' },
    { id: 'police', label: 'Police / Security', icon: '🚔', units: ['police'], tone: 'warn' },
  ];

  const byKind: Partial<Record<IncidentKind, DispatchActionDef[]>> = {
    flood: [
      { id: 'flood_rescue', label: 'Flood Rescue', icon: '🌊', units: ['rescue', 'pump'], tone: 'info' },
      { id: 'shelter', label: 'Open Shelters', icon: '🏕', units: ['shelter'], tone: 'ok' },
      { id: 'evacuate', label: 'Evacuation', icon: '🚨', units: ['evacuation', 'rescue'], tone: 'danger' },
    ],
    urban_flood: [
      { id: 'flood_rescue', label: 'Urban Flood Rescue', icon: '🌊', units: ['rescue', 'pump'], tone: 'info' },
      { id: 'shelter', label: 'Shelter & Relief', icon: '🏕', units: ['shelter'], tone: 'ok' },
    ],
    tsunami: [
      { id: 'coast', label: 'Coast / Maritime', icon: '⚓', units: ['coast_guard', 'rescue'], tone: 'danger' },
      { id: 'evacuate', label: 'Coastal Evacuation', icon: '🚨', units: ['evacuation', 'shelter'], tone: 'danger' },
    ],
    earthquake: [
      { id: 'usr', label: 'Search & Rescue', icon: '🔍', units: ['rescue', 'fire'], tone: 'danger' },
      { id: 'shelter', label: 'Relief Camps', icon: '🏕', units: ['shelter'], tone: 'ok' },
    ],
    rain_alert: [
      { id: 'alert', label: 'Rain Alert Response', icon: '🌧', units: ['rescue', 'shelter'], tone: 'warn' },
    ],
    fire: [{ id: 'fire', label: 'Fire Brigade', icon: '🔥', units: ['fire', 'rescue'], tone: 'danger' }],
    accident: [
      { id: 'medical', label: 'Trauma Response', icon: '🚑', units: ['ambulance', 'hospital'], tone: 'info' },
    ],
    storm: [
      { id: 'cyclone', label: 'Storm / Cyclone', icon: '🌀', units: ['shelter', 'evacuation'], tone: 'danger' },
    ],
  };

  const specific = byKind[kind] ?? [];
  const ids = new Set<string>();
  return [...specific, ...common].filter((a) => {
    if (ids.has(a.id)) return false;
    ids.add(a.id);
    return true;
  });
}

export const REPORT_CATEGORIES = [
  { key: 'flood', label: 'Flood', emoji: '🌊' },
  { key: 'urban_flood', label: 'Urban flooding', emoji: '🏙' },
  { key: 'tsunami', label: 'Tsunami', emoji: '🌊' },
  { key: 'earthquake', label: 'Earthquake', emoji: '🫨' },
  { key: 'landslide', label: 'Landslide', emoji: '⛰' },
  { key: 'rain_alert', label: 'Rain / monsoon alert', emoji: '🌧' },
  { key: 'fire', label: 'Fire', emoji: '🔥' },
  { key: 'accident', label: 'Accident', emoji: '🚗' },
  { key: 'storm', label: 'Storm / cyclone', emoji: '🌀' },
  { key: 'other', label: 'Other emergency', emoji: '⚠️' },
] as const;
