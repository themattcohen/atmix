import type { CardMetadata, MetadataRepo, ParsedTitle } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

function rowToMetadata(row: any): CardMetadata {
  return {
    itemId: row.item_id,
    playerName: row.player_name,
    year: row.year,
    brand: row.brand,
    setName: row.set_name,
    cardNumber: row.card_number,
    parallel: row.parallel,
    isRookie: row.is_rookie === 1,
    gradingCompany: row.grading_company,
    grade: row.grade_value,
    sport: row.sport,
    team: row.team,
    parsedAt: row.parsed_at,
    parseError: row.parse_error,
    titleHash: row.title_at_parse ?? '',
  }
}

export function getByItemId(itemId: string): CardMetadata | null {
  const db = getDb()
  try {
    const row = db.prepare('SELECT * FROM card_metadata WHERE item_id = ?').get(itemId)
    return row ? rowToMetadata(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get metadata for ${itemId}: ${err.message}`)
  }
}

export function getByItemIds(itemIds: string[]): CardMetadata[] {
  if (itemIds.length === 0) return []
  const db = getDb()
  try {
    const placeholders = itemIds.map(() => '?').join(', ')
    const rows = db.prepare(`SELECT * FROM card_metadata WHERE item_id IN (${placeholders})`).all(...itemIds)
    return (rows as any[]).map(rowToMetadata)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get metadata batch: ${err.message}`)
  }
}

export function upsertMetadata(itemId: string, title: string, parsed: ParsedTitle): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT OR REPLACE INTO card_metadata (
        item_id,
        player_name, year, brand, set_name, card_number, parallel,
        is_rookie,
        grading_company, grade_value,
        sport, team,
        parse_model, parse_confidence, parse_error,
        parsed_at, title_at_parse
      ) VALUES (
        ?,
        ?, ?, ?, ?, ?, ?,
        ?,
        ?, ?,
        ?, ?,
        'claude-haiku-4-5', NULL, NULL,
        datetime('now'), ?
      )
    `).run(
      itemId,
      parsed.playerName,
      parsed.year,
      parsed.brand,
      parsed.setName,
      parsed.cardNumber,
      parsed.parallel,
      parsed.isRookie ? 1 : 0,
      parsed.gradingCompany,
      parsed.grade,
      parsed.sport,
      parsed.team,
      title,
    )
  } catch (err: any) {
    throw new DatabaseError(`Failed to upsert metadata for ${itemId}: ${err.message}`)
  }
}

export function upsertError(itemId: string, title: string, errorMessage: string): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT INTO card_metadata (item_id, title_at_parse, parse_error, parsed_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(item_id) DO UPDATE SET
        parse_error = excluded.parse_error,
        parsed_at = excluded.parsed_at,
        title_at_parse = excluded.title_at_parse
    `).run(itemId, title, errorMessage)
  } catch (err: any) {
    throw new DatabaseError(`Failed to upsert error for ${itemId}: ${err.message}`)
  }
}

export function getUnparsed(limit = 100): string[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT i.item_id
      FROM items i
      LEFT JOIN card_metadata m ON i.item_id = m.item_id
      WHERE m.item_id IS NULL OR m.parse_error IS NOT NULL
      ORDER BY i.first_seen_at DESC
      LIMIT ?
    `).all(limit)
    return (rows as any[]).map(row => row.item_id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get unparsed items: ${err.message}`)
  }
}

export function getStale(limit = 100): string[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT i.item_id
      FROM items i
      JOIN card_metadata m ON i.item_id = m.item_id
      WHERE i.title != m.title_at_parse
      LIMIT ?
    `).all(limit)
    return (rows as any[]).map(row => row.item_id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get stale items: ${err.message}`)
  }
}

export function deleteMetadata(itemId: string): void {
  const db = getDb()
  try {
    db.prepare('DELETE FROM card_metadata WHERE item_id = ?').run(itemId)
  } catch (err: any) {
    throw new DatabaseError(`Failed to delete metadata for ${itemId}: ${err.message}`)
  }
}

export const metadataRepo: MetadataRepo = {
  getByItemId,
  upsert: (itemId: string, parsed: ParsedTitle, titleHash: string) => {
    upsertMetadata(itemId, titleHash, parsed)
  },
  getUnparsedItemIds: getUnparsed,
  getStaleItemIds: () => getStale(),
}
