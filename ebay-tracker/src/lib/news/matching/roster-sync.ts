import type { RosterPlayer } from '../../../types'
import { upsertPlayers, count } from '../../db/roster'
import { withRetry } from '../../errors'
import { invalidateFuseCache } from './player-matcher'

// ─── MLB (team-by-team fullSeason rosters) ──────────────────────────────────

const MLB_TEAM_IDS = [
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
  118, 119, 120, 121, 133, 134, 135, 136, 137, 138,
  139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
] as const

interface MLBTeamRosterResponse {
  roster?: {
    person: { id: number; fullName: string }
    position: { abbreviation?: string }
    status?: { description?: string }
  }[]
  team?: { id: number; name: string }
}

async function syncMLB(): Promise<number> {
  const allPlayers: Omit<RosterPlayer, 'updatedAt'>[] = []
  const seenIds = new Set<number>()

  const BATCH_SIZE = 8
  for (let i = 0; i < MLB_TEAM_IDS.length; i += BATCH_SIZE) {
    const batch = MLB_TEAM_IDS.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async teamId => {
        const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=fullSeason`
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) {
          throw new Error(`MLB team ${teamId} HTTP ${res.status}: ${res.statusText}`)
        }
        return (await res.json()) as MLBTeamRosterResponse
      }),
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(`[RosterSync] MLB team fetch failed: ${result.reason}`)
        continue
      }
      const data = result.value
      const teamName = data.team?.name ?? null
      const teamIdNum = data.team?.id ?? null
      for (const entry of data.roster ?? []) {
        const id = entry.person.id
        if (seenIds.has(id)) continue
        seenIds.add(id)
        const nameParts = entry.person.fullName.split(' ')
        allPlayers.push({
          id,
          fullName: entry.person.fullName,
          firstName: nameParts[0] ?? '',
          lastName: nameParts.slice(1).join(' ') ?? '',
          position: entry.position?.abbreviation ?? null,
          team: teamName,
          teamId: teamIdNum,
          active: true,
          sport: 'MLB',
        })
      }
    }

    if (i + BATCH_SIZE < MLB_TEAM_IDS.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  upsertPlayers(allPlayers)
  console.log(`[RosterSync] MLB: synced ${allPlayers.length} players`)
  return allPlayers.length
}

// ─── ESPN team-by-team shared helper (NBA + NFL) ────────────────────────────

interface ESPNAthlete {
  id: string
  fullName: string
  firstName?: string
  lastName?: string
  position?: { abbreviation?: string }
  team?: { shortDisplayName?: string; id?: string }
  active?: boolean
}

interface ESPNRosterGroup {
  position: string
  items?: ESPNAthlete[]
}

interface ESPNTeamRosterResponse {
  athletes?: ESPNRosterGroup[]
  team?: { id?: string; abbreviation?: string; shortDisplayName?: string }
}

async function syncESPNTeamBySport(
  espnPath: string,
  teamIds: readonly number[],
  sportLabel: string,
): Promise<number> {
  const allPlayers: Omit<RosterPlayer, 'updatedAt'>[] = []
  const seenIds = new Set<number>()

  const BATCH_SIZE = 8
  for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
    const batch = teamIds.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async teamId => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}/roster`
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) {
          throw new Error(`${sportLabel} team ${teamId} HTTP ${res.status}: ${res.statusText}`)
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
        console.warn(`[RosterSync] ${sportLabel} team fetch failed: ${result.reason}`)
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
          sport: sportLabel,
        })
      }
    }

    if (i + BATCH_SIZE < teamIds.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  upsertPlayers(allPlayers)
  console.log(`[RosterSync] ${sportLabel}: synced ${allPlayers.length} players`)
  return allPlayers.length
}

// ─── NBA (team-by-team via ESPN site API) ───────────────────────────────────

const NBA_TEAM_IDS = [
   1,  2,  3,  4,  5,  6,  7,  8,  9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const

async function syncNBA(): Promise<number> {
  return syncESPNTeamBySport('basketball/nba', NBA_TEAM_IDS, 'NBA')
}

// ─── NFL (team-by-team via ESPN site API) ───────────────────────────────────

const NFL_TEAM_IDS = [
   1,  2,  3,  4,  5,  6,  7,  8,  9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  33, 34,   // BAL, HOU (ESPN skips 31-32)
] as const

async function syncNFL(): Promise<number> {
  return syncESPNTeamBySport('football/nfl', NFL_TEAM_IDS, 'NFL')
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

    if (i + BATCH_SIZE < NHL_TEAMS.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  upsertPlayers(allPlayers)
  console.log(`[RosterSync] NHL: synced ${allPlayers.length} players`)
  return allPlayers.length
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RosterSyncResult {
  total: number
  failures: string[]
}

export async function syncRoster(): Promise<RosterSyncResult> {
  const sports: { name: string; fn: () => Promise<number> }[] = [
    { name: 'MLB', fn: syncMLB },
    { name: 'NBA', fn: syncNBA },
    { name: 'NFL', fn: syncNFL },
    { name: 'NHL', fn: syncNHL },
  ]

  let total = 0
  const failures: string[] = []

  for (const sport of sports) {
    try {
      const count = await withRetry(sport.fn, 2, 5000)
      total += count
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[RosterSync] ${sport.name} failed after retries: ${message}`)
      failures.push(sport.name)
    }
  }

  invalidateFuseCache()

  if (failures.length > 0) {
    console.warn(`[RosterSync] Partial: ${failures.join(', ')} failed. ${total} players from ${4 - failures.length} sport(s).`)
  } else {
    console.log(`[RosterSync] Complete: ${total} players upserted across all sports`)
  }

  return { total, failures }
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
