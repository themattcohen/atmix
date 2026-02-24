import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { classifyEvent, classifyEventAI } from '@/lib/news/scoring/event-classifier'
import { updateEventClassification, insertMention } from '@/lib/db/news'
import { insert as insertSignal } from '@/lib/db/signals'
import { getByPlayerId } from '@/lib/db/card-mapping'
import { calculateScore, DECAY_DAYS } from '@/lib/news/scoring/score-calculator'
import { generateRetroactiveSignals } from '@/lib/news/scoring/signal-generator'
import { SIGNAL_CONFIG } from '@/lib/news/signal-config'
import { matchPlayers } from '@/lib/news/matching/player-matcher'
import type { SourceName, RawNewsItem } from '@/types'

type BackfillMode = 'classify' | 'reclassify_keywords' | 'rematch' | 'all'

async function runClassify(db: ReturnType<typeof getDb>): Promise<{ classified: number; signals: number; total: number; signalBackfill: number }> {
  const unclassified = db.prepare(`
    SELECT ni.id, ni.title, ni.body, ni.source
    FROM news_items ni
    WHERE ni.processed IN (1, 4)
      AND ni.event_type IS NULL
    ORDER BY ni.fetched_at DESC
  `).all() as { id: number; title: string; body: string | null; source: string }[]

  let classifiedCount = 0
  let signalCount = 0

  for (let i = 0; i < unclassified.length; i++) {
    const item = unclassified[i]

    const classification = await classifyEventAI(item.title, item.body)
    if (!classification) continue

    const baseScore = SIGNAL_CONFIG[classification.eventType].baseScore
    updateEventClassification(item.id, classification.eventType, baseScore, classification.matchedKeyword, 'ai')
    classifiedCount++

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
          // UNIQUE constraint violation
        }
      }
    }

    if (i < unclassified.length - 1 && (i + 1) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Phase 2: signal backfill for missing pairs
  const missingPairs = db.prepare(`
    SELECT DISTINCT npm.player_id, cpm.item_id, cpm.confidence
    FROM news_items ni
    JOIN news_player_mentions npm ON npm.news_item_id = ni.id
    JOIN card_player_mapping cpm ON cpm.player_id = npm.player_id
    WHERE ni.event_type IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_signals cs
        WHERE cs.news_item_id = ni.id AND cs.item_id = cpm.item_id
      )
    GROUP BY npm.player_id, cpm.item_id
  `).all() as { player_id: number; item_id: string; confidence: number }[]

  for (const pair of missingPairs) {
    const generated = generateRetroactiveSignals(pair.item_id, pair.player_id, pair.confidence)
    signalCount += generated
  }

  return { classified: classifiedCount, signals: signalCount, total: unclassified.length, signalBackfill: missingPairs.length }
}

async function runReclassifyKeywords(db: ReturnType<typeof getDb>): Promise<{ reclassified: number }> {
  // Find items classified via removed keywords
  const items = db.prepare(`
    SELECT ni.id, ni.title, ni.body, ni.source
    FROM news_items ni
    WHERE ni.matched_keyword IN ('questionable', 'doubtful')
  `).all() as { id: number; title: string; body: string | null; source: string }[]

  let reclassified = 0

  for (const item of items) {
    // Clear old classification
    db.prepare(`
      UPDATE news_items SET event_type = NULL, event_score = NULL, matched_keyword = NULL, classification_method = NULL
      WHERE id = ?
    `).run(item.id)

    // Delete old signals for this news item
    db.prepare(`
      DELETE FROM card_signals WHERE news_item_id = ?
    `).run(item.id)

    // Re-classify with updated keywords (keyword first, then AI)
    let classification = classifyEvent(item.title, item.body)
    let method: 'keyword' | 'ai' | undefined

    if (classification) {
      method = 'keyword'
    } else {
      classification = await classifyEventAI(item.title, item.body)
      if (classification) method = 'ai'
    }

    if (classification) {
      const baseScore = SIGNAL_CONFIG[classification.eventType].baseScore
      updateEventClassification(item.id, classification.eventType, baseScore, classification.matchedKeyword, method)
      reclassified++
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { reclassified }
}

async function runRematch(db: ReturnType<typeof getDb>): Promise<{ rematched: number; improved: number }> {
  const items = db.prepare(`
    SELECT ni.id, ni.title, ni.body, ni.source, ni.sport
    FROM news_items ni
    WHERE ni.processed IN (1, 2, 4)
    ORDER BY ni.fetched_at DESC
  `).all() as { id: number; title: string; body: string | null; source: string; sport: string | null }[]

  let rematched = 0
  let improved = 0

  for (const item of items) {
    const raw: RawNewsItem = {
      source: item.source as SourceName,
      sourceId: null,
      title: item.title,
      body: item.body,
      url: null,
      publishedAt: null,
      sport: item.sport,
    }

    const matches = await matchPlayers(raw)
    if (matches.length === 0) continue

    // Get existing mentions for comparison
    const existingMentions = db.prepare(`
      SELECT player_id, confidence FROM news_player_mentions WHERE news_item_id = ?
    `).all(item.id) as { player_id: number; confidence: number }[]
    const existingMap = new Map(existingMentions.map(m => [m.player_id, m.confidence]))

    let hadImprovement = false
    for (const match of matches) {
      const existingConf = existingMap.get(match.player.id)
      if (existingConf === undefined) {
        // New match
        insertMention(item.id, match.player.id, match.confidence)
        hadImprovement = true
      } else if (match.confidence > existingConf) {
        // Better confidence — update
        db.prepare(`
          UPDATE news_player_mentions SET confidence = ? WHERE news_item_id = ? AND player_id = ?
        `).run(match.confidence, item.id, match.player.id)
        hadImprovement = true
      }
    }

    if (hadImprovement) {
      improved++
      // Update processed status
      const hasAI = matches.some(m => m.method === 'ai')
      db.prepare(`UPDATE news_items SET processed = ? WHERE id = ?`).run(hasAI ? 4 : 1, item.id)
    }

    rematched++

    // Rate limit
    if (rematched % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { rematched, improved }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const mode: BackfillMode = body.mode || 'classify'
    const db = getDb()

    const results: Record<string, unknown> = { mode }

    if (mode === 'all' || mode === 'rematch') {
      const rematchResult = await runRematch(db)
      results.rematch = rematchResult
    }

    if (mode === 'all' || mode === 'reclassify_keywords') {
      const reclassifyResult = await runReclassifyKeywords(db)
      results.reclassify = reclassifyResult
    }

    if (mode === 'all' || mode === 'classify') {
      const classifyResult = await runClassify(db)
      results.classify = classifyResult
    }

    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[News] Backfill failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
