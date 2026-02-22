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

function extractGuid(guid: RSSItem['guid']): string | null {
  if (!guid) return null
  if (typeof guid === 'string') return guid
  return guid['#text'] ?? null
}

export async function fetchRotoWireRSS(): Promise<RawNewsItem[]> {
  const url = 'https://www.rotowire.com/rss/news.htm'

  try {
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

    const items: RSSItem[] = Array.isArray(rawItems) ? rawItems : [rawItems]

    return items.map((item): RawNewsItem => {
      let publishedAt: string | null = null
      if (item.pubDate) {
        try {
          publishedAt = new Date(item.pubDate).toISOString()
        } catch {
          publishedAt = null
        }
      }

      return {
        source: 'rotowire_rss',
        sourceId: extractGuid(item.guid),
        title: item.title ?? '',
        body: item.description ?? null,
        url: item.link ?? null,
        publishedAt,
      }
    })
  } catch (err) {
    console.error('[RotoWireRSS] Fetch failed:', err)
    return []
  }
}
