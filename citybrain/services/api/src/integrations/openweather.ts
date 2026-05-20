export interface LiveWeather {
  source: 'openweather';
  condition: string;
  description: string;
  rainfallMm: number;
  temperatureC: number;
  humidity: number;
  windSpeedMs: number;
  lat: number;
  lon: number;
  areaLabel?: string;
  fetchedAt: string;
}

export async function fetchLiveWeather(
  lat: number,
  lon: number,
  areaLabel?: string
): Promise<LiveWeather | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('appid', key);
  url.searchParams.set('units', 'metric');

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn('[openweather]', res.status);
    return null;
  }

  const data = (await res.json()) as {
    weather?: Array<{ main?: string; description?: string }>;
    main?: { temp?: number; humidity?: number };
    rain?: { '1h'?: number };
    wind?: { speed?: number };
    name?: string;
  };

  const main = data.weather?.[0]?.main?.toLowerCase() ?? 'unknown';
  const rainfall = data.rain?.['1h'] ?? 0;

  return {
    source: 'openweather',
    condition: mapCondition(main, rainfall),
    description: data.weather?.[0]?.description ?? main,
    rainfallMm: rainfall,
    temperatureC: Math.round(data.main?.temp ?? 0),
    humidity: data.main?.humidity ?? 0,
    windSpeedMs: data.wind?.speed ?? 0,
    lat,
    lon,
    areaLabel: areaLabel ?? data.name,
    fetchedAt: new Date().toISOString(),
  };
}

function mapCondition(main: string, rainfallMm: number): string {
  if (rainfallMm > 5 || main.includes('rain') || main.includes('drizzle')) return 'heavy_rain';
  if (main.includes('thunder')) return 'storm';
  if (main.includes('snow')) return 'snow';
  if (main.includes('clear')) return 'clear';
  if (main.includes('cloud')) return 'cloudy';
  if (main.includes('mist') || main.includes('fog')) return 'low_visibility';
  return main;
}
