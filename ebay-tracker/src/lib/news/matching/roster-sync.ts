import type { RosterPlayer } from '../../../types'
import { upsertPlayers, count } from '../../db/roster'
import { invalidateFuseCache } from './player-matcher'

interface MLBPerson {
  id: number
  fullName: string
  firstName: string
  lastName: string
  primaryPosition?: { abbreviation?: string }
  currentTeam?: { name?: string; id?: number }
  active: boolean
}

interface MLBPlayersResponse {
  people?: MLBPerson[]
}

export async function syncRoster(): Promise<number> {
  const season = new Date().getFullYear()
  const url = `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const data: MLBPlayersResponse = await res.json()
  const people = data.people ?? []

  const players: Omit<RosterPlayer, 'updatedAt'>[] = people.map(p => ({
    id: p.id,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.primaryPosition?.abbreviation ?? null,
    team: p.currentTeam?.name ?? null,
    teamId: p.currentTeam?.id ?? null,
    active: p.active,
    sport: 'MLB',
  }))

  upsertPlayers(players)
  invalidateFuseCache()

  const playerCount = players.length
  console.log(`[RosterSync] Complete: ${playerCount} MLB players upserted`)
  return playerCount
}

export async function initRosterIfEmpty(): Promise<void> {
  if (count() === 0) {
    await syncRoster()
  }
}
