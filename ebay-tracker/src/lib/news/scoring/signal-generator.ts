import type { NewsEventType, SourceName } from '../../../types'
import { getClassifiedNewsForPlayer } from '../../db/news'
import { insert as insertSignal } from '../../db/signals'
import { calculateScore, DECAY_DAYS } from './score-calculator'
import { SIGNAL_CONFIG } from '../signal-config'

/**
 * Generate signals retroactively for a card that was just mapped to a player
 * who already has classified news items. Idempotent via INSERT OR IGNORE
 * on the UNIQUE(news_item_id, item_id) constraint in card_signals.
 *
 * @returns Number of signals inserted
 */
export function generateRetroactiveSignals(
  itemId: string,
  playerId: number,
  matchConfidence: number,
): number {
  const candidates = getClassifiedNewsForPlayer(playerId, itemId)
  if (candidates.length === 0) return 0

  let count = 0
  const now = Date.now()

  for (const row of candidates) {
    const eventType = row.eventType as NewsEventType
    const eventCfg = SIGNAL_CONFIG[eventType]
    if (!eventCfg) continue

    // Filter out expired items based on decay window
    const decayDays = DECAY_DAYS[eventType]
    if (decayDays !== null) {
      const fetchedMs = new Date(row.fetchedAt).getTime()
      const expiryMs = fetchedMs + decayDays * 24 * 60 * 60 * 1000
      if (now > expiryMs) continue
    }

    // Use config confidence as proxy for classification confidence
    // (original AI/keyword confidence isn't stored on the news_items row)
    const classificationConfidence = eventCfg.confidence

    const { score, confidence } = calculateScore(
      eventType,
      row.source as SourceName,
      classificationConfidence,
      matchConfidence,
    )

    if (score === 0) continue

    const expiresAt = decayDays !== null
      ? new Date(now + decayDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    try {
      insertSignal({
        newsItemId: row.id,
        itemId,
        playerId,
        eventType,
        score,
        confidence,
        headline: row.title,
        source: row.source as SourceName,
        sourceUrl: row.url || null,
        matchedKeyword: null,
        expiresAt,
      })
      count++
    } catch {
      // UNIQUE constraint violation — signal already exists for this news+card pair
    }
  }

  return count
}
