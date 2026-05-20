export interface ValidationBreakdown {
  geolocation: number;
  weather: number;
  news: number;
  social: number;
  agentConfidence: number;
  total: number;
}

export function computeValidationScore(input: {
  geocoded: boolean;
  weatherCorroborates: boolean;
  newsHits: number;
  socialScore: number;
  agentConfidence?: number;
}): ValidationBreakdown {
  const geolocation = input.geocoded ? 30 : 0;
  const weather = input.weatherCorroborates ? 25 : 5;
  const news = input.newsHits >= 2 ? 25 : input.newsHits >= 1 ? 15 : 0;
  const social = Math.round(input.socialScore * 20);
  const agentConfidence = Math.round((input.agentConfidence ?? 0.5) * 20);
  const raw = geolocation + weather + news + social;
  const capped = Math.min(100, raw);
  const total = Math.min(100, Math.round((capped + agentConfidence) / 1.2));

  return { geolocation, weather, news, social, agentConfidence, total };
}

export function weatherCorroboratesCategory(
  condition: string,
  category: string,
  rainfallMm: number
): boolean {
  const c = condition.toLowerCase();
  if (
    category === 'flood' ||
    category === 'urban_flood' ||
    category === 'rain_alert' ||
    category === 'heavy_rain' ||
    category === 'rain_monsoon' ||
    category === 'tsunami' ||
    category === 'landslide' ||
    category === 'storm'
  ) {
    return c.includes('rain') || rainfallMm > 1 || c.includes('storm') || c.includes('cloud') || c.includes('drizzle');
  }
  if (category === 'earthquake') {
    return true;
  }
  if (category === 'accident' || category === 'other') {
    return true;
  }
  if (category === 'fire') {
    return c.includes('clear') || c.includes('dry') || c.includes('hot') || true;
  }
  return true;
}
