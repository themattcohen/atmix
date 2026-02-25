/**
 * 3-tier player matching pipeline.
 * Replaces Fuse.js fuzzy matching with structured → DB → AI pipeline.
 */
import type { RawNewsItem, RosterPlayer } from '../../../types'
import { getById, getByExactName, getByLastName, upsertPlayers } from '../../db/roster'
import { getAnthropicClient } from '../../ai/client'
import {
  extractPlayerNames,
  extractLastName,
  nameConfidence,
} from './name-utils'
import { loadSkipRules } from '../index'

export interface PlayerMatch {
  player: RosterPlayer
  confidence: number
  method: 'structured' | 'db' | 'ai'
}

const MIN_DB_CONFIDENCE = 0.80

// ─── Tier 1: Structured (MLB Transactions with person IDs) ───

function matchStructured(raw: RawNewsItem): PlayerMatch[] {
  if (!raw.structuredPlayers?.length) return []
  const matches: PlayerMatch[] = []
  for (const sp of raw.structuredPlayers) {
    let player = getById(sp.id)
    if (!player && sp.fullName) {
      // Auto-discover: MLB transaction told us this player exists
      upsertPlayers([{
        id: sp.id,
        fullName: sp.fullName,
        firstName: sp.firstName ?? sp.fullName.split(' ')[0] ?? '',
        lastName: sp.lastName ?? sp.fullName.split(' ').slice(1).join(' ') ?? '',
        position: null,
        team: null,
        teamId: null,
        active: true,
        sport: 'MLB',
      }])
      player = getById(sp.id)
    }
    if (player) {
      matches.push({ player, confidence: 1.0, method: 'structured' })
    }
  }
  return matches
}

// ─── Tier 2: Last-name DB lookup with Levenshtein scoring ───

function matchByLastName(
  names: string[],
  sport?: string | null,
): { matches: PlayerMatch[]; unmatchedNames: string[] } {
  const matches: PlayerMatch[] = []
  const unmatchedNames: string[] = []
  const seenIds = new Set<number>()

  for (const name of names) {
    let matched = false

    // Fast path: exact full-name match
    const exact = getByExactName(name, sport)
    if (exact) {
      if (!seenIds.has(exact.id)) {
        seenIds.add(exact.id)
        matches.push({ player: exact, confidence: 1.0, method: 'db' })
      }
      matched = true  // resolved even if deduped
    }

    if (!matched) {
      // Standard path: last-name lookup + confidence scoring
      const lastName = extractLastName(name)
      const candidates = getByLastName(lastName, sport)

      let bestMatch: { player: RosterPlayer; confidence: number } | null = null
      for (const candidate of candidates) {
        if (seenIds.has(candidate.id)) continue
        const conf = nameConfidence(name, candidate.fullName)
        if (conf >= MIN_DB_CONFIDENCE && (!bestMatch || conf > bestMatch.confidence)) {
          bestMatch = { player: candidate, confidence: conf }
        }
      }

      if (bestMatch) {
        seenIds.add(bestMatch.player.id)
        matches.push({ ...bestMatch, method: 'db' })
        matched = true
      }
    }

    if (!matched) {
      unmatchedNames.push(name)
    }
  }

  return { matches, unmatchedNames }
}

// ─── Tier 2.5: Live API search for unmatched names (MLB + NHL) ───

async function searchAndDiscover(
  names: string[],
  sport?: string | null,
): Promise<PlayerMatch[]> {
  if (!sport || !['MLB', 'NHL'].includes(sport)) return []

  const matches: PlayerMatch[] = []
  const seenIds = new Set<number>()

  for (const name of names.slice(0, 5)) {
    try {
      let found: Omit<RosterPlayer, 'updatedAt'> | null = null

      if (sport === 'MLB') {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportIds=1`,
          { signal: AbortSignal.timeout(5000) },
        )
        if (!res.ok) continue
        const data = await res.json()
        const person = data.people?.[0]
        if (!person || seenIds.has(person.id)) continue
        found = {
          id: person.id,
          fullName: person.fullName,
          firstName: person.firstName,
          lastName: person.lastName,
          position: person.primaryPosition?.abbreviation ?? null,
          team: null,
          teamId: null,
          active: person.active ?? true,
          sport: 'MLB',
        }
      } else if (sport === 'NHL') {
        const res = await fetch(
          `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=3&q=${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(5000) },
        )
        if (!res.ok) continue
        const results = await res.json()
        const player = results?.[0]
        if (!player || !player.active) continue
        const pid = parseInt(player.playerId, 10)
        if (seenIds.has(pid)) continue
        const nameParts = (player.name as string).split(' ')
        found = {
          id: pid,
          fullName: player.name,
          firstName: nameParts[0] ?? '',
          lastName: nameParts.slice(1).join(' ') ?? '',
          position: player.positionCode ?? null,
          team: player.teamAbbrev ?? null,
          teamId: player.teamId ? parseInt(player.teamId, 10) : null,
          active: true,
          sport: 'NHL',
        }
      }

      if (found) {
        const conf = nameConfidence(name, found.fullName)
        if (conf < MIN_DB_CONFIDENCE) continue

        seenIds.add(found.id)
        upsertPlayers([found])
        matches.push({
          player: { ...found, updatedAt: new Date().toISOString() },
          confidence: conf,
          method: 'db',
        })
      }
    } catch {
      continue
    }
  }

  return matches
}

