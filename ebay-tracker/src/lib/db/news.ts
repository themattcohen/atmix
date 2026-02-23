import crypto from 'crypto'
import type {
  NewsItem, RawNewsItem, SourceName, NewsRepo,
  NewsDetailParams, NewsDetailPage, NewsItemDetail,
  NewsProcessedStatus, NewsExtractionMethod,
  NewsItemMention, NewsItemSignalDetail,
} from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function insertIfNew(item: RawNewsItem): { id: number; isNew: boolean } {
  const db = getDb()
  try {
    const contentHash = crypto
      .createHash('sha256')
      .update(item.title + (item.body || ''))
      .digest('hex')

    const result = db.prepare(`
      INSERT OR IGNORE INTO news_items
        (source, source_id, content_hash, title, body, url, published_at, fetched_at, processed)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)
    `).run(
      item.source,
      item.sourceId,
      contentHash,
      item.title,
      item.body,
      item.url,
      item.publishedAt,
    )

    const isNew = result.changes > 0

    let id: number
    if (isNew) {
      id = result.lastInsertRowid as number
    } else {
      const existing = db.prepare(`
        SELECT id FROM news_items WHERE content_hash = ?
      `).get(contentHash) as any
      id = existing.id as number
    }

    return { id, isNew }
  } catch (err: any) {
    throw new DatabaseError(`Failed to insert news item: ${err.message}`)
  }
}

export function markProcessed(id: number, status: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE news_items SET processed = ? WHERE id = ?
    `).run(status, id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to mark news item processed: ${err.message}`)
  }
}

export function updateEventClassification(
  newsItemId: number,
  eventType: string,
  score: number,
  keyword: string,
  method?: 'keyword' | 'ai',
): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE news_items SET event_type = ?, event_score = ?, matched_keyword = ?, classification_method = ? WHERE id = ?
    `).run(eventType, score, keyword, method ?? null, newsItemId)
  } catch (err: any) {
    throw new DatabaseError(`Failed to update event classification: ${err.message}`)
  }
}

export function insertMention(newsItemId: number, playerId: number, confidence: number): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT OR IGNORE INTO news_player_mentions (news_item_id, player_id, confidence)
      VALUES (?, ?, ?)
    `).run(newsItemId, playerId, confidence)
  } catch (err: any) {
    throw new DatabaseError(`Failed to insert player mention: ${err.message}`)
  }
}

