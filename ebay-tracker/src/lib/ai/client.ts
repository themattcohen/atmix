import Anthropic from '@anthropic-ai/sdk'
import { AppError } from '../errors'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AppError('AI_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set', 503)
  }
  client = new Anthropic({ apiKey })
  return client
}
