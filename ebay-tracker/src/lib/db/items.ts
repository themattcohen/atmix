import type { WatchlistItem, ListingStatus, UpsertItemInput, ItemsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export interface UnrankedPage {
  items: WatchlistItem[]
  total: number
}

function rowToItem(row: any): WatchlistItem {
  return {
    id: row.item_id,
    title: row.title,
    rank: row.rank,
    currentPrice: row.current_price,
    buyItNowPrice: row.buy_it_now_price,
    shippingCost: row.shipping_cost,
    listingType: row.listing_type,
    conditionName: row.condition_name,
    endTime: row.end_time,
    timeLeft: row.time_left,
    sellerId: row.seller_id,
    sellerFeedback: row.seller_feedback,
    watcherCount: row.watcher_count,
    bidCount: row.bid_count,
    imageUrl: row.image_url,
    listingUrl: row.listing_url,
    status: row.status,
    isInQueue: row.is_in_queue === 1,
    notes: row.notes,
    firstSeenAt: row.first_seen_at,
    lastSyncedAt: row.last_synced_at,
  }
}

export function getAll(filters?: { status?: ListingStatus; search?: string; type?: string }): WatchlistItem[] {
  const db = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters?.search) {
    conditions.push('title LIKE ?')
    params.push(`%${filters.search}%`)
  }
  if (filters?.type) {
    conditions.push('listing_type = ?')
    params.push(filters.type)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Ranked items first (sorted by rank ASC), then unranked (sorted by end_time ASC)
  const sql = `
    SELECT * FROM items ${where}
    ORDER BY
      CASE WHEN rank IS NOT NULL THEN 0 ELSE 1 END,
      rank ASC,
      end_time ASC
  `

  try {
    const rows = db.prepare(sql).all(...params)
    return rows.map(rowToItem)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get items: ${err.message}`)
  }
}

export function getById(id: string): WatchlistItem | null {
  const db = getDb()
  try {
    const row = db.prepare('SELECT * FROM items WHERE item_id = ?').get(id)
    return row ? rowToItem(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get item ${id}: ${err.message}`)
  }
}

export function upsert(item: UpsertItemInput): void {
  const db = getDb()
  try {
    db.prepare(`
      INSERT INTO items (
        item_id, title, current_price, buy_it_now_price, shipping_cost,
        listing_type, condition_name, end_time, time_left,
        seller_id, seller_feedback, watcher_count, bid_count,
        image_url, listing_url, status, last_synced_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, datetime('now')
      )
      ON CONFLICT(item_id) DO UPDATE SET
        title = excluded.title,
        current_price = excluded.current_price,
        buy_it_now_price = excluded.buy_it_now_price,
        shipping_cost = excluded.shipping_cost,
        listing_type = excluded.listing_type,
        condition_name = excluded.condition_name,
        end_time = excluded.end_time,
        time_left = excluded.time_left,
        seller_id = excluded.seller_id,
        seller_feedback = excluded.seller_feedback,
        watcher_count = excluded.watcher_count,
        bid_count = excluded.bid_count,
        image_url = excluded.image_url,
        listing_url = excluded.listing_url,
        status = excluded.status,
        last_synced_at = datetime('now')
    `).run(
      item.id,
      item.title,
      item.currentPrice,
      item.buyItNowPrice ?? null,
      item.shippingCost ?? 0,
      item.listingType,
      item.conditionName ?? null,
      item.endTime ?? null,
      item.timeLeft ?? null,
      item.sellerId ?? null,
      item.sellerFeedback ?? null,
      item.watcherCount ?? null,
      item.bidCount ?? 0,
      item.imageUrl ?? null,
      item.listingUrl ?? null,
      item.status,
    )
  } catch (err: any) {
    throw new DatabaseError(`Failed to upsert item ${item.id}: ${err.message}`)
  }
}

