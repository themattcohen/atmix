import type { NewsEventType, SourceName, SignalScore } from '../../../types'

const BASE_SCORES: Record<NewsEventType, number> = {
  callup: 2,
  injury_minor: -1,
  injury_season: -2.5,
  trade_up: 2,
  trade_down: -1,
  award: 2,
  breakout: 2,
  suspension: -3,
  optioned: -1,
  release: -2,
  return_injury: 1,
  contract: 1,
  retirement: 1,
}

const SOURCE_MULTIPLIERS: Record<SourceName, number> = {
  mlb_transactions: 0.95,
  rotowire_rss: 0.85,
  google_news_rss: 0.65,
}

export function calculateScore(
  eventType: NewsEventType,
  source: SourceName,
  classificationConfidence: number,
  matchConfidence: number,
): SignalScore {
  const baseScore = BASE_SCORES[eventType]
  const sourceConfidence = SOURCE_MULTIPLIERS[source]

  const composite =
    0.4 * sourceConfidence +
    0.3 * classificationConfidence +
    0.3 * matchConfidence

  return {
    score: Math.round(baseScore),
    confidence: Math.round(composite * 100) / 100,
  }
}
