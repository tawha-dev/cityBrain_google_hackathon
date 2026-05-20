/** Normalized incident kinds — drives nearby search + dispatch recommendations. */
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

export interface ResourceSearchQuery {
  category: EmergencyResourceCategory;
  type?: string;
  keyword: string;
  limit?: number;
}

const CATEGORY_ALIASES: Record<string, IncidentKind> = {
  flood: 'flood',
  urban_flood: 'urban_flood',
  urbanflooding: 'urban_flood',
  tsunami: 'tsunami',
  earthquake: 'earthquake',
  quake: 'earthquake',
  landslide: 'landslide',
  rain_alert: 'rain_alert',
  rain: 'rain_alert',
  heavy_rain: 'rain_alert',
  monsoon: 'rain_alert',
  fire: 'fire',
  wildfire: 'fire',
  accident: 'accident',
  crash: 'accident',
  traffic: 'accident',
  road_blockage: 'accident',
  infrastructure_failure: 'fire',
  storm: 'storm',
  cyclone: 'storm',
  hurricane: 'storm',
  other: 'general',
  general: 'general',
};

const CRISIS_TYPE_ALIASES: Record<string, IncidentKind> = {
  flood: 'flood',
  accident: 'accident',
  infrastructure_failure: 'fire',
  road_blockage: 'accident',
  tsunami: 'tsunami',
  earthquake: 'earthquake',
};

/** Core resources searched for every incident (minimum coverage). */
const CORE_SEARCH: ResourceSearchQuery[] = [
  { category: 'hospital', type: 'hospital', keyword: 'hospital emergency room', limit: 4 },
  { category: 'ambulance', keyword: 'ambulance emergency medical services', limit: 3 },
  { category: 'police', type: 'police', keyword: 'police station', limit: 3 },
  { category: 'fire_station', type: 'fire_station', keyword: 'fire station rescue', limit: 3 },
];

