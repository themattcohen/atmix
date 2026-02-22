import type { SourceName } from '../../types'
import { getByItemIds } from '../db/metadata'
import { acquireLock, releaseLock } from './rate-limiter'
import { isCircuitOpen, recordSourceSuccess, recordSourceFailure } from './circuit-breaker'
import { fetchMLBTransactions } from './sources/mlb-transactions'
import { fetchRotoWireRSS } from './sources/rotowire-rss'
import { fetchGoogleNewsRSS } from './sources/google-news-rss'
import { fetchESPNRSS } from './sources/espn-rss'
import { parsePlayerFromTitle } from './matching/title-parser'
import { matchPlayerName } from './matching/player-matcher'
import { classifyEvent } from './scoring/event-classifier'
import { calculateScore, DECAY_DAYS } from './scoring/score-calculator'
import { insertIfNew, markProcessed, insertMention } from '../db/news'
import { insert as insertSignal } from '../db/signals'
import { getUnmapped, upsert as upsertMapping } from '../db/card-mapping'
import { getByPlayerId } from '../db/card-mapping'

const SOURCE_FETCHERS: Record<SourceName, () => Promise<import('../../types').RawNewsItem[]>> = {
  mlb_transactions: fetchMLBTransactions,
  rotowire_rss: fetchRotoWireRSS,
  google_news_rss: fetchGoogleNewsRSS,
  espn_rss: fetchESPNRSS,
}

/**
 * Resolve unmapped watchlist items: parse eBay titles → match to roster players.
 * Called lazily before each ingestion cycle.
 */
function resolveUnmappedItems(): void {
  const unmapped = getUnmapped()
  if (unmapped.length === 0) return

  // Pre-load AI-parsed metadata for unmapped items as fallback
  const metadataList = getByItemIds(unmapped.map(u => u.id))
  const metadataMap = new Map(metadataList.map(m => [m.itemId, m]))

  let mapped = 0
  for (const item of unmapped) {
    // Try regex title parser first
    let playerName = parsePlayerFromTitle(item.title)

    // Fallback: use AI-parsed playerName from card metadata
    if (!playerName) {
      const meta = metadataMap.get(item.id)
      if (meta?.playerName) {
        playerName = meta.playerName
      }
    }

    if (!playerName) continue

    const match = matchPlayerName(playerName)
    if (!match) continue

    upsertMapping({
      itemId: item.id,
      playerId: match.player.id,
      playerName: match.player.fullName,
      confidence: match.confidence,
    })
    mapped++
  }

  if (mapped > 0) {
    console.log(`[News] Mapped ${mapped}/${unmapped.length} unmapped items to players`)
  }
}

/**
 * Extract player names from news text using simple heuristics.
 * Returns array of potential player name strings found in title + body.
 */
function extractPlayerNames(title: string, body: string | null): string[] {
  const text = `${title} ${body || ''}`
  // Look for capitalized name patterns (First Last or First Middle Last)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1]
    // Skip common non-name phrases
    if (/^(New York|Los Angeles|San Francisco|San Diego|Kansas City|St Louis|Spring Training|World Series|All Star|National League|American League)$/i.test(name)) continue
    names.push(name)
  }
  return [...new Set(names)]
}

/**
 * Main entry point: run ingestion for a single source.
 * Called by cron scheduler.
 */
export async function runSourceIngestion(source: SourceName): Promise<void> {
  // 1. Check circuit breaker
  if (isCircuitOpen(source)) {
    console.log(`[News] ${source}: circuit open, skipping`)
    return
  }

  // 2. Check concurrency guard
  if (!acquireLock(source)) {
    console.log(`[News] ${source}: already running, skipping`)
    return
  }

  try {
    // 3. Resolve unmapped watchlist items
    resolveUnmappedItems()

    // 4. Fetch from source
    const fetcher = SOURCE_FETCHERS[source]
    const rawItems = await fetcher()

    if (rawItems.length === 0) {
      recordSourceSuccess(source)
      return
    }

    let newCount = 0
    let signalCount = 0

    // 5. Process each raw item
    for (const raw of rawItems) {
      const { id: newsId, isNew } = insertIfNew(raw)
      if (!isNew) continue
      newCount++

      // 6. Extract player names from news text
      const playerNames = extractPlayerNames(raw.title, raw.body)

      const mentionedPlayerIds: number[] = []

      for (const name of playerNames) {
        const match = matchPlayerName(name)
        if (!match) continue

        // Insert mention
        insertMention(newsId, match.player.id, match.confidence)
        mentionedPlayerIds.push(match.player.id)
      }

      if (mentionedPlayerIds.length === 0) {
        markProcessed(newsId, 2) // no_match
        continue
      }

      markProcessed(newsId, 1) // matched

      // 7. For each mentioned player, find their cards and generate signals
      const classification = classifyEvent(raw.title, raw.body)
      if (!classification) continue

      for (const playerId of mentionedPlayerIds) {
        const cards = getByPlayerId(playerId)

        for (const card of cards) {
          const { score, confidence } = calculateScore(
            classification.eventType,
            source,
            classification.confidence,
            card.confidence
          )

          // Only create signals with meaningful scores
          if (score === 0) continue

          const decayDays = DECAY_DAYS[classification.eventType]
          const expiresAt = decayDays !== null
            ? new Date(Date.now() + decayDays * 24 * 60 * 60 * 1000).toISOString()
            : null

          insertSignal({
            newsItemId: newsId,
            itemId: card.itemId,
            playerId,
            eventType: classification.eventType,
            score,
            confidence,
            headline: raw.title,
            source,
            sourceUrl: raw.url || null,
            expiresAt,
          })
          signalCount++
        }
      }
    }

    recordSourceSuccess(source)

    if (newCount > 0 || signalCount > 0) {
      console.log(`[News] ${source}: ${newCount} new items, ${signalCount} signals generated`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[News] ${source} ingestion failed:`, message)
    recordSourceFailure(source)
  } finally {
    releaseLock(source)
  }
}
