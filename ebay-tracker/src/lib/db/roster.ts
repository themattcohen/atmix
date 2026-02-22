import type { RosterPlayer, RosterRepo } from '../../types'
import { getDb } from './client'
import { DatabaseError } from '../errors'

export function upsertPlayers(players: Omit<RosterPlayer, 'updatedAt'>[]): void {
  const db = getDb()
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO player_roster
        (id, full_name, first_name, last_name, position, team, team_id, active, sport, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    const insert = db.transaction((rows: Omit<RosterPlayer, 'updatedAt'>[]) => {
      for (const p of rows) {
        stmt.run(
          p.id,
          p.fullName,
          p.firstName,
          p.lastName,
          p.position,
          p.team,
          p.teamId,
          p.active ? 1 : 0,
          p.sport,
        )
      }
    })
    insert(players)
  } catch (err: any) {
    throw new DatabaseError(`Failed to upsert players: ${err.message}`)
  }
}

function escapeLike(str: string): string {
  return str.replace(/\0/g, '').replace(/[%_\\]/g, '\\$&')
}

export function search(query: string): RosterPlayer[] {
  const db = getDb()
  try {
    // Escape LIKE wildcards and null bytes, then guard against empty queries
    const escapedQuery = escapeLike(query).trim()
    if (!escapedQuery) {
      return []
    }

    const rows = db.prepare(`
      SELECT * FROM player_roster
      WHERE full_name LIKE ? ESCAPE '\\' AND active = 1
      ORDER BY full_name ASC
    `).all(`%${escapedQuery}%`) as any[]

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to search players: ${err.message}`)
  }
}

export function getAll(): RosterPlayer[] {
  const db = getDb()
  try {
    const rows = db.prepare(`
      SELECT * FROM player_roster
      WHERE active = 1
      ORDER BY full_name ASC
    `).all() as any[]

    return rows.map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get all players: ${err.message}`)
  }
}

export function count(): number {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt FROM player_roster WHERE active = 1
    `).get() as any
    return row.cnt as number
  } catch (err: any) {
    throw new DatabaseError(`Failed to count players: ${err.message}`)
  }
}

function mapRow(row: any): RosterPlayer {
  return {
    id: row.id,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    team: row.team,
    teamId: row.team_id,
    active: row.active === 1,
    sport: row.sport,
    updatedAt: row.updated_at,
  }
}

export const rosterRepo: RosterRepo = {
  upsertPlayers,
  search,
  getAll,
  count,
}
