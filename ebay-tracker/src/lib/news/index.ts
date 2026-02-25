import fs from 'fs'
import path from 'path'
import type { SourceName } from '../../types'
import { getByItemIds } from '../db/metadata'
import { acquireLock, releaseLock } from './rate-limiter'
import { isCircuitOpen, recordSourceSuccess, recordSourceFailure } from './circuit-breaker'
import { fetchMLBTransactions } from './sources/mlb-transactions'
import { fetchRotoWireRSS } from './sources/rotowire-rss'
import { fetchGoogleNewsRSS } from './sources/google-news-rss'
import { fetchESPNRSS } from './sources/espn-rss'
import { fetchCBSSportsRSS } from './sources/cbs-sports-rss'
import { fetchRotoBaller } from './sources/rotoballer-rss'
import { parsePlayerFromTitle } from './matching/title-parser'
import { matchPlayers, matchPlayerName, invalidateFuseCache } from './matching/player-matcher'
import { classifyEvent, classifyEventAI } from './scoring/event-classifier'
import { calculateScore, DECAY_DAYS } from './scoring/score-calculator'
import { generateRetroactiveSignals } from './scoring/signal-generator'
import { SIGNAL_CONFIG } from './signal-config'
import { insertIfNew, markProcessed, insertMention, updateEventClassification } from '../db/news'
import { insert as insertSignal } from '../db/signals'
import { getUnmapped, upsert as upsertMapping } from '../db/card-mapping'
import { getByPlayerId } from '../db/card-mapping'
import { getDb } from '../db/client'

const SOURCE_FETCHERS: Record<SourceName, () => Promise<import('../../types').RawNewsItem[]>> = {
  mlb_transactions: fetchMLBTransactions,
  rotowire_rss: fetchRotoWireRSS,
  google_news_rss: fetchGoogleNewsRSS,
  espn_rss: fetchESPNRSS,
  cbs_sports_rss: fetchCBSSportsRSS,
  rotoballer_rss: fetchRotoBaller,
}

