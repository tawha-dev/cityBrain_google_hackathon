export function getApiUrl() {
  const env = import.meta.env.VITE_API_URL;
  if (env) return env;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:4000';
}

export function getWsUrl() {
  const env = import.meta.env.VITE_WS_URL;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return 'ws://localhost:4000/ws';
}

export async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiUrl()}/api/v1${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function postApi<T>(path: string, body?: unknown, extraHeaders?: HeadersInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function postCitizenReport(
  body: {
    rawText: string;
    category: string;
    language?: string;
    location?: { lat: number; lng: number };
  },
  deviceId: string
) {
  return postApi<{
    reportId: string;
    crisisId: string;
    status: string;
    correlationId: string;
  }>('/citizen/reports', body, { 'X-Device-Id': deviceId });
}

export async function fetchCitizenReport(id: string, deviceId: string) {
  const res = await fetch(`${getApiUrl()}/api/v1/citizen/reports/${id}`, {
    headers: { 'X-Device-Id': deviceId },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ report: CitizenReport }>;
}

export interface CitizenReport {
  id: string;
  crisisId?: string;
  category?: string;
  rawText: string;
  areaLabel?: string;
  status: string;
  lat?: number;
  lng?: number;
  validationScore?: number | null;
  validation?: {
    total: number;
    geolocation: number;
    weather: number;
    news: number;
    social: number;
    agentConfidence: number;
  } | null;
  timeline?: Array<{ step: string; label: string; at?: string }>;
  escalation?: string | null;
}

export interface CrisisRow {
  id: string;
  title: string;
  type: string;
  status: string;
  escalation_level: string;
  area_label?: string;
  confidence?: number;
  citizen_origin?: boolean;
  validation_score?: number | null;
}

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
}

export interface DispatchUnitResult {
  unit: string;
  actionId: string;
  etaMinutes: number;
  facility?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  routeSource?: 'google_routes' | 'estimated';
  facilitySource?: 'google_places' | 'fallback' | 'manual_selection';
}

export interface DispatchResponse {
  status: string;
  crisisId: string;
  dispatchedAt?: string;
  units: DispatchUnitResult[];
}

export interface DispatchLogEntry {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  unit?: string;
  facility?: string;
  etaMinutes?: number;
  note?: string;
}

export interface DispatchTarget {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  category?: EmergencyResourceCategory;
}

export interface Dossier {
  crisis: Record<string, unknown>;
  citizenReport: {
    rawText: string;
    lat?: number;
    lng?: number;
    areaLabel?: string;
    validationScore?: number;
    category?: string;
  } | null;
  validation: {
    total: number;
    geolocation: number;
    weather: number;
    news: number;
    social: number;
    agentConfidence: number;
  } | null;
  social: { summary: string; socialScore: number } | null;
  nearbyResources: EmergencyResource[] | null;
  incidentKind?: string;
  incidentLabel?: string;
  timeline: Array<{ step: string; label: string }>;
  signalCount: number;
}
