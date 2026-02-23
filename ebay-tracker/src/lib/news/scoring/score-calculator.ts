import type { NewsEventType, SourceName, SignalScore } from '../../../types'
import { SIGNAL_CONFIG, SOURCE_CONFIG, SCORING_FORMULA } from '../signal-config'

export function calculateScore(
  eventType: NewsEventType,
  source: SourceName,
  classificationConfidence: number,
  matchConfidence: number,
): SignalScore {
  const baseScore = SIGNAL_CONFIG[eventType].baseScore
  const sourceConfidence = SOURCE_CONFIG[source].multiplier

  const composite =
    SCORING_FORMULA.sourceWeight * sourceConfidence +
    SCORING_FORMULA.classificationWeight * classificationConfidence +
    SCORING_FORMULA.matchWeight * matchConfidence

  const raw = baseScore * composite
  const score = raw === 0 ? 0 : (Math.abs(raw) < 0.5 ? Math.sign(raw) : Math.round(raw))

  return {
    score,
    confidence: Math.round(composite * 100) / 100,
  }
}

export const DECAY_DAYS: Record<NewsEventType, number | null> = Object.fromEntries(
  Object.entries(SIGNAL_CONFIG).map(([k, v]) => [k, v.decayDays])
) as Record<NewsEventType, number | null>
