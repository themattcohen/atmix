import type { PriceTarget, TargetType, TargetStatus, CreateTargetInput, TargetsRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

function rowToTarget(row: any): PriceTarget {
  return {
    id:                  row.id,
    itemId:              row.item_id,
    targetType:          row.target_type as TargetType,
    targetCents:         row.target_cents,
    status:              row.status as TargetStatus,
    createdAt:           row.created_at,
    triggeredAt:         row.triggered_at ?? null,
    triggeredPriceCents: row.triggered_price_cents ?? null,
    acknowledgedAt:      row.acknowledged_at ?? null,
  }
}

export function getAll(filters?: { itemId?: string; status?: TargetStatus }): PriceTarget[] {
  const db = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.itemId) {
    conditions.push('item_id = ?')
    params.push(filters.itemId)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  try {
    const rows = db.prepare(`SELECT * FROM price_targets ${where} ORDER BY created_at DESC`).all(...params)
    return (rows as any[]).map(rowToTarget)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get targets: ${err.message}`)
  }
}

export function getById(id: number): PriceTarget | null {
  const db = getDb()
  try {
    const row = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(id)
    return row ? rowToTarget(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get target ${id}: ${err.message}`)
  }
}

export function getActiveForItem(itemId: string): PriceTarget[] {
  const db = getDb()
  try {
    const rows = db.prepare(
      `SELECT * FROM price_targets WHERE item_id = ? AND status = 'active'`
    ).all(itemId)
    return (rows as any[]).map(rowToTarget)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get active targets for item ${itemId}: ${err.message}`)
  }
}

export function getTargetCountsByItem(itemIds: string[]): Map<string, { active: number; triggered: number }> {
  if (itemIds.length === 0) return new Map()
  const db = getDb()
  try {
    const placeholders = itemIds.map(() => '?').join(', ')
    const rows = db.prepare(`
      SELECT item_id, status, COUNT(*) as cnt
      FROM price_targets
      WHERE item_id IN (${placeholders}) AND status IN ('active', 'triggered')
      GROUP BY item_id, status
    `).all(...itemIds) as any[]

    const result = new Map<string, { active: number; triggered: number }>()
    for (const row of rows) {
      const existing = result.get(row.item_id) ?? { active: 0, triggered: 0 }
      if (row.status === 'active') existing.active = row.cnt
      else if (row.status === 'triggered') existing.triggered = row.cnt
      result.set(row.item_id, existing)
    }
    return result
  } catch (err: any) {
    throw new DatabaseError(`Failed to get target counts: ${err.message}`)
  }
}

export function create(input: CreateTargetInput): PriceTarget {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO price_targets (item_id, target_type, target_cents)
      VALUES (?, ?, ?)
    `).run(input.itemId, input.targetType, input.targetCents)

    const row = db.prepare('SELECT * FROM price_targets WHERE id = ?').get(result.lastInsertRowid)
    return rowToTarget(row)
  } catch (err: any) {
    throw new DatabaseError(`Failed to create target: ${err.message}`)
  }
}

export function triggerTarget(id: number, triggeredPriceCents: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE price_targets
      SET status = 'triggered',
          triggered_at = datetime('now'),
          triggered_price_cents = ?
      WHERE id = ? AND status = 'active'
    `).run(triggeredPriceCents, id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to trigger target ${id}: ${err.message}`)
  }
}

export function acknowledge(id: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE price_targets
      SET status = 'acknowledged',
          acknowledged_at = datetime('now')
      WHERE id = ? AND status = 'triggered'
    `).run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to acknowledge target ${id}: ${err.message}`)
  }
}

export function deactivate(id: number): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE price_targets
      SET status = 'deactivated',
          acknowledged_at = datetime('now')
      WHERE id = ? AND status NOT IN ('acknowledged', 'deactivated')
    `).run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to deactivate target ${id}: ${err.message}`)
  }
}

export function remove(id: number): void {
  const db = getDb()
  try {
    db.prepare('DELETE FROM price_targets WHERE id = ?').run(id)
  } catch (err: any) {
    throw new DatabaseError(`Failed to delete target ${id}: ${err.message}`)
  }
}

export const targetsRepo: TargetsRepo = {
  getAll,
  getById,
  getActiveForItem,
  create,
  triggerTarget,
  acknowledge,
  deactivate,
  remove,
}
