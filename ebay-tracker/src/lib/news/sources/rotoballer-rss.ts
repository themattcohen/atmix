import type { RawNewsItem } from '../../../types'
import { fetchRSSFeed, extractGuid, parsePubDate } from './rss-utils'

const SPORT_FEEDS = [
  'https://www.rotoballer.com/category/mlb/feed',
  'https://www.rotoballer.com/category/nba/feed',
  'https://www.rotoballer.com/category/nfl/feed',
  'https://www.rotoballer.com/category/nhl/feed',
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; EbayWatchlistMonitor/1.0)' }

export async function fetchRotoBaller(): Promise<RawNewsItem[]> {
  const seen = new Set<string>()
  const results: RawNewsItem[] = []

  for (let i = 0; i < SPORT_FEEDS.length; i++) {
    const url = SPORT_FEEDS[i]

    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
    }

    try {
      const items = await fetchRSSFeed(url, { headers: HEADERS })

      if (items.length === 0) {
        console.warn(`[RotoBaller] Feed returned 0 items: ${url}`)
      }

      for (const item of items) {
        const titleKey = (item.title ?? '').toLowerCase().trim()
        if (!titleKey || seen.has(titleKey)) continue
        seen.add(titleKey)

        results.push({
          source: 'rotoballer_rss',
          sourceId: extractGuid(item.guid),
          title: item.title ?? '',
          body: item.description ?? null,
          url: item.link ?? null,
          publishedAt: parsePubDate(item.pubDate),
        })
      }
    } catch (err) {
      console.error(`[RotoBaller] Fetch failed for feed "${url}":`, err)
    }
  }

  return results
}