// ─── Tier 3: AI with closed candidate list ───

async function matchWithAI(
  title: string,
  body: string | null,
  sport?: string | null,
  alreadyMatchedIds?: Set<number>,
): Promise<PlayerMatch[]> {
  const text = `${title} ${body || ''}`

  // Find capitalized words that might be last names
  const wordPattern = /\b([A-Z][a-z]{1,20})\b/g
  const potentialLastNames = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = wordPattern.exec(text)) !== null) {
    potentialLastNames.add(m[1])
  }

  // Build candidate list from DB
  const candidateMap = new Map<number, RosterPlayer>()
  for (const lastName of potentialLastNames) {
    const players = getByLastName(lastName, sport)
    for (const p of players) {
      if (alreadyMatchedIds?.has(p.id)) continue
      candidateMap.set(p.id, p)
    }
  }

  if (candidateMap.size === 0) return []

  // Limit to 50 candidates
  const candidates = Array.from(candidateMap.values()).slice(0, 50)
  const candidateList = candidates
    .map((p) => `${p.id}: ${p.fullName} (${p.team ?? 'N/A'})`)
    .join('\n')

  try {
    const client = getAnthropicClient()
    const prompt = `Given this sports news, which of THESE players are mentioned?

Title: ${title}
${body ? `Body: ${body.substring(0, 500)}` : ''}

Candidate players:
${candidateList}

Return ONLY a JSON array of player IDs (numbers). Example: [12345, 67890]
If none are mentioned, return [].`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: 'You identify which players from a provided list are mentioned in sports news. Return only a JSON array of numeric IDs. Never invent IDs not in the list.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (!content || content.type !== 'text') return []

    const cleaned = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const ids: unknown = JSON.parse(cleaned)
    if (!Array.isArray(ids)) return []

    const matches: PlayerMatch[] = []
    for (const id of ids) {
      if (typeof id !== 'number') continue
      const player = candidateMap.get(id)
      if (player) {
        matches.push({ player, confidence: 0.75, method: 'ai' })
      }
    }
    return matches
  } catch {
    return [] // AI not configured or API error
  }
}

// ─── Main entry point ───

export async function matchPlayers(
  raw: RawNewsItem,
  preloadedSkipPhrases?: Set<string>,
): Promise<PlayerMatch[]> {
  // Tier 1: Structured data (MLB Transactions) — short-circuit preserved
  const structured = matchStructured(raw)
  if (structured.length > 0) return structured

  // Tier 2: DB lookup from extracted names
  const skipPhrases = preloadedSkipPhrases ?? loadSkipRules()
  const names = extractPlayerNames(raw.title, raw.body, skipPhrases)
  if (names.length === 0) return []

  const { matches: dbMatches, unmatchedNames } = matchByLastName(names, raw.sport)
  const allMatches: PlayerMatch[] = [...dbMatches]
  const matchedIds = new Set(dbMatches.map(m => m.player.id))

  // All names resolved — done
  if (unmatchedNames.length === 0) return allMatches

  // Tier 2.5: Live API search for ONLY unmatched names (MLB + NHL)
  const discovered = await searchAndDiscover(unmatchedNames, raw.sport)
  for (const d of discovered) {
    if (!matchedIds.has(d.player.id)) {
      allMatches.push(d)
      matchedIds.add(d.player.id)
    }
  }

  // Tier 3: AI fallback if names still unresolved
  if (discovered.length < unmatchedNames.length) {
    const aiMatches = await matchWithAI(raw.title, raw.body, raw.sport, matchedIds)
    for (const ai of aiMatches) {
      if (!matchedIds.has(ai.player.id)) {
        allMatches.push(ai)
        matchedIds.add(ai.player.id)
      }
    }
  }

  return allMatches
}

// ─── Legacy wrapper for resolveUnmappedItems() ───

export function matchPlayerName(
  name: string,
  sport?: string | null,
): { player: RosterPlayer; confidence: number } | null {
  // Exact name match first
  const exact = getByExactName(name, sport)
  if (exact) return { player: exact, confidence: 1.0 }

  // Last name lookup
  const lastName = extractLastName(name)
  const candidates = getByLastName(lastName, sport)
  if (candidates.length === 0) return null

  let best: { player: RosterPlayer; confidence: number } | null = null
  for (const candidate of candidates) {
    const conf = nameConfidence(name, candidate.fullName)
    if (conf >= MIN_DB_CONFIDENCE && (!best || conf > best.confidence)) {
      best = { player: candidate, confidence: conf }
    }
  }

  return best
}

// ─── Cache invalidation (no-op — DB queries need no cache) ───

export function invalidateFuseCache(): void {
  // No-op: Fuse.js removed. Kept for backward compat with roster-sync calls.
}
