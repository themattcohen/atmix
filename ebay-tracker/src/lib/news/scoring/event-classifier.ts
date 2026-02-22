import type { NewsEventType } from '../../../types'

interface ClassifierRule {
  eventType: NewsEventType
  keywords: string[]
  confidence: number
}

const RULES: ClassifierRule[] = [
  {
    eventType: 'injury_season',
    confidence: 0.90,
    keywords: [
      'season-ending',
      'torn acl',
      'torn ucl',
      'tommy john',
      'out for season',
      'out for the season',
      'season ending',
    ],
  },
  {
    eventType: 'injury_minor',
    confidence: 0.80,
    keywords: [
      'day-to-day',
      '10-day il',
      '15-day il',
      'placed on il',
      'injured list',
      'sprain',
      'strain',
      'bruise',
      'soreness',
    ],
  },
  {
    eventType: 'trade_up',
    confidence: 0.85,
    keywords: [
      'traded to yankees',
      'traded to dodgers',
      'traded to mets',
      'traded to cubs',
      'traded to braves',
      'acquired by',
      'blockbuster trade',
    ],
  },
  {
    eventType: 'trade_down',
    confidence: 0.70,
    keywords: ['traded to', 'dealt to'],
  },
  {
    eventType: 'suspension',
    confidence: 0.90,
    keywords: [
      'suspended',
      'banned',
      'peds',
      'performance-enhancing',
      'domestic violence',
      'gambling',
    ],
  },
  {
    eventType: 'callup',
    confidence: 0.80,
    keywords: [
      'called up',
      'recalled',
      'promoted',
      'select the contract',
      'added to roster',
      'roster move',
    ],
  },
  {
    eventType: 'award',
    confidence: 0.95,
    keywords: [
      'mvp',
      'cy young',
      'all-star',
      'rookie of the year',
      'gold glove',
      'silver slugger',
      'hof',
      'hall of fame',
    ],
  },
  {
    eventType: 'breakout',
    confidence: 0.85,
    keywords: [
      'no-hitter',
      'perfect game',
      'cycle',
      'grand slam',
      'walk-off',
      'career high',
      'record-breaking',
    ],
  },
  {
    eventType: 'retirement',
    confidence: 0.90,
    keywords: ['retires', 'retirement', 'hangs up', 'calls it a career'],
  },
  {
    eventType: 'return_injury',
    confidence: 0.85,
    keywords: [
      'activated from il',
      'returns from injury',
      'removed from il',
      'back from il',
      'cleared to play',
    ],
  },
  {
    eventType: 'release',
    confidence: 0.80,
    keywords: [
      'released',
      'designated for assignment',
      'dfa',
      'non-tendered',
      'outrighted',
    ],
  },
  {
    eventType: 'optioned',
    confidence: 0.75,
    keywords: ['optioned to', 'sent down', 'assigned to'],
  },
  {
    eventType: 'contract',
    confidence: 0.75,
    keywords: [
      'extension',
      'signs with',
      'contract',
      'multi-year deal',
      'free agent signing',
    ],
  },
]

export function classifyEvent(
  title: string,
  body?: string | null,
): { eventType: NewsEventType; confidence: number } | null {
  const text = (title + ' ' + (body ?? '')).toLowerCase()

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return { eventType: rule.eventType, confidence: rule.confidence }
      }
    }
  }

  return null
}
