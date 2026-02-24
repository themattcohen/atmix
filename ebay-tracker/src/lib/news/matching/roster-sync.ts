import type { RosterPlayer } from '../../../types'
import { upsertPlayers, count } from '../../db/roster'
import { invalidateFuseCache } from './player-matcher'

// ─── MLB ────────────────────────────────────────────────────────────────────

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

async function syncMLB(): Promise<number> {
  const season = new Date().getFullYear()
  const url = `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    throw new Error(`MLB HTTP ${res.status}: ${res.statusText}`)
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
  console.log(`[RosterSync] MLB: synced ${players.length} players`)
  return players.length
}

// ─── ESPN (NBA + NFL) ───────────────────────────────────────────────────────

interface ESPNAthlete {
  id: string
  fullName: string
  firstName?: string
  lastName?: string
  position?: { abbreviation?: string }
  team?: { shortDisplayName?: string; id?: string }
  active?: boolean
}

interface ESPNAthletesResponse {
  items?: ESPNAthlete[]
}

interface ESPNRosterGroup {
  position: string
  items?: ESPNAthlete[]
}

interface ESPNTeamRosterResponse {
  athletes?: ESPNRosterGroup[]
  team?: { id?: string; abbreviation?: string; shortDisplayName?: string }
}

async function syncESPNSport(apiPath: string, sportLabel: string): Promise<number> {
  const url = `https://sports.core.api.espn.com/v3/sports/${apiPath}/athletes?limit=1000`

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    throw new Error(`${sportLabel} HTTP ${res.status}: ${res.statusText}`)
  }

  const data: ESPNAthletesResponse = await res.json()
  const items = data.items ?? []

  const players: Omit<RosterPlayer, 'updatedAt'>[] = items.map(p => {
    const nameParts = p.fullName.split(' ')
    const firstName = p.firstName ?? nameParts[0] ?? ''
    const lastName = p.lastName ?? nameParts.slice(1).join(' ') ?? ''
    return {
      id: parseInt(p.id, 10),
      fullName: p.fullName,
      firstName,
      lastName,
      position: p.position?.abbreviation ?? null,
      team: p.team?.shortDisplayName ?? null,
      teamId: p.team?.id != null ? parseInt(p.team.id, 10) : null,
      active: p.active ?? true,
      sport: sportLabel,
    }
  })

  upsertPlayers(players)
  console.log(`[RosterSync] ${sportLabel}: synced ${players.length} players`)
  return players.length
}

async function syncNBA(): Promise<number> {
  return syncESPNSport('basketball/nba', 'NBA')
}

// ─── NFL (team-by-team — ESPN Core API caps at 1000, NFL has ~1700+) ────────

const NFL_TEAM_IDS = [
   1,  2,  3,  4,  5,  6,  7,  8,  9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  33, 34,   // BAL, HOU (ESPN skips 31-32)
] as const

async function syncNFL(): Promise<number> {
  const allPlayers: Omit<RosterPlayer, 'updatedAt'>[] = []
  const seenIds = new Set<number>()

  const BATCH_SIZE = 8
  for (let i = 0; i < NFL_TEAM_IDS.length; i += BATCH_SIZE) {
    const batch = NFL_TEAM_IDS.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async teamId => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) {
          throw new Error(`NFL team ${teamId} HTTP ${res.status}: ${res.statusText}`)
        }
        const data: ESPNTeamRosterResponse = await res.json()
        const athletes: ESPNAthlete[] = []
        for (const group of data.athletes ?? []) {
          for (const item of group.items ?? []) {
            athletes.push(item)
          }
        }
        const teamName = data.team?.shortDisplayName ?? null
        const teamIdNum = data.team?.id != null ? parseInt(data.team.id, 10) : null
        return { teamId, teamName, teamIdNum, athletes }
      }),
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(`[RosterSync] NFL team fetch failed: ${result.reason}`)
        continue
      }
      const { teamName, teamIdNum, athletes } = result.value
      for (const p of athletes) {
        const id = parseInt(p.id, 10)
        if (seenIds.has(id)) continue
        seenIds.add(id)
        const nameParts = p.fullName.split(' ')
        const firstName = p.firstName ?? nameParts[0] ?? ''
        const lastName = p.lastName ?? nameParts.slice(1).join(' ') ?? ''
        allPlayers.push({
          id,
          fullName: p.fullName,
          firstName,
          lastName,
          position: p.position?.abbreviation ?? null,
          team: teamName,
          teamId: teamIdNum,
          active: p.active ?? true,
          sport: 'NFL',
        })
      }
    }

    // Small delay between batches to be respectful to the ESPN API
    if (i + BATCH_SIZE < NFL_TEAM_IDS.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  upsertPlayers(allPlayers)
  console.log(`[RosterSync] NFL: synced ${allPlayers.length} players`)
  return allPlayers.length
}

