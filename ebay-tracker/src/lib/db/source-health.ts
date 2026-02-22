import type { SourceHealth, SourceName, SourceHealthRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function recordSuccess(source: SourceName): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE source_health
      SET last_success_at = datetime('now'), consecutive_failures = 0
      WHERE source = ?
    `).run(source)
  } catch (err: any) {
    throw new DatabaseError(`Failed to record success for source ${source}: ${err.message}`)
  }
}

export function recordFailure(source: SourceName, error: string): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE source_health
      SET last_failure_at = datetime('now'),
          consecutive_failures = consecutive_failures + 1,
          last_error = ?
      WHERE source = ?
    `).run(error, source)
  } catch (err: any) {
    throw new DatabaseError(`Failed to record failure for source ${source}: ${err.message}`)
  }
}

export function openCircuit(source: SourceName, until: string): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE source_health
      SET circuit_open = 1, circuit_open_until = ?
      WHERE source = ?
    `).run(until, source)
  } catch (err: any) {
    throw new DatabaseError(`Failed to open circuit for source ${source}: ${err.message}`)
  }
}

export function closeCircuit(source: SourceName): void {
  const db = getDb()
  try {
    db.prepare(`
      UPDATE source_health
      SET circuit_open = 0, circuit_open_until = NULL, consecutive_failures = 0
      WHERE source = ?
    `).run(source)
  } catch (err: any) {
    throw new DatabaseError(`Failed to close circuit for source ${source}: ${err.message}`)
  }
}

export function get(source: SourceName): SourceHealth | null {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT * FROM source_health WHERE source = ?
    `).get(source) as any | undefined

    return row ? mapRow(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get source health for ${source}: ${err.message}`)
  }
}

export function getAll(): SourceHealth[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT * FROM source_health ORDER BY source ASC
    `).all() as any[]

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get all source health records: ${err.message}`)
  }
}

function mapRow(row: any): SourceHealth {
  return {
    source: row.source,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    consecutiveFailures: row.consecutive_failures,
    circuitOpen: row.circuit_open === 1,
    circuitOpenUntil: row.circuit_open_until,
    lastError: row.last_error,
  }
}

export const sourceHealthRepo: SourceHealthRepo = {
  recordSuccess,
  recordFailure,
  openCircuit,
  closeCircuit,
  get,
  getAll,
}