export function updateRank(id: string, newRank: number): WatchlistItem[] {
  const db = getDb()
  try {
    const affected = db.transaction(() => {
      const row = db.prepare('SELECT rank FROM items WHERE item_id = ?').get(id) as any
      if (!row) throw new DatabaseError(`Item ${id} not found`)

      const oldRank: number | null = row.rank

      if (oldRank === null) {
        // Inserting unranked item into ranked list
        db.prepare('UPDATE items SET rank = rank + 1 WHERE rank >= ? AND rank IS NOT NULL').run(newRank)
        db.prepare('UPDATE items SET rank = ? WHERE item_id = ?').run(newRank, id)
      } else if (newRank < oldRank) {
        // Moving up (e.g., rank 5 → rank 2)
        db.prepare('UPDATE items SET rank = rank + 1 WHERE rank >= ? AND rank < ?').run(newRank, oldRank)
        db.prepare('UPDATE items SET rank = ? WHERE item_id = ?').run(newRank, id)
      } else if (newRank > oldRank) {
        // Moving down (e.g., rank 2 → rank 5)
        db.prepare('UPDATE items SET rank = rank - 1 WHERE rank > ? AND rank <= ?').run(oldRank, newRank)
        db.prepare('UPDATE items SET rank = ? WHERE item_id = ?').run(newRank, id)
      }
      // If newRank === oldRank, no changes needed

      // Return all items that have a rank (all potentially affected)
      return db.prepare(
        'SELECT * FROM items WHERE rank IS NOT NULL ORDER BY rank ASC'
      ).all()
    })()

    return (affected as any[]).map(rowToItem)
  } catch (err: any) {
    if (err instanceof DatabaseError) throw err
    throw new DatabaseError(`Failed to update rank for ${id}: ${err.message}`)
  }
}

export function updateNotes(id: string, notes: string): void {
  const db = getDb()
  try {
    db.prepare('UPDATE items SET notes = ? WHERE item_id = ?').run(notes, id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to update notes for ${id}: ${err.message}`)
  }
}

export function toggleQueue(id: string, inQueue: boolean): void {
  const db = getDb()
  try {
    db.prepare('UPDATE items SET is_in_queue = ? WHERE item_id = ?').run(inQueue ? 1 : 0, id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to toggle queue for ${id}: ${err.message}`)
  }
}

export function markStatus(id: string, status: ListingStatus): void {
  const db = getDb()
  try {
    if (status !== 'Active') {
      db.prepare('UPDATE items SET status = ?, removed_at = datetime(\'now\') WHERE item_id = ?').run(status, id)
    } else {
      db.prepare('UPDATE items SET status = ?, removed_at = NULL WHERE item_id = ?').run(status, id)
    }
  } catch (err: any) {
    throw new DatabaseError(`Failed to mark status for ${id}: ${err.message}`)
  }
}

export function freeRank(id: string): void {
  const db = getDb()
  try {
    db.transaction(() => {
      const row = db.prepare('SELECT rank FROM items WHERE item_id = ?').get(id) as any
      if (!row || row.rank === null) return

      const oldRank = row.rank
      db.prepare('UPDATE items SET rank = NULL WHERE item_id = ?').run(id)
      db.prepare('UPDATE items SET rank = rank - 1 WHERE rank > ?').run(oldRank)
    })()
  } catch (err: any) {
    throw new DatabaseError(`Failed to free rank for ${id}: ${err.message}`)
  }
}

export function getUnrankedPage(opts: {
  offset: number
  limit: number
  status?: ListingStatus
  search?: string
  type?: string
}): UnrankedPage {
  const db = getDb()
  const conditions = ['rank IS NULL']
  const params: any[] = []

  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }
  if (opts.search) {
    conditions.push('title LIKE ?')
    params.push(`%${opts.search}%`)
  }
  if (opts.type) {
    conditions.push('listing_type = ?')
    params.push(opts.type)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  try {
    const totalRow = db.prepare(`SELECT COUNT(*) as n FROM items ${where}`).get(...params) as any
    const total = totalRow.n as number
    const rows = db
      .prepare(`SELECT * FROM items ${where} ORDER BY end_time ASC LIMIT ? OFFSET ?`)
      .all(...params, opts.limit, opts.offset)
    return { items: (rows as any[]).map(rowToItem), total }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get unranked page: ${err.message}`)
  }
}

export const itemsRepo: ItemsRepo = {
  getAll,
  getById,
  upsert,
  updateRank,
  updateNotes,
  toggleQueue,
  markStatus,
  freeRank,
}
