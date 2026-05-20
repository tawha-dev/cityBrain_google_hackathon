const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export function getApiUrl(): string {
  return API_URL;
}

export function getWsUrl(): string {
  return process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws';
}

export async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function postApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<{
  status: string;
  service?: string;
  integrations?: IntegrationsStatus;
}> {
  return fetchApi<{ status: string; service?: string; integrations?: IntegrationsStatus }>('/health');
}

export interface IngestSignalPayload {
  source: string;
  rawText: string;
  areaLabel?: string;
  language?: string;
  location?: { lat: number; lng: number };
  confidence?: number;
}

export async function ingestSignal(signal: IngestSignalPayload) {
  return postApi<{ ingested: number; ids: string[] }>('/signals/ingest', signal);
}

export interface IntegrationsStatus {
  gemini: boolean;
  openrouter: boolean;
  provider: string;
  geminiModel: string;
  openRouterModel: string;
  openweather: boolean;
  news: boolean;
}

export async function fetchIntegrationsStatus() {
  return fetchApi<IntegrationsStatus>('/live/status');
}

export async function fetchLiveWeather(lat = 24.8607, lon = 67.0011, area?: string) {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  if (area) q.set('area', area);
  return fetchApi<{ weather: Record<string, unknown> }>(`/live/weather?${q}`);
}

export async function fetchLiveNews(query = 'Karachi Pakistan flood emergency') {
  const q = new URLSearchParams({ q: query, limit: '6' });
  return fetchApi<{ articles: Array<{ title: string; description: string; source: string }> }>(
    `/live/news?${q}`
  );
}

export async function syncLiveFeeds(body?: {
  lat?: number;
  lon?: number;
  query?: string;
  areaLabel?: string;
}) {
  return postApi<{ ingested: number; ids: string[]; newsCount: number }>('/live/sync', body);
}
