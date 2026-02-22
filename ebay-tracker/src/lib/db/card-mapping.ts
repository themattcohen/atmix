import type { CardPlayerMapping, CardMappingRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function upsert(mapping: Omit<CardPlayerMapping, 'mappedAt'>): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT OR REPLACE INTO card_player_mapping
        (item_id, player_id, player_name, confidence, mapped_at)
      VALUES
        (?, ?, ?, ?, datetime('now'))
    `).run(mapping.itemId, mapping.playerId, mapping.playerName, mapping.confidence)
  } catch (err: any) {
    throw new DatabaseError(`Failed to upsert card mapping: ${err.message}`)
  }
}

export function getByItemId(itemId: string): CardPlayerMapping | null {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT * FROM card_player_mapping WHERE item_id = ?
    `).get(itemId) as any | undefined

    return row ? mapRow(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get mapping by item id: ${err.message}`)
  }
}

export function getByPlayerId(playerId: number): CardPlayerMapping[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT * FROM card_player_mapping WHERE player_id = ?
      ORDER BY mapped_at DESC
    `).all(playerId) as any[]

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get mappings by player id: ${err.message}`)
  }
}

export function getUnmapped(): { id: string; title: string }[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT i.item_id AS id, i.title
      FROM items i
      LEFT JOIN card_player_mapping m ON m.item_id = i.item_id
      WHERE m.item_id IS NULL
        AND i.status = 'Active'
      ORDER BY i.item_id ASC
    `).all() as any[]

    return rows.map(row => ({ id: row.id, title: row.title }))
  } catch (err: any) {
    throw new DatabaseError(`Failed to get unmapped items: ${err.message}`)
  }
}

function mapRow(row: any): CardPlayerMapping {
  return {
    itemId: row.item_id,
    playerId: row.player_id,
    playerName: row.player_name,
    confidence: row.confidence,
    mappedAt: row.mapped_at,
  }
}

export const cardMappingRepo: CardMappingRepo = {
  upsert,
  getByItemId,
  getByPlayerId,
  getUnmapped,
}