export function getRecent(limit: number, source?: SourceName): NewsItem[] {
  const db = getDb()
  try {
    let rows: any[]
    if (source !== undefined) {
      rows = db.prepare(`
        SELECT * FROM news_items
        WHERE source = ?
        ORDER BY fetched_at DESC
        LIMIT ?
      `).all(source, limit) as any[]
    } else {
      rows = db.prepare(`
        SELECT * FROM news_items
        ORDER BY fetched_at DESC
        LIMIT ?
      `).all(limit) as any[]
    }

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get recent news items: ${err.message}`)
  }
}

function mapRow(row: any): NewsItem {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    contentHash: row.content_hash,
    title: row.title,
    body: row.body,
    url: row.url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    processed: row.processed,
  }
}

// === Status / extraction method mapping ===

const STATUS_MAP: Record<number, NewsProcessedStatus> = {
  0: 'pending',
  1: 'matched',
  2: 'no_match',
  4: 'ai_fallback',
}

const EXTRACTION_MAP: Record<number, NewsExtractionMethod> = {
  0: 'none',
  1: 'regex',
  2: 'none',
  4: 'ai',
}

const STATUS_TO_INT: Record<NewsProcessedStatus, number> = {
  pending: 0,
  matched: 1,
  no_match: 2,
  ai_fallback: 4,
}

function toProcessedStatus(val: number): NewsProcessedStatus {
  return STATUS_MAP[val] ?? 'pending'
}

function toExtractionMethod(val: number): NewsExtractionMethod {
  return EXTRACTION_MAP[val] ?? 'none'
}

function parseMentions(raw: string | null): NewsItemMention[] {
  if (!raw) return []
  return raw.split(';;').filter(Boolean).map((entry) => {
    const [id, name, conf] = entry.split('|')
    return { playerId: parseInt(id, 10), playerName: name, confidence: parseFloat(conf) }
  })
}

function parseSignals(raw: string | null): NewsItemSignalDetail[] {
  if (!raw) return []
  return raw.split(';;').filter(Boolean).map((entry) => {
    const parts = entry.split('|')
    return {
      eventType: parts[0] as NewsItemSignalDetail['eventType'],
      score: parseFloat(parts[1] || '0'),
      confidence: parseFloat(parts[2] || '0'),
      matchedKeyword: parts[3] || null,
      itemId: parts[4] || '',
      expiresAt: parts[5] || null,
      acknowledged: parts[6] === '1',
      createdAt: parts[7] || '',
    }
  })
}

function getOrderClause(sortBy?: string, sortDir?: string): string {
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC'
  switch (sortBy) {
    case 'source':
      return `ni.source ${dir}, ni.id DESC`
    case 'status':
      return `ni.processed ${dir}, ni.id DESC`
    case 'mentions':
      return `(SELECT COUNT(*) FROM news_player_mentions npm3 WHERE npm3.news_item_id = ni.id) ${dir}, ni.id DESC`
    case 'signals':
      return `(SELECT COUNT(*) FROM card_signals cs2 WHERE cs2.news_item_id = ni.id) ${dir}, ni.id DESC`
    case 'fetched_at':
    default:
      return `ni.fetched_at ${dir}, ni.id DESC`
  }
}

export function getDetailed(params: NewsDetailParams): NewsDetailPage {
  const db = getDb()
  try {
    const conditions: string[] = []
    const bindings: any[] = []

    if (params.source !== undefined) {
      conditions.push('ni.source = ?')
      bindings.push(params.source)
    }

    if (params.status !== undefined) {
      conditions.push('ni.processed = ?')
      bindings.push(STATUS_TO_INT[params.status])
    }

    if (params.playerSearch) {
      conditions.push(`ni.id IN (SELECT npm2.news_item_id FROM news_player_mentions npm2 JOIN player_roster pr2 ON pr2.id = npm2.player_id WHERE LOWER(pr2.full_name) LIKE ?)`)
      bindings.push(`%${params.playerSearch.toLowerCase()}%`)
    }

    if (params.itemId !== undefined) {
      conditions.push(`ni.id IN (SELECT cs.news_item_id FROM card_signals cs WHERE cs.item_id = ?)`)
      bindings.push(params.itemId)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countRow = db.prepare(`
      SELECT COUNT(*) AS cnt FROM news_items ni ${where}
    `).get(...bindings) as any
    const total: number = countRow.cnt

    // Main query with aggregation
    const limit = params.limit ?? 50
    const offset = params.offset ?? 0

    const mainBindings = [...bindings, limit, offset]

    const rows = db.prepare(`
      SELECT
        ni.id, ni.source, ni.title, ni.body, ni.url,
        ni.published_at, ni.fetched_at, ni.processed,
        ni.event_type, ni.event_score, ni.matched_keyword, ni.classification_method,
        (SELECT GROUP_CONCAT(CAST(pr.id AS TEXT) || '|' || pr.full_name || '|'
          || CAST(ROUND(npm.confidence, 4) AS TEXT), ';;')
         FROM news_player_mentions npm
         JOIN player_roster pr ON pr.id = npm.player_id
         WHERE npm.news_item_id = ni.id) AS mentions_raw,
        (SELECT GROUP_CONCAT(
          cs.event_type || '|' || CAST(cs.score AS TEXT) || '|'
          || CAST(cs.confidence AS TEXT) || '|' || COALESCE(cs.matched_keyword, '')
          || '|' || cs.item_id || '|' || COALESCE(cs.expires_at, '')
          || '|' || CAST(cs.acknowledged AS TEXT) || '|' || cs.created_at
        , ';;')
         FROM card_signals cs
         WHERE cs.news_item_id = ni.id) AS signals_raw
      FROM news_items ni
      ${where}
      ORDER BY ${getOrderClause(params.sortBy, params.sortDir)}
      LIMIT ? OFFSET ?
    `).all(...mainBindings) as any[]

    const items: NewsItemDetail[] = rows.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      body: row.body,
      url: row.url,
      publishedAt: row.published_at,
      fetchedAt: row.fetched_at,
      processedStatus: toProcessedStatus(row.processed),
      extractionMethod: toExtractionMethod(row.processed),
      eventType: row.event_type ?? null,
      eventScore: row.event_score ?? null,
      matchedKeyword: row.matched_keyword ?? null,
      classificationMethod: row.classification_method ?? null,
      mentions: parseMentions(row.mentions_raw),
      signals: parseSignals(row.signals_raw),
    }))

    return { items, total }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get detailed news items: ${err.message}`)
  }
}

export const newsRepo: NewsRepo = {
  insertIfNew,
  markProcessed,
  insertMention,
  updateEventClassification,
  getRecent,
  getDetailed,
}
