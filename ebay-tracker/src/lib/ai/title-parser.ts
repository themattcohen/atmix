import type { ParsedTitle } from '../../types'
import { getAnthropicClient } from './client'
import { AiParseError, AiRateLimitError, AiConfigError, AiBatchError, AppError } from '../errors'
import { upsertMetadata } from '../db/metadata'

export const TITLE_PARSE_SYSTEM_PROMPT = `You are a trading card expert. Given an eBay listing title, extract structured data about the card.

Return ONLY a JSON object with these exact keys. Use null for any field you cannot determine.

{
  "playerName": string | null,      // Full name: "LeBron James", not "Lebron"
  "year": number | null,             // 4-digit year the card was issued
  "brand": string | null,            // Manufacturer: "Topps", "Panini", "Upper Deck", "Bowman"
  "setName": string | null,          // Product line: "Chrome", "Prizm", "Select", "Mosaic"
  "parallel": string | null,         // Parallel/variant: "Refractor", "Gold", "Holo", "Silver"
  "cardNumber": string | null,       // Card number as printed: "111", "RC-15", "BG-7"
  "isRookie": boolean,               // true if this is a rookie card (RC, Rookie, 1st Year)
  "gradingCompany": "PSA" | "BGS" | "SGC" | "CGC" | "HGA" | null,
  "grade": string | null,            // Grade as string: "10", "9.5", "8"
  "sport": string | null,            // "Baseball", "Basketball", "Football", "Hockey", "Soccer"
  "team": string | null              // Team name without city: "Lakers", "Yankees", "Chiefs"
}

Rules:
- isRookie = true only for cards explicitly marked RC, Rookie, Rookie Card, or 1st Year. Do not infer.
- If a listing describes a lot or bundle (e.g., "LOT of 10"), set all fields to null.
- If the title is clearly not a trading card (coins, stamps, comic books), set all fields to null.
- Do NOT add keys beyond those listed. Do NOT add commentary outside the JSON object.`

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 512

function validateParsedTitle(obj: any): ParsedTitle {
  const required = [
    'playerName', 'year', 'brand', 'setName', 'parallel', 'cardNumber',
    'isRookie', 'gradingCompany', 'grade', 'sport', 'team',
  ]
  for (const key of required) {
    if (!(key in obj)) {
      throw new AiParseError(`Response missing required key: ${key}`)
    }
  }
  return obj as ParsedTitle
}

function mapAnthropicError(err: any): never {
  if (err instanceof AppError) throw err
  const status = err?.status ?? err?.statusCode
  if (status === 429) throw new AiRateLimitError()
  if (status === 401) throw new AiConfigError('Anthropic API key is invalid (401)')
  throw new AiParseError(`Anthropic API error: ${err?.message ?? String(err)}`)
}

export async function parseSingle(itemId: string, title: string): Promise<ParsedTitle> {
  let client
  try {
    client = getAnthropicClient()
  } catch (err) {
    throw err
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: TITLE_PARSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Title: ${title}` }],
    })

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new AiParseError(`Unexpected response content type for item ${itemId}`)
    }

    let parsed: any
    try {
      // Strip markdown code fences if present
      const text = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
      parsed = JSON.parse(text)
    } catch {
      throw new AiParseError(`Response is not valid JSON for item ${itemId}: ${content.text.slice(0, 200)}`)
    }

    return validateParsedTitle(parsed)
  } catch (err: any) {
    if (err instanceof AppError) throw err
    mapAnthropicError(err)
  }
}

export async function parseBatch(items: Array<{ itemId: string; title: string }>): Promise<string> {
  let client
  try {
    client = getAnthropicClient()
  } catch (err) {
    throw err
  }

  try {
    const requests = items.map(item => ({
      custom_id: item.itemId,
      params: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: TITLE_PARSE_SYSTEM_PROMPT,
        messages: [{ role: 'user' as const, content: `Title: ${item.title}` }],
      },
    }))

    const batch = await client.beta.messages.batches.create({ requests })
    return batch.id
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AiBatchError(`Failed to submit batch: ${err?.message ?? String(err)}`)
  }
}

export interface BatchPollResult {
  status: 'in_progress' | 'ended'
  requestCounts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
}

export async function pollBatch(batchId: string): Promise<BatchPollResult> {
  let client
  try {
    client = getAnthropicClient()
  } catch (err) {
    throw err
  }

  try {
    const batch = await client.beta.messages.batches.retrieve(batchId)
    return {
      status: batch.processing_status === 'ended' ? 'ended' : 'in_progress',
      requestCounts: {
        processing: batch.request_counts.processing,
        succeeded: batch.request_counts.succeeded,
        errored: batch.request_counts.errored,
        canceled: batch.request_counts.canceled,
        expired: batch.request_counts.expired,
      },
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err
    const status = err?.status ?? err?.statusCode
    if (status === 404) throw new AppError('NOT_FOUND', `Batch ${batchId} not found`, 404)
    throw new AppError('AI_BATCH_ERROR', `Failed to poll batch ${batchId}: ${err?.message ?? String(err)}`, 502)
  }
}

export async function processBatchResults(batchId: string): Promise<{ processed: number; errors: number }> {
  let client
  try {
    client = getAnthropicClient()
  } catch (err) {
    throw err
  }

  let processed = 0
  let errors = 0

  try {
    for await (const result of await client.beta.messages.batches.results(batchId)) {
      const itemId = result.custom_id

      if (result.result.type === 'succeeded') {
        try {
          const content = result.result.message.content[0]
          if (!content || content.type !== 'text') {
            console.error(`[title-parser] Batch result for ${itemId}: unexpected content type`)
            errors++
            continue
          }
          const text = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
          const parsed = JSON.parse(text)
          const validated = validateParsedTitle(parsed)
          // title_at_parse is left empty since we don't have the original title in batch results
          upsertMetadata(itemId, '', validated)
          processed++
        } catch (err: any) {
          console.error(`[title-parser] Failed to process batch result for ${itemId}: ${err.message}`)
          errors++
        }
      } else if (result.result.type === 'errored') {
        console.error(`[title-parser] Batch result errored for ${itemId}:`, result.result.error)
        errors++
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError('AI_BATCH_ERROR', `Failed to retrieve batch results for ${batchId}: ${err?.message ?? String(err)}`, 502)
  }

  return { processed, errors }
}

/**
 * Helper used by sync-service — fire-and-forget parse + store for a single new item.
 * Silently ignores AI_NOT_CONFIGURED (app works without API key).
 */
export async function parseSingleAndStore(itemId: string, title: string): Promise<void> {
  try {
    const parsed = await parseSingle(itemId, title)
    upsertMetadata(itemId, title, parsed)
  } catch (err: any) {
    if (err instanceof AppError && err.code === 'AI_NOT_CONFIGURED') {
      console.warn(`[title-parser] AI not configured — skipping parse for item ${itemId}`)
      return
    }
    throw err
  }
}
