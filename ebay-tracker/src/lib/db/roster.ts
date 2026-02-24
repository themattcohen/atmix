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
      WHERE full_name LIKE ? ESCAPE '\\'
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
      SELECT COUNT(*) AS cnt FROM player_roster
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

export function getByLastName(lastName: string, sport?: string | null): RosterPlayer[] {
  const db = getDb()
  try {
    if (sport) {
      return (db.prepare(`
        SELECT * FROM player_roster
        WHERE last_name = ? COLLATE NOCASE AND sport = ?
        ORDER BY full_name ASC
      `).all(lastName, sport) as any[]).map(mapRow)
    }
    return (db.prepare(`
      SELECT * FROM player_roster
      WHERE last_name = ? COLLATE NOCASE
      ORDER BY full_name ASC
    `).all(lastName) as any[]).map(mapRow)
  } catch (err: any) {
    throw new DatabaseError(`Failed to get players by last name: ${err.message}`)
  }
}

export function getByExactName(fullName: string, sport?: string | null): RosterPlayer | null {
  const db = getDb()
  try {
    let row: any
    if (sport) {
      row = db.prepare(`
        SELECT * FROM player_roster
        WHERE full_name = ? COLLATE NOCASE AND sport = ?
        LIMIT 1
      `).get(fullName, sport)
    } else {
      row = db.prepare(`
        SELECT * FROM player_roster
        WHERE full_name = ? COLLATE NOCASE
        LIMIT 1
      `).get(fullName)
    }
    return row ? mapRow(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get player by exact name: ${err.message}`)
  }
}

export function getById(id: number): RosterPlayer | null {
  const db = getDb()
  try {
    const row = db.prepare(`
      SELECT * FROM player_roster WHERE id = ?
    `).get(id) as any
    return row ? mapRow(row) : null
  } catch (err: any) {
    throw new DatabaseError(`Failed to get player by ID: ${err.message}`)
  }
}

export const rosterRepo: RosterRepo = {
  upsertPlayers,
  search,
  getAll,
  count,
}
