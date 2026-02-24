/**
 * 3-tier player matching pipeline.
 * Replaces Fuse.js fuzzy matching with structured → DB → AI pipeline.
 */
import type { RawNewsItem, RosterPlayer } from '../../../types'
import { getById, getByExactName, getByLastName } from '../../db/roster'
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
    const player = getById(sp.id)
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
): PlayerMatch[] {
  const matches: PlayerMatch[] = []
  const seenIds = new Set<number>()

  for (const name of names) {
    // Fast path: exact full-name match
    const exact = getByExactName(name, sport)
    if (exact && !seenIds.has(exact.id)) {
      seenIds.add(exact.id)
      matches.push({ player: exact, confidence: 1.0, method: 'db' })
      continue
    }

    // Standard path: last-name lookup + confidence scoring
    const lastName = extractLastName(name)
    const candidates = getByLastName(lastName, sport)
    if (candidates.length === 0) continue

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

export async function matchPlayers(raw: RawNewsItem): Promise<PlayerMatch[]> {
  // Tier 1: Structured data (MLB Transactions)
  const structured = matchStructured(raw)
  if (structured.length > 0) return structured

  // Tier 2: DB lookup from extracted names
  const skipPhrases = loadSkipRules()
  const names = extractPlayerNames(raw.title, raw.body, skipPhrases)
  const dbMatches = matchByLastName(names, raw.sport)

  // Tier 3: AI fallback only if Tier 2 found nothing
  if (dbMatches.length === 0) {
    const alreadyMatched = new Set<number>()
    const aiMatches = await matchWithAI(raw.title, raw.body, raw.sport, alreadyMatched)
    return aiMatches
  }

  return dbMatches
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
