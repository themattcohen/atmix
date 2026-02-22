import type { NewsEventType } from '../../../types'
import { SIGNAL_CONFIG } from '../signal-config'

export function classifyEvent(
  title: string,
  body?: string | null,
): { eventType: NewsEventType; confidence: number; matchedKeyword: string } | null {
  const text = (title + ' ' + (body ?? '')).toLowerCase()

  // Iterate in original priority order (injury_season before injury_minor, etc.)
  const priorityOrder: NewsEventType[] = [
    'injury_season', 'injury_minor', 'trade_up', 'trade_down',
    'suspension', 'callup', 'award', 'breakout', 'retirement',
    'return_injury', 'release', 'optioned', 'contract',
  ]

  for (const eventType of priorityOrder) {
    const config = SIGNAL_CONFIG[eventType]
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        return { eventType, confidence: config.confidence, matchedKeyword: keyword }
      }
    }
  }

  return null
}