export function loadSkipRules(): Set<string> {
  const rulesPath = path.resolve(process.cwd(), 'db/skip-rules.json')
  try {
    const raw = fs.readFileSync(rulesPath, 'utf-8')
    const data = JSON.parse(raw)
    return new Set(data.skipPhrases.map((p: string) => p.toLowerCase()))
  } catch {
    return new Set() // file doesn't exist yet — first boot
  }
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

    const retroCount = generateRetroactiveSignals(item.id, match.player.id, match.confidence)
    if (retroCount > 0) {
      console.log(`[News] Retroactive: ${retroCount} signal(s) for item ${item.id} → player ${match.player.id}`)
    }

    mapped++
  }

  if (mapped > 0) {
    console.log(`[News] Mapped ${mapped}/${unmapped.length} unmapped items to players`)
  }
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
      console.warn(`[News] ${source}: returned 0 items — check feed availability`)
      recordSourceSuccess(source)
      return
    }

    let newCount = 0
    let signalCount = 0
    const skipPhrases = loadSkipRules()

    // 5. Process each raw item
    for (const raw of rawItems) {
      const { id: newsId, isNew } = insertIfNew(raw)
      if (!isNew) continue
      newCount++

      // 6. Match players via 3-tier pipeline
      const matches = await matchPlayers(raw, skipPhrases)
      const mentionedPlayerIds: number[] = []
      let usedAIFallback = false
      for (const match of matches) {
        insertMention(newsId, match.player.id, match.confidence)
        mentionedPlayerIds.push(match.player.id)
        if (match.method === 'ai') usedAIFallback = true
      }

      if (mentionedPlayerIds.length === 0) {
        markProcessed(newsId, 2) // no_match
        continue
      }

      markProcessed(newsId, usedAIFallback ? 4 : 1) // 4=ai_fallback, 1=matched

      // 7. Classify the event and store on news_items regardless of card matches.
      //    This ensures EVENT/SCORE/KEYWORD columns populate for all matched news,
      //    not just items that happen to match a watchlist card.
      let classification = classifyEvent(raw.title, raw.body)
      let classificationMethod: 'keyword' | 'ai' | undefined

      if (classification) {
        classificationMethod = 'keyword'
      } else {
        // AI fallback for event classification
        classification = await classifyEventAI(raw.title, raw.body)
        if (classification) {
          classificationMethod = 'ai'
          console.log(`[News] AI classified: ${classification.eventType} for "${raw.title.substring(0, 60)}"`)
        }
      }

      if (classification) {
        const baseScore = SIGNAL_CONFIG[classification.eventType].baseScore
        updateEventClassification(newsId, classification.eventType, baseScore, classification.matchedKeyword, classificationMethod)
      }

      // 8. For each mentioned player, find their cards and generate signals
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
            matchedKeyword: classification.matchedKeyword,
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

/**
 * Re-match "no_match" news items against the (now-updated) roster.
 * Runs after daily roster sync to catch players that were missing before.
 * Only processes items from the last 30 days to keep runtime bounded.
 */
export async function rematchNoMatchItems(): Promise<void> {
  const db = getDb()
  const items = db.prepare(`
    SELECT id, source, title, body, sport
    FROM news_items
    WHERE processed = 2
      AND fetched_at > datetime('now', '-30 days')
    ORDER BY fetched_at DESC
  `).all() as { id: number; source: string; title: string; body: string | null; sport: string | null }[]

  if (items.length === 0) return

  console.log(`[Rematch] Processing ${items.length} no-match items from last 30 days...`)

  const BATCH_PAUSE = 10        // pause every 10 items
  const BASE_DELAY = 200        // 200ms base
  const ELEVATED_DELAY = 500    // after 20 consecutive misses
  const HEAVY_DELAY = 1000      // after 50 consecutive misses
  const PROGRESS_INTERVAL = 100 // log + long pause every 100 items
  const PROGRESS_PAUSE = 3000   // 3s at progress checkpoints

  let matched = 0
  let signalCount = 0
  let consecutiveNoMatch = 0
  const skipPhrases = loadSkipRules()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const raw = {
      source: item.source as SourceName,
      sourceId: null,
      title: item.title,
      body: item.body,
      url: null,
      publishedAt: null,
      sport: item.sport,
    }

    const matches = await matchPlayers(raw, skipPhrases)
    if (matches.length === 0) continue

    // Insert mentions
    const mentionedPlayerIds: number[] = []
    let usedAIFallback = false
    for (const match of matches) {
      insertMention(item.id, match.player.id, match.confidence)
      mentionedPlayerIds.push(match.player.id)
      if (match.method === 'ai') usedAIFallback = true
    }

    markProcessed(item.id, usedAIFallback ? 4 : 1)
    matched++

    // Classify + generate signals (same logic as ingestion)
    let classification = classifyEvent(item.title, item.body)
    let classificationMethod: 'keyword' | 'ai' | undefined

    if (classification) {
      classificationMethod = 'keyword'
    } else {
      classification = await classifyEventAI(item.title, item.body)
      if (classification) classificationMethod = 'ai'
    }

    if (classification) {
      const baseScore = SIGNAL_CONFIG[classification.eventType].baseScore
      updateEventClassification(item.id, classification.eventType, baseScore, classification.matchedKeyword, classificationMethod)

      for (const playerId of mentionedPlayerIds) {
        const cards = getByPlayerId(playerId)
        for (const card of cards) {
          const { score, confidence } = calculateScore(
            classification.eventType,
            item.source as SourceName,
            classification.confidence,
            card.confidence,
          )
          if (score === 0) continue

          const decayDays = DECAY_DAYS[classification.eventType]
          const expiresAt = decayDays !== null
            ? new Date(Date.now() + decayDays * 24 * 60 * 60 * 1000).toISOString()
            : null

          try {
            insertSignal({
              newsItemId: item.id,
              itemId: card.itemId,
              playerId,
              eventType: classification.eventType,
              score,
              confidence,
              headline: item.title,
              source: item.source as SourceName,
              sourceUrl: null,
              matchedKeyword: classification.matchedKeyword,
              expiresAt,
            })
            signalCount++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[Rematch] Signal insert failed news=${item.id} player=${playerId}: ${msg}`)
          }
        }
      }
    }

    if (matches.length > 0) {
      consecutiveNoMatch = 0
    } else {
      consecutiveNoMatch++
    }

    // Micro-batch throttle
    if ((i + 1) % BATCH_PAUSE === 0 && i + 1 < items.length) {
      const delay = consecutiveNoMatch >= 50
        ? HEAVY_DELAY
        : consecutiveNoMatch >= 20
          ? ELEVATED_DELAY
          : BASE_DELAY
      await new Promise(r => setTimeout(r, delay))
    }

    // Progress checkpoint
    if ((i + 1) % PROGRESS_INTERVAL === 0 && i + 1 < items.length) {
      console.log(`[Rematch] Progress: ${i + 1}/${items.length} (${matched} matched, ${signalCount} signals)`)
      await new Promise(r => setTimeout(r, PROGRESS_PAUSE))
    }
  }

  console.log(`[Rematch] Done: ${matched}/${items.length} items now matched, ${signalCount} signals generated`)
}
