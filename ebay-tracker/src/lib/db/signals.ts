import type { CardSignal, NewsEventType, SignalsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function insert(signal: Omit<CardSignal, 'id' | 'createdAt' | 'acknowledged'>): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT OR IGNORE INTO card_signals
        (news_item_id, item_id, player_id, event_type, score, confidence, headline, source, source_url, expires_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      signal.newsItemId,
      signal.itemId,
      signal.playerId,
      signal.eventType,
      signal.score,
      signal.confidence,
      signal.headline,
      signal.source,
      signal.sourceUrl,
      signal.expiresAt,
    )
  } catch (err: any) {
    throw new DatabaseError(`Failed to insert signal: ${err.message}`)
  }
}

export function getRecent(params: {
  limit: number
  offset?: number
  itemId?: string
  eventType?: NewsEventType
  minScore?: number
  acknowledged?: boolean
}): CardSignal[] {
  const db = getDb()
  try {
    const conditions: string[] = []
    const bindings: any[] = []

    if (params.itemId !== undefined) {
      conditions.push('item_id = ?')
      bindings.push(params.itemId)
    }

    if (params.eventType !== undefined) {
      conditions.push('event_type = ?')
      bindings.push(params.eventType)
    }

    if (params.minScore !== undefined) {
      conditions.push('score >= ?')
      bindings.push(params.minScore)
    }

    if (params.acknowledged === false) {
      conditions.push('acknowledged = 0')
    } else if (params.acknowledged === true) {
      conditions.push('acknowledged = 1')
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    bindings.push(params.limit)
    bindings.push(params.offset ?? 0)

    const rows = db.prepare(`
      SELECT * FROM card_signals
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...bindings) as any[]

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get recent signals: ${err.message}`)
  }
}

export function acknowledge(id: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE card_signals SET acknowledged = 1 WHERE id = ?
    `).run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to acknowledge signal: ${err.message}`)
  }
}

export function countToday(): number {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM card_signals
      WHERE created_at >= date('now')
    `).get() as any
    return row.cnt as number
  } catch (err: any) {
    throw new DatabaseError(`Failed to count today's signals: ${err.message}`)
  }
}

export function countUnacknowledged(): number {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM card_signals WHERE acknowledged = 0
    `).get() as any
    return row.cnt as number
  } catch (err: any) {
    throw new DatabaseError(`Failed to count unacknowledged signals: ${err.message}`)
  }
}

export function deleteExpired(): number {
  const db = getDb()
  try {
    const result = db.prepare(`
      DELETE FROM card_signals
      WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
    `).run()
    return result.changes
  } catch (err: any) {
    throw new DatabaseError(`Failed to delete expired signals: ${err.message}`)
  }
}

function mapRow(row: any): CardSignal {
  return {
    id: row.id,
    newsItemId: row.news_item_id,
    itemId: row.item_id,
    playerId: row.player_id,
    eventType: row.event_type,
    score: row.score,
    confidence: row.confidence,
    headline: row.headline,
    source: row.source,
    sourceUrl: row.source_url,
    acknowledged: row.acknowledged === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export const signalsRepo: SignalsRepo = {
  insert,
  getRecent,
  acknowledge,
  countToday,
  countUnacknowledged,
  deleteExpired,
}
