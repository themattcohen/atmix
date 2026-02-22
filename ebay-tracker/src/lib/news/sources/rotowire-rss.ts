import { XMLParser } from 'fast-xml-parser'
import type { RawNewsItem } from '../../../types'

interface RSSItem {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  guid?: string | { '#text'?: string }
}

interface RSSChannel {
  item?: RSSItem | RSSItem[]
}

interface RSSRoot {
  rss?: {
    channel?: RSSChannel
  }
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

const SPORT_FEEDS = [
  'https://www.rotowire.com/rss/news.htm?sport=mlb',
  'https://www.rotowire.com/rss/news.htm?sport=nba',
  'https://www.rotowire.com/rss/news.htm?sport=nfl',
  'https://www.rotowire.com/rss/news.htm?sport=nhl',
]

function extractGuid(guid: RSSItem['guid']): string | null {
  if (!guid) return null
  if (typeof guid === 'string') return guid
  return guid['#text'] ?? null
}

async function fetchFeed(url: string): Promise<RSSItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EbayWatchlistMonitor/1.0)' },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const xml = await res.text()
  const parsed: RSSRoot = PARSER.parse(xml)
  const rawItems = parsed?.rss?.channel?.item

  if (!rawItems) return []
  return Array.isArray(rawItems) ? rawItems : [rawItems]
}

export async function fetchRotoWireRSS(): Promise<RawNewsItem[]> {
  const seen = new Set<string>()
  const results: RawNewsItem[] = []

  for (let i = 0; i < SPORT_FEEDS.length; i++) {
    const url = SPORT_FEEDS[i]

    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
    }

    try {
      const items = await fetchFeed(url)

      for (const item of items) {
        const titleKey = (item.title ?? '').toLowerCase().trim()
        if (!titleKey || seen.has(titleKey)) continue
        seen.add(titleKey)

        let publishedAt: string | null = null
        if (item.pubDate) {
          try {
            publishedAt = new Date(item.pubDate).toISOString()
          } catch {
            publishedAt = null
          }
        }

        results.push({
          source: 'rotowire_rss',
          sourceId: extractGuid(item.guid),
          title: item.title ?? '',
          body: item.description ?? null,
          url: item.link ?? null,
          publishedAt,
        })
      }
    } catch (err) {
      console.error(`[RotoWireRSS] Fetch failed for feed "${url}":`, err)
    }
  }

  return results
}