// ─── NHL ────────────────────────────────────────────────────────────────────

const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ',
  'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NSH',
  'NJD', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SJS', 'SEA',
  'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
] as const

interface NHLPlayerEntry {
  id: number
  firstName: { default: string }
  lastName: { default: string }
  positionCode: string
}

interface NHLRosterResponse {
  forwards?: NHLPlayerEntry[]
  defensemen?: NHLPlayerEntry[]
  goalies?: NHLPlayerEntry[]
}

async function syncNHL(): Promise<number> {
  const allPlayers: Omit<RosterPlayer, 'updatedAt'>[] = []
  const seenIds = new Set<number>()

  // Process teams in batches of 8 to avoid hammering the API
  const BATCH_SIZE = 8
  for (let i = 0; i < NHL_TEAMS.length; i += BATCH_SIZE) {
    const batch = NHL_TEAMS.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async abbrev => {
        const url = `https://api-web.nhle.com/v1/roster/${abbrev}/current`
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) {
          throw new Error(`NHL ${abbrev} HTTP ${res.status}: ${res.statusText}`)
        }
        const data: NHLRosterResponse = await res.json()
        const allGroups = [
          ...(data.forwards ?? []),
          ...(data.defensemen ?? []),
          ...(data.goalies ?? []),
        ]
        return { abbrev, players: allGroups }
      }),
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(`[RosterSync] NHL team fetch failed: ${result.reason}`)
        continue
      }
      const { abbrev, players } = result.value
      for (const p of players) {
        if (seenIds.has(p.id)) continue
        seenIds.add(p.id)
        const firstName = p.firstName.default
        const lastName = p.lastName.default
        allPlayers.push({
          id: p.id,
          fullName: `${firstName} ${lastName}`,
          firstName,
          lastName,
          position: p.positionCode ?? null,
          team: abbrev,
          teamId: null,
          active: true,
          sport: 'NHL',
        })
      }
    }

    // Small delay between batches to be respectful to the NHL API
    if (i + BATCH_SIZE < NHL_TEAMS.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  upsertPlayers(allPlayers)
  console.log(`[RosterSync] NHL: synced ${allPlayers.length} players`)
  return allPlayers.length
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function syncRoster(): Promise<number> {
  let total = 0

  total += await syncMLB()
  total += await syncNBA()
  total += await syncNFL()
  total += await syncNHL()

  invalidateFuseCache()
  console.log(`[RosterSync] Complete: ${total} players upserted across all sports`)
  return total
}

export async function initRosterIfEmpty(): Promise<void> {
  if (count() > 0) return

  const delays = [2000, 10000, 30000]  // 2s, 10s, 30s
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      await syncRoster()
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[RosterSync] Attempt ${attempt + 1}/${delays.length} failed: ${message}`)
      if (attempt < delays.length - 1) {
        await new Promise(r => setTimeout(r, delays[attempt]))
      }
    }
  }
  console.error('[RosterSync] All retry attempts exhausted — roster will be empty until next scheduled sync')
}