const PROFILE_SEARCH: Record<IncidentKind, ResourceSearchQuery[]> = {
  flood: [
    { category: 'shelter', keyword: 'emergency shelter flood relief camp', limit: 4 },
    { category: 'rescue', keyword: 'disaster rescue flood response NDMA', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence emergency Pakistan', limit: 2 },
    { category: 'evacuation', keyword: 'evacuation center flood', limit: 3 },
  ],
  urban_flood: [
    { category: 'shelter', keyword: 'urban flood shelter relief center', limit: 4 },
    { category: 'rescue', keyword: 'water rescue urban flooding', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence district office', limit: 2 },
    { category: 'evacuation', keyword: 'high ground evacuation point', limit: 2 },
  ],
  tsunami: [
    { category: 'coast_guard', keyword: 'coast guard maritime rescue', limit: 3 },
    { category: 'evacuation', keyword: 'tsunami evacuation shelter high ground', limit: 4 },
    { category: 'shelter', keyword: 'emergency shelter coastal', limit: 4 },
    { category: 'rescue', keyword: 'disaster rescue sea emergency', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence coastal emergency', limit: 2 },
  ],
  earthquake: [
    { category: 'rescue', keyword: 'urban search rescue earthquake', limit: 4 },
    { category: 'shelter', keyword: 'earthquake relief camp shelter', limit: 4 },
    { category: 'civil_defense', keyword: 'civil defence earthquake response', limit: 3 },
    { category: 'blood_bank', keyword: 'blood bank hospital emergency', limit: 2 },
    { category: 'pharmacy', keyword: 'pharmacy hospital 24 hours', limit: 2 },
  ],
  landslide: [
    { category: 'rescue', keyword: 'landslide rescue mountain emergency', limit: 4 },
    { category: 'shelter', keyword: 'relief shelter landslide', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence disaster', limit: 2 },
  ],
  rain_alert: [
    { category: 'shelter', keyword: 'rain flood shelter emergency', limit: 3 },
    { category: 'evacuation', keyword: 'evacuation center monsoon', limit: 3 },
    { category: 'civil_defense', keyword: 'disaster management rain alert', limit: 2 },
  ],
  fire: [
    { category: 'fire_station', type: 'fire_station', keyword: 'fire brigade station', limit: 5 },
    { category: 'rescue', keyword: 'fire rescue emergency', limit: 3 },
    { category: 'pharmacy', keyword: 'burn unit hospital emergency', limit: 2 },
  ],
  accident: [
    { category: 'hospital', type: 'hospital', keyword: 'trauma center emergency hospital', limit: 4 },
    { category: 'ambulance', keyword: 'ambulance 1122 rescue', limit: 4 },
    { category: 'police', type: 'police', keyword: 'traffic police highway', limit: 2 },
  ],
  storm: [
    { category: 'shelter', keyword: 'storm cyclone shelter', limit: 4 },
    { category: 'evacuation', keyword: 'cyclone evacuation center', limit: 3 },
    { category: 'rescue', keyword: 'disaster rescue storm', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence storm warning', limit: 2 },
  ],
  general: [
    { category: 'shelter', keyword: 'emergency shelter relief', limit: 3 },
    { category: 'rescue', keyword: 'disaster rescue emergency', limit: 3 },
    { category: 'civil_defense', keyword: 'civil defence emergency office', limit: 2 },
    { category: 'evacuation', keyword: 'evacuation assembly point', limit: 2 },
  ],
};

export function normalizeIncidentKind(category?: string, crisisType?: string): IncidentKind {
  const c = (category ?? '').toLowerCase().replace(/\s+/g, '_');
  const t = (crisisType ?? '').toLowerCase();

  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  if (CRISIS_TYPE_ALIASES[t]) return CRISIS_TYPE_ALIASES[t];

  if (c.includes('flood') || c.includes('barish') || c.includes('pani')) return 'flood';
  if (c.includes('tsunami') || c.includes('samandar')) return 'tsunami';
  if (c.includes('earth') || c.includes('zelzla')) return 'earthquake';
  if (c.includes('landslide')) return 'landslide';
  if (c.includes('rain') || c.includes('monsoon')) return 'rain_alert';
  if (c.includes('fire') || c.includes('aag')) return 'fire';
  if (c.includes('accident') || c.includes('crash')) return 'accident';

  return 'general';
}

export function getSearchQueriesForIncident(kind: IncidentKind): ResourceSearchQuery[] {
  const specific = PROFILE_SEARCH[kind] ?? PROFILE_SEARCH.general;
  const seen = new Set<string>();
  const merged: ResourceSearchQuery[] = [];

  for (const q of [...CORE_SEARCH, ...specific]) {
    const key = `${q.category}:${q.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(q);
  }
  return merged;
}

export function getIncidentLabel(kind: IncidentKind): string {
  const labels: Record<IncidentKind, string> = {
    flood: 'Flood',
    urban_flood: 'Urban flooding',
    tsunami: 'Tsunami',
    earthquake: 'Earthquake',
    landslide: 'Landslide',
    rain_alert: 'Rain / monsoon alert',
    fire: 'Fire',
    accident: 'Accident',
    storm: 'Storm / cyclone',
    general: 'Emergency',
  };
  return labels[kind];
}

export interface DispatchActionDef {
  id: string;
  label: string;
  icon: string;
  units: string[];
  tone: 'info' | 'ok' | 'warn' | 'danger';
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
      { id: 'hospital', label: 'Hospital Surge', icon: '🏥', units: ['hospital', 'ambulance'], tone: 'info' },
    ],
    landslide: [
      { id: 'rescue', label: 'Landslide Rescue', icon: '⛰', units: ['rescue', 'fire'], tone: 'danger' },
    ],
    rain_alert: [
      { id: 'alert', label: 'Rain Alert Response', icon: '🌧', units: ['rescue', 'shelter'], tone: 'warn' },
      { id: 'evacuate', label: 'Pre-emptive Evacuation', icon: '🚨', units: ['evacuation'], tone: 'danger' },
    ],
    fire: [
      { id: 'fire', label: 'Fire Brigade', icon: '🔥', units: ['fire', 'rescue'], tone: 'danger' },
    ],
    accident: [
      { id: 'medical', label: 'Trauma Response', icon: '🚑', units: ['ambulance', 'hospital'], tone: 'info' },
    ],
    storm: [
      { id: 'cyclone', label: 'Storm / Cyclone', icon: '🌀', units: ['shelter', 'evacuation', 'rescue'], tone: 'danger' },
    ],
  };

  const specific = byKind[kind] ?? [];
  const ids = new Set<string>();
  const out: DispatchActionDef[] = [];

  for (const a of [...specific, ...common]) {
    if (ids.has(a.id)) continue;
    ids.add(a.id);
    out.push(a);
  }
  return out;
}

export function unitToResourceCategory(unit: string): EmergencyResourceCategory {
  const u = unit.toLowerCase();
  if (u.includes('ambulance') || u.includes('medical') || u.includes('hospital')) return 'hospital';
  if (u.includes('fire') || u.includes('brigade')) return 'fire_station';
  if (u.includes('police') || u.includes('traffic') || u.includes('security')) return 'police';
  if (u.includes('shelter') || u.includes('relief') || u.includes('camp')) return 'shelter';
  if (u.includes('evac')) return 'evacuation';
  if (u.includes('coast') || u.includes('maritime')) return 'coast_guard';
  if (u.includes('civil') || u.includes('ndma')) return 'civil_defense';
  if (u.includes('pump') || u.includes('flood') || u.includes('rescue') || u.includes('search')) return 'rescue';
  return 'ambulance';
}
