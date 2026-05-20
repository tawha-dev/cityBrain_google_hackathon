import { fetchLiveNews } from './newsapi.js';
import { nearbyPlaces } from './google-maps.js';

export interface SocialVerification {
  socialScore: number;
  summary: string;
  articleCount: number;
  nearbyPoiCount: number;
  snippets: string[];
  source: 'live' | 'simulated';
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  flood: 'flood rain waterlogging',
  accident: 'accident collision crash traffic',
  fire: 'fire blaze smoke',
  other: 'emergency crisis incident',
};

export async function verifySocialSignals(
  areaLabel: string,
  category: string,
  lat?: number,
  lng?: number
): Promise<SocialVerification> {
  const keywords = CATEGORY_KEYWORDS[category] ?? CATEGORY_KEYWORDS.other;
  const query = `${areaLabel} ${keywords} Pakistan`;
  const snippets: string[] = [];
  let articleCount = 0;
  let nearbyPoiCount = 0;

  const news = await fetchLiveNews(query, 5);
  if (news?.articles.length) {
    articleCount = news.articles.length;
    for (const a of news.articles.slice(0, 3)) {
      snippets.push(`${a.title} (${a.source})`);
    }
  }

  if (lat != null && lng != null) {
    const places = await nearbyPlaces(lat, lng, 'hospital police fire station');
    nearbyPoiCount = places.length;
    for (const p of places.slice(0, 2)) {
      snippets.push(`Nearby: ${p.name}`);
    }
  }

  if (articleCount === 0 && nearbyPoiCount === 0) {
    return {
      socialScore: 0.35,
      summary: 'Limited public corroboration — citizen report prioritized for review.',
      articleCount: 0,
      nearbyPoiCount: 0,
      snippets: ['Awaiting additional media signals'],
      source: 'simulated',
    };
  }

  const newsPart = Math.min(0.6, articleCount * 0.15);
  const poiPart = Math.min(0.25, nearbyPoiCount * 0.08);
  const socialScore = Math.min(0.95, 0.2 + newsPart + poiPart);

  return {
    socialScore,
    summary:
      articleCount > 0
        ? `${articleCount} news mention(s) and ${nearbyPoiCount} emergency POI(s) near the report location.`
        : `${nearbyPoiCount} emergency services near the reported coordinates.`,
    articleCount,
    nearbyPoiCount,
    snippets,
    source: news ? 'live' : 'simulated',
  };
}
