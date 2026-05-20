export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface LiveNewsFeed {
  source: 'newsapi';
  query: string;
  articles: NewsArticle[];
  fetchedAt: string;
}

export async function fetchLiveNews(
  query = 'Karachi flood emergency Pakistan',
  pageSize = 8
): Promise<LiveNewsFeed | null> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return null;

  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', query);
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('language', 'en');
  url.searchParams.set('apiKey', key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn('[newsapi]', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = (await res.json()) as {
    articles?: Array<{
      title?: string;
      description?: string;
      source?: { name?: string };
      url?: string;
      publishedAt?: string;
    }>;
  };

  const articles: NewsArticle[] = (data.articles ?? [])
    .filter((a) => a.title)
    .map((a) => ({
      title: a.title!,
      description: a.description ?? '',
      source: a.source?.name ?? 'news',
      url: a.url ?? '',
      publishedAt: a.publishedAt ?? new Date().toISOString(),
    }));

  return {
    source: 'newsapi',
    query,
    articles,
    fetchedAt: new Date().toISOString(),
  };
}
