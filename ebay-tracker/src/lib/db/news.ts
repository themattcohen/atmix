import crypto from 'crypto'
import type { NewsItem, RawNewsItem, SourceName, NewsRepo } from '../../types'
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

export const newsRepo: NewsRepo = {
  insertIfNew,
  markProcessed,
  insertMention,
  getRecent,
}
