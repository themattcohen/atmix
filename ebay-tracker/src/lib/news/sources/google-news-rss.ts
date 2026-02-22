import { XMLParser } from 'fast-xml-parser'
import type { RawNewsItem } from '../../../types'

interface RSSItem {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  guid?: string | { '#text'?: string }
}

interface RSSRoot {
  rss?: {
    channel?: {
      item?: RSSItem | RSSItem[]
    }
  }
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

const QUERIES = ['MLB+baseball+player+news', 'MLB+trade+injury+callup']

function extractGuid(guid: RSSItem['guid']): string | null {
  if (!guid) return null
  if (typeof guid === 'string') return guid
  return guid['#text'] ?? null
}

async function fetchQuery(query: string): Promise<RSSItem[]> {
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const xml = await res.text()
  const parsed: RSSRoot = PARSER.parse(xml)
  const rawItems = parsed?.rss?.channel?.item

  if (!rawItems) return []
  return Array.isArray(rawItems) ? rawItems : [rawItems]
}

export async function fetchGoogleNewsRSS(): Promise<RawNewsItem[]> {
  const seen = new Set<string>()
  const results: RawNewsItem[] = []

  for (const query of QUERIES) {
    try {
      const items = await fetchQuery(query)

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
          source: 'google_news_rss',
          sourceId: extractGuid(item.guid),
          title: item.title ?? '',
          body: item.description ?? null,
          url: item.link ?? null,
          publishedAt,
        })
      }
    } catch (err) {
      console.error(`[GoogleNewsRSS] Fetch failed for query "${query}":`, err)
    }
  }

  return results
}
