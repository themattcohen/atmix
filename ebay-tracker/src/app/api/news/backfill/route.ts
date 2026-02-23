import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { classifyEventAI } from '@/lib/news/scoring/event-classifier'
import { updateEventClassification } from '@/lib/db/news'
import { insert as insertSignal } from '@/lib/db/signals'
import { getByPlayerId } from '@/lib/db/card-mapping'
import { calculateScore, DECAY_DAYS } from '@/lib/news/scoring/score-calculator'
import { SIGNAL_CONFIG } from '@/lib/news/signal-config'
import type { SourceName } from '@/types'

export async function POST() {
  try {
    const db = getDb()

    // Find items that were processed (matched or ai_fallback) but have no event classification
    const unclassified = db.prepare(`
      SELECT ni.id, ni.title, ni.body, ni.source
      FROM news_items ni
      WHERE ni.processed IN (1, 4)
        AND ni.event_type IS NULL
      ORDER BY ni.fetched_at DESC
    `).all() as { id: number; title: string; body: string | null; source: string }[]

    if (unclassified.length === 0) {
      return NextResponse.json({ classified: 0, signals: 0, message: 'No unclassified items to backfill' })
    }

    let classifiedCount = 0
    let signalCount = 0

    // Process in batches of 50 with delay between calls
    for (let i = 0; i < unclassified.length; i++) {
      const item = unclassified[i]

      const classification = await classifyEventAI(item.title, item.body)
      if (!classification) continue

      const baseScore = SIGNAL_CONFIG[classification.eventType].baseScore
      updateEventClassification(item.id, classification.eventType, baseScore, classification.matchedKeyword, 'ai')
      classifiedCount++

      // Find player mentions for this news item and generate signals for their cards
      const mentions = db.prepare(`
        SELECT npm.player_id, npm.confidence
        FROM news_player_mentions npm
        WHERE npm.news_item_id = ?
      `).all(item.id) as { player_id: number; confidence: number }[]

      for (const mention of mentions) {
        const cards = getByPlayerId(mention.player_id)

        for (const card of cards) {
          const { score, confidence } = calculateScore(
            classification.eventType,
            item.source as SourceName,
            classification.confidence,
            card.confidence
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
              playerId: mention.player_id,
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
          } catch {
            // UNIQUE constraint violation — signal already exists for this news+card pair
          }
        }
      }

      // Rate limit: 100ms delay between AI calls to avoid hammering the API
      if (i < unclassified.length - 1 && (i + 1) % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Phase 2: generate signals for items that are classified + have card matches but no signals yet
    const missingSignals = db.prepare(`
      SELECT DISTINCT ni.id, ni.title, ni.source, ni.event_type
      FROM news_items ni
      JOIN news_player_mentions npm ON npm.news_item_id = ni.id
      WHERE ni.event_type IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM card_signals cs WHERE cs.news_item_id = ni.id
        )
      ORDER BY ni.fetched_at DESC
    `).all() as { id: number; title: string; source: string; event_type: string }[]

    for (const item of missingSignals) {
      const eventCfg = SIGNAL_CONFIG[item.event_type as import('@/types').NewsEventType]
      if (!eventCfg) continue

      const mentions = db.prepare(`
        SELECT npm.player_id, npm.confidence
        FROM news_player_mentions npm
        WHERE npm.news_item_id = ?
      `).all(item.id) as { player_id: number; confidence: number }[]

      for (const mention of mentions) {
        const cards = getByPlayerId(mention.player_id)

        for (const card of cards) {
          // Use config confidence as proxy since original AI confidence isn't stored
          const { score, confidence } = calculateScore(
            item.event_type as import('@/types').NewsEventType,
            item.source as SourceName,
            eventCfg.confidence,
            card.confidence
          )

          if (score === 0) continue

          const decayDays = DECAY_DAYS[item.event_type as import('@/types').NewsEventType]
          const expiresAt = decayDays !== null
            ? new Date(Date.now() + decayDays * 24 * 60 * 60 * 1000).toISOString()
            : null

          try {
            insertSignal({
              newsItemId: item.id,
              itemId: card.itemId,
              playerId: mention.player_id,
              eventType: item.event_type as import('@/types').NewsEventType,
              score,
              confidence,
              headline: item.title,
              source: item.source as SourceName,
              sourceUrl: null,
              matchedKeyword: null,
              expiresAt,
            })
            signalCount++
          } catch {
            // UNIQUE constraint violation — signal already exists for this news+card pair
          }
        }
      }
    }

    return NextResponse.json({
      classified: classifiedCount,
      signals: signalCount,
      total: unclassified.length,
      signalBackfill: missingSignals.length,
      message: `Backfilled ${classifiedCount}/${unclassified.length} items, generated ${signalCount} signals (${missingSignals.length} items needed signal backfill)`
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[News] Backfill failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
