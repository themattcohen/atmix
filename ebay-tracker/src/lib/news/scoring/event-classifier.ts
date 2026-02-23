import type { NewsEventType } from '../../../types'
import { SIGNAL_CONFIG } from '../signal-config'
import { getAnthropicClient } from '../../ai/client'

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

export async function classifyEventAI(
  title: string,
  body?: string | null,
): Promise<{ eventType: NewsEventType; confidence: number; matchedKeyword: string } | null> {
  try {
    const client = getAnthropicClient()

    const eventDescriptions = (Object.keys(SIGNAL_CONFIG) as NewsEventType[])
      .map((eventType) => {
        const cfg = SIGNAL_CONFIG[eventType]
        const exampleKeywords = cfg.keywords.slice(0, 3).join(', ')
        return `- "${eventType}": ${cfg.labelLong} — ${cfg.description} (e.g. ${exampleKeywords})`
      })
      .join('\n')

    const systemPrompt =
      `You are a sports news classifier. Given a headline and optional body text, classify the event into exactly one of the following event types:\n\n` +
      `${eventDescriptions}\n- "none": Does not match any of the above event types\n\n` +
      `Respond with ONLY a JSON object in one of these two forms:\n` +
      `{ "eventType": "<type>", "matchedKeyword": "<key phrase from the text that led to classification>" }\n` +
      `{ "eventType": "none" }\n` +
      `No explanation. No markdown. No extra keys.`

    const userText = body
      ? `Headline: ${title}\nBody: ${body}`
      : `Headline: ${title}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    })

    const content = message.content[0]
    if (!content || content.type !== 'text') return null

    const cleaned = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned) as { eventType: string; matchedKeyword?: string }

    if (parsed.eventType === 'none') return null
    if (!(parsed.eventType in SIGNAL_CONFIG)) return null

    const eventType = parsed.eventType as NewsEventType
    const matchedKeyword =
      parsed.matchedKeyword && parsed.matchedKeyword.trim().length > 0
        ? parsed.matchedKeyword
        : SIGNAL_CONFIG[eventType].labelLong

    return { eventType, confidence: 0.75, matchedKeyword }
  } catch {
    return null // AI not configured, parse error, or API error — silently fall back
  }
}
