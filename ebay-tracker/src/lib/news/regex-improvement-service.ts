import fs from 'fs'
import path from 'path'
import { getDb } from '../db/client'
import { getAnthropicClient } from '../ai/client'

interface SkipRulesFile {
  version: number
  generatedAt: string
  skipPhrases: string[]
}

export async function runRegexImprovementJob(): Promise<void> {
  const db = getDb()

  // 1. Get titles that required AI fallback in the last 24h
  const rows = db.prepare(`
    SELECT title FROM news_items
    WHERE processed = 4
      AND fetched_at >= datetime('now', '-24 hours')
    LIMIT 500
  `).all() as { title: string }[]

  if (rows.length === 0) {
    console.log('[RegexImprove] No AI-fallback items in last 24h, skipping')
    return
  }

  const headlines = rows.map(r => r.title).join('\n')

  // 2. Ask Haiku to identify non-player phrases the regex likely matched
  let newPhrases: string[]
  try {
    const client = getAnthropicClient()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: `You are helping improve a regex that extracts player names from sports headlines.
The regex finds consecutive capitalized multi-word sequences like "Mike Trout".
It has a skip list of non-name phrases (city names, event names) to ignore.

These headlines all FAILED regex extraction (only non-name phrases matched).
Return a JSON array of multi-word title-case phrases the regex likely matched
that are NOT player names. Focus on: city names, team nicknames, award names,
event names, organization names, seasonal phrases, sports jargon.
Only 2+ word capitalized phrases. Return only the JSON array.`,
      messages: [{ role: 'user', content: headlines }],
    })
    const content = message.content[0]
    if (!content || content.type !== 'text') return
    const cleaned = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return
    newPhrases = parsed.filter((p: unknown) => typeof p === 'string' && (p as string).includes(' '))
  } catch (err) {
    console.error('[RegexImprove] AI analysis failed:', err)
    return
  }

  if (newPhrases.length === 0) {
    console.log('[RegexImprove] AI found no new skip phrases')
    return
  }

  // 3. Merge with existing skip-rules.json
  const rulesPath = path.resolve(process.cwd(), 'db/skip-rules.json')
  let existing: SkipRulesFile = { version: 1, generatedAt: '', skipPhrases: [] }

  try {
    const raw = fs.readFileSync(rulesPath, 'utf-8')
    existing = JSON.parse(raw)
  } catch {
    // File doesn't exist yet — start fresh
  }

  const existingSet = new Set(existing.skipPhrases.map(p => p.toLowerCase()))
  let added = 0
  for (const phrase of newPhrases) {
    if (!existingSet.has(phrase.toLowerCase())) {
      existing.skipPhrases.push(phrase)
      existingSet.add(phrase.toLowerCase())
      added++
    }
  }

  if (added === 0) {
    console.log('[RegexImprove] All phrases already in skip list')
    return
  }

  // 4. Write updated file
  existing.generatedAt = new Date().toISOString()
  fs.writeFileSync(rulesPath, JSON.stringify(existing, null, 2), 'utf-8')

  console.log(`[RegexImprove] Added ${added} new skip phrases (total: ${existing.skipPhrases.length})`)
}
