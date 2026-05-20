import { TOOL_REGISTRY } from '@citybrain/agent-tools';
import type { CrisisRunState } from '@citybrain/shared';
import { fetchLiveWeather } from '../integrations/openweather.js';
import { fetchLiveNews } from '../integrations/newsapi.js';
import { reverseGeocode, computeRouteWithFallback } from '../integrations/google-maps.js';

const DEFAULT_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  karachi_flood: { lat: 24.8607, lng: 67.0011, label: 'Karachi' },
  g10_flood: { lat: 33.6844, lng: 73.0479, label: 'Islamabad G-10' },
  margalla_heat: { lat: 33.738, lng: 73.062, label: 'Margalla' },
  srinagar_accident: { lat: 33.653, lng: 73.08, label: 'Srinagar Hwy' },
  i9_grid: { lat: 33.648, lng: 73.042, label: 'I-9 Industrial' },
  faiz_road_block: { lat: 33.67, lng: 73.03, label: 'Faizabad' },
};

function coordsForState(state: CrisisRunState) {
  const key = state.scenarioKey ?? '';
  if (DEFAULT_COORDS[key]) return DEFAULT_COORDS[key];
  const c = state.candidate;
  if (c?.centroid) {
    return { lat: c.centroid.lat, lng: c.centroid.lng, label: c.areaLabel ?? 'Crisis zone' };
  }
  return DEFAULT_COORDS.karachi_flood;
}

/** Patch tool registry with live OpenWeather / NewsAPI when keys are set. */
export function registerLiveTools(): void {
  const origWeather = TOOL_REGISTRY.get_weather;
  TOOL_REGISTRY.get_weather = async (args, state, ctx) => {
    const { lat, lng, label } = coordsForState(state);
    const live = await fetchLiveWeather(
      Number(args.lat ?? lat),
      Number(args.lng ?? lng),
      String(args.areaLabel ?? label)
    );
    if (live) {
      await ctx.logExecution({
        tool: 'get_weather',
        request: { lat: live.lat, lon: live.lon },
        response: live,
        stateDelta: { weather: live.condition },
      });
      return {
        condition: live.condition,
        description: live.description,
        rainfallMm: live.rainfallMm,
        temperatureC: live.temperatureC,
        humidity: live.humidity,
        windSpeedMs: live.windSpeedMs,
        source: live.source,
        live: true,
      };
    }
    return origWeather(args, state, ctx);
  };

  TOOL_REGISTRY.get_news = async (args, state, ctx) => {
    const area = String(args.query ?? state.candidate?.areaLabel ?? 'Karachi Pakistan emergency');
    const query = `${area} flood OR accident OR weather OR crisis`;
    const feed = await fetchLiveNews(query, Number(args.limit ?? 6));
    if (feed) {
      await ctx.logExecution({
        tool: 'get_news',
        request: { query },
        response: { count: feed.articles.length },
        stateDelta: { newsCount: feed.articles.length },
      });
      return {
        query: feed.query,
        articles: feed.articles,
        headlineCount: feed.articles.length,
        source: 'newsapi',
        live: true,
      };
    }
    return {
      query,
      articles: [],
      headlineCount: 0,
      source: 'simulated',
      live: false,
    };
  };

  const origGeocode = TOOL_REGISTRY.geocode;
  TOOL_REGISTRY.geocode = async (args, state, ctx) => {
    const lat = Number(args.lat ?? state.candidate?.centroid?.lat ?? 24.8607);
    const lng = Number(args.lng ?? state.candidate?.centroid?.lng ?? 67.0011);
    const live = await reverseGeocode(lat, lng);
    if (live) {
      await ctx.logExecution({
        tool: 'geocode',
        request: { lat, lng },
        response: live,
        stateDelta: { areaLabel: live.areaLabel },
      });
      return {
        lat: live.lat,
        lng: live.lng,
        areaLabel: live.areaLabel,
        formattedAddress: live.formattedAddress,
        source: 'google',
        live: true,
      };
    }
    return origGeocode(args, state, ctx);
  };

  const origRoutes = TOOL_REGISTRY.google_routes;
  TOOL_REGISTRY.google_routes = async (args, state, ctx) => {
    const { lat, lng } = coordsForState(state);
    const destLat = Number(args.destLat ?? lat + 0.03);
    const destLng = Number(args.destLng ?? lng + 0.03);
    const live = await computeRouteWithFallback({ lat, lng }, { lat: destLat, lng: destLng });
    if (live) {
      await ctx.logExecution({
        tool: 'google_routes',
        request: { origin: { lat, lng }, destination: { lat: destLat, lng: destLng } },
        response: live,
        stateDelta: { route: live.alternateRoute },
      });
      return {
        alternateRoute: live.alternateRoute,
        etaDeltaMinutes: Math.round(-live.durationSeconds / 60),
        congestionDelta: -0.28,
        distanceMeters: live.distanceMeters,
        durationSeconds: live.durationSeconds,
        polyline: live.polyline,
        source: 'google',
        live: true,
      };
    }
    return origRoutes(args, state, ctx);
  };
}
