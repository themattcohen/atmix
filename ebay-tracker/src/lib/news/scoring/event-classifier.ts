import type { NewsEventType } from '../../../types'

interface ClassifierRule {
  eventType: NewsEventType
  keywords: string[]
}

const RULES: ClassifierRule[] = [
  {
    eventType: 'injury_season',
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
    keywords: ['traded to', 'dealt to'],
  },
  {
    eventType: 'suspension',
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
    keywords: ['retires', 'retirement', 'hangs up', 'calls it a career'],
  },
  {
    eventType: 'return_injury',
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
    keywords: ['optioned to', 'sent down', 'assigned to'],
  },
  {
    eventType: 'contract',
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
        return { eventType: rule.eventType, confidence: 0.85 }
      }
    }
  }

  return null
}
