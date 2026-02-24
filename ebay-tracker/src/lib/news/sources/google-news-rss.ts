import type { RawNewsItem } from '../../../types'
import { fetchRSSFeed, extractGuid, parsePubDate } from './rss-utils'
import { inferSportFromUrl } from '../matching/name-utils'

const QUERIES = [
  'MLB+baseball+player+news', 'MLB+trade+injury+callup',
  'NBA+basketball+player+trade+injury', 'NBA+draft+signing',
  'NFL+football+player+trade+injury', 'NFL+draft+signing',
  'NHL+hockey+player+trade+injury',
]

export async function fetchGoogleNewsRSS(): Promise<RawNewsItem[]> {
  const seen = new Set<string>()
  const results: RawNewsItem[] = []

  for (const query of QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
      const items = await fetchRSSFeed(url)

      for (const item of items) {
        const titleKey = (item.title ?? '').toLowerCase().trim()
        if (!titleKey || seen.has(titleKey)) continue
        seen.add(titleKey)

        results.push({
          source: 'google_news_rss',
          sourceId: extractGuid(item.guid),
          title: item.title ?? '',
          body: item.description ?? null,
          url: item.link ?? null,
          publishedAt: parsePubDate(item.pubDate),
          sport: inferSportFromUrl(query),
        })
      }
    } catch (err) {
      console.error(`[GoogleNewsRSS] Fetch failed for query "${query}":`, err)
    }
  }

  return results
}
