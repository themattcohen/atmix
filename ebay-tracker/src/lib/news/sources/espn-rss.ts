import type { RawNewsItem } from '../../../types'
import { fetchRSSFeed, extractGuid, parsePubDate } from './rss-utils'

const SPORT_FEEDS = [
  'https://www.espn.com/espn/rss/mlb/news',
  'https://www.espn.com/espn/rss/nba/news',
  'https://www.espn.com/espn/rss/nfl/news',
  'https://www.espn.com/espn/rss/nhl/news',
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; EbayWatchlistMonitor/1.0)' }

export async function fetchESPNRSS(): Promise<RawNewsItem[]> {
  const seen = new Set<string>()
  const results: RawNewsItem[] = []

  for (let i = 0; i < SPORT_FEEDS.length; i++) {
    const url = SPORT_FEEDS[i]

    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
    }

    try {
      const items = await fetchRSSFeed(url, { headers: HEADERS })

      for (const item of items) {
        const titleKey = (item.title ?? '').toLowerCase().trim()
        if (!titleKey || seen.has(titleKey)) continue
        seen.add(titleKey)

        results.push({
          source: 'espn_rss',
          sourceId: extractGuid(item.guid),
          title: item.title ?? '',
          body: item.description ?? null,
          url: item.link ?? null,
          publishedAt: parsePubDate(item.pubDate),
        })
      }
    } catch (err) {
      console.error(`[ESPNRSS] Fetch failed for feed "${url}":`, err)
    }
  }

  return results
}
