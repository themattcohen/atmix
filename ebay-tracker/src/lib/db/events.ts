import type { WatchlistEvent, EventType, EventsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function insert(input: { itemId: string; eventType: EventType; oldValue?: string; newValue?: string }): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT INTO events (item_id, event_type, old_value, new_value)
      VALUES (?, ?, ?, ?)
    `).run(input.itemId, input.eventType, input.oldValue ?? null, input.newValue ?? null)
  } catch (err: any) {
    throw new DatabaseError(`Failed to insert event: ${err.message}`)
  }
}

export function getRecent(limit: number, type?: EventType): WatchlistEvent[] {
  const db = getDb()
  try {
    let sql: string
    let params: any[]

    if (type) {
      sql = `
        SELECT e.*, i.title AS item_title
        FROM events e
        LEFT JOIN items i ON e.item_id = i.item_id
        WHERE e.event_type = ?
        ORDER BY e.detected_at DESC
        LIMIT ?
      `
      params = [type, limit]
    } else {
      sql = `
        SELECT e.*, i.title AS item_title
        FROM events e
        LEFT JOIN items i ON e.item_id = i.item_id
        ORDER BY e.detected_at DESC
        LIMIT ?
      `
      params = [limit]
    }

    const rows = db.prepare(sql).all(...params)
    return (rows as any[]).map(row => ({
      id: row.id,
      itemId: row.item_id,
      itemTitle: row.item_title ?? undefined,
      eventType: row.event_type,
      oldValue: row.old_value,
      newValue: row.new_value,
      detectedAt: row.detected_at,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get recent events: ${err.message}`)
  }
}

export function getForItem(itemId: string, limit: number): WatchlistEvent[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT e.*, i.title AS item_title
      FROM events e
      LEFT JOIN items i ON e.item_id = i.item_id
      WHERE e.item_id = ?
      ORDER BY e.detected_at DESC
      LIMIT ?
    `).all(itemId, limit)

    return (rows as any[]).map(row => ({
      id: row.id,
      itemId: row.item_id,
      itemTitle: row.item_title ?? undefined,
      eventType: row.event_type,
      oldValue: row.old_value,
      newValue: row.new_value,
      detectedAt: row.detected_at,
    }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get events for item ${itemId}: ${err.message}`)
  }
}

export const eventsRepo: EventsRepo = {
  insert,
  getRecent,
  getForItem,
}
