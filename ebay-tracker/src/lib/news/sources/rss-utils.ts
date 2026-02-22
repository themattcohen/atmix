import { XMLParser } from 'fast-xml-parser'

export interface RSSItem {
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

export const RSS_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

export function extractGuid(guid: RSSItem['guid']): string | null {
  if (!guid) return null
  if (typeof guid === 'string') return guid
  return guid['#text'] ?? null
}

export function parsePubDate(pubDate: string | undefined): string | null {
  if (!pubDate) return null
  try {
    return new Date(pubDate).toISOString()
  } catch {
    return null
  }
}

export interface FetchRSSOptions {
  headers?: Record<string, string>
}

export async function fetchRSSFeed(url: string, options?: FetchRSSOptions): Promise<RSSItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: options?.headers,
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const xml = await res.text()
  const parsed: RSSRoot = RSS_PARSER.parse(xml)
  const rawItems = parsed?.rss?.channel?.item

  if (!rawItems) return []
  return Array.isArray(rawItems) ? rawItems : [rawItems]
}
