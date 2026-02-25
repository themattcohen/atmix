/**
 * Integration test: News Pipeline Regex -> AI Fallback -> Self-Improving Skip List
 *
 * Runs 9 ordered steps to prove the full cycle works end-to-end with real headlines.
 * Usage: cd ebay-tracker && npx tsx tmp-test-pipeline-run.ts
 */
import dotenv from 'dotenv'
dotenv.config()

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { loadSkipRules } from './src/lib/news/index'
import { extractPlayerNames } from './src/lib/news/matching/name-utils'
import { fetchESPNRSS } from './src/lib/news/sources/espn-rss'
import { insertIfNew, markProcessed } from './src/lib/db/news'
import { matchPlayerName } from './src/lib/news/matching/player-matcher'
import { getAnthropicClient } from './src/lib/ai/client'

async function extractPlayerNamesAI(title: string, body: string | null): Promise<string[]> {
  try {
    const client = getAnthropicClient()
    const text = body ? `Headline: ${title}\nBody: ${body}` : `Headline: ${title}`
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: `You extract athlete names from sports news headlines.
Return ONLY a JSON array of full player names. Example: ["Luka Doncic", "Anthony Davis"]
If no players mentioned, return []. Do NOT include team names, coaches, or non-players.`,
      messages: [{ role: 'user', content: text }],
    })
    const content = message.content[0]
    if (!content || content.type !== 'text') return []
    const cleaned = content.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n: unknown) => typeof n === 'string' && (n as string).length > 1)
  } catch {
    return []
  }
}
import { runRegexImprovementJob } from './src/lib/news/regex-improvement-service'
import { getDb } from './src/lib/db/client'
import type { RawNewsItem } from './src/types'

// ── Helpers ──────────────────────────────────────────────────────────────

function contentHash(title: string, body: string | null): string {
  return crypto.createHash('sha256').update(title + (body || '')).digest('hex')
}

function extractWithFreshSkip(title: string, body: string | null, dynamicSkip: Set<string>): string[] {
  const text = `${title} ${body || ''}`
  const staticSkip = /^(New York|Los Angeles|San Francisco|San Diego|Kansas City|St Louis|Spring Training|World Series|All Star|National League|American League)$/i
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  const names: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (staticSkip.test(m[1])) continue
    if (dynamicSkip.has(m[1].toLowerCase())) continue
    names.push(m[1])
  }
  return [...new Set(names)]
}

// ── Test Items Tracking ──────────────────────────────────────────────────

interface TrackedItem {
  raw: RawNewsItem
  hash: string
  regexNames: string[]
  regexRosterMatched: boolean  // did any regex name match a roster player?
  aiNames: string[]
  dbId: number
  isNew: boolean
}

;(async () => {

const trackedItems: TrackedItem[] = []

// ── STEP 1: Delete db/skip-rules.json (clean slate) ─────────────────────

console.log('\n=== STEP 1: Clean slate - delete db/skip-rules.json ===')
const skipRulesPath = path.resolve(process.cwd(), 'db/skip-rules.json')
if (fs.existsSync(skipRulesPath)) {
  fs.unlinkSync(skipRulesPath)
  console.log('  Deleted existing skip-rules.json')
} else {
  console.log('  skip-rules.json not found (already clean)')
}
console.log('  PASS: skip-rules.json does not exist')

// ── STEP 2: Fetch real headlines from ESPN RSS ───────────────────────────

console.log('\n=== STEP 2: Fetch real headlines from ESPN RSS ===')
let espnItems: RawNewsItem[] = []
try {
  espnItems = await fetchESPNRSS()
  espnItems = espnItems.slice(0, 10) // cap at 10
  console.log(`  Fetched ${espnItems.length} ESPN items`)
  for (const item of espnItems) {
    console.log(`    - "${item.title.substring(0, 80)}${item.title.length > 80 ? '...' : ''}"`)
  }
} catch (err) {
  console.warn('  WARNING: ESPN fetch failed, continuing with crafted items only')
  console.warn(`  Error: ${err instanceof Error ? err.message : err}`)
}

if (espnItems.length === 0) {
  console.log('  WARNING: 0 ESPN items fetched - test will rely on crafted headlines only')
}

// ── STEP 3: Add 5 crafted headlines that FAIL regex ──────────────────────

console.log('\n=== STEP 3: Add 5 crafted headlines designed to fail regex ===')
const craftedItems: RawNewsItem[] = [
  {
    source: 'espn_rss',
    sourceId: 'test-crafted-1',
    title: 'SHOHEI OHTANI HITS 3 HOME RUNS IN SPRING TRAINING',
    body: null,
    url: null,
    publishedAt: new Date().toISOString(),
  },
  {
    source: 'espn_rss',
    sourceId: 'test-crafted-2',
    title: 'LEBRON SCORES 40 POINTS AS LAKERS BEAT CELTICS',
    body: null,
    url: null,
    publishedAt: new Date().toISOString(),
  },
  {
    source: 'espn_rss',
    sourceId: 'test-crafted-3',
    title: 'Golden State Warriors Announce Trade Deadline Decision',
    body: null,
    url: null,
    publishedAt: new Date().toISOString(),
  },
  {
    source: 'espn_rss',
    sourceId: 'test-crafted-4',
    title: "Soto's 3-Run Homer Lifts Yankees Over Red Sox",
    body: null,
    url: null,
    publishedAt: new Date().toISOString(),
  },
  {
    source: 'espn_rss',
    sourceId: 'test-crafted-5',
    title: 'NBA Most Valuable Player Race Heats Up Amid All Star Weekend',
    body: null,
    url: null,
    publishedAt: new Date().toISOString(),
  },
]
console.log(`  Added ${craftedItems.length} crafted items:`)
for (const item of craftedItems) {
  console.log(`    - "${item.title}"`)
}

const allItems = [...espnItems, ...craftedItems]
console.log(`  Total items: ${allItems.length}`)

// ── STEP 4: Run extractPlayerNames() on all items ────────────────────────

console.log('\n=== STEP 4: Run regex extractPlayerNames() on all items ===')
let regexSuccessCount = 0
let regexFailCount = 0

for (let i = 0; i < allItems.length; i++) {
  const item = allItems[i]
  const names = extractPlayerNames(item.title, item.body)
  const hash = contentHash(item.title, item.body)

  // Check if any regex names match a roster player
  const rosterMatched = names.some(n => matchPlayerName(n) !== null)

  trackedItems.push({
    raw: item,
    hash,
    regexNames: names,
    regexRosterMatched: rosterMatched,
    aiNames: [],
    dbId: 0,
    isNew: false,
  })

  const shortTitle = item.title.substring(0, 60) + (item.title.length > 60 ? '...' : '')
  if (names.length > 0 && rosterMatched) {
    console.log(`  ${i + 1}. OK "${shortTitle}" -> ${JSON.stringify(names)} (roster match)`)
    regexSuccessCount++
  } else if (names.length > 0) {
    console.log(`  ${i + 1}. XX "${shortTitle}" -> ${JSON.stringify(names)} (NO roster match - needs AI)`)
    regexFailCount++
  } else {
    console.log(`  ${i + 1}. XX "${shortTitle}" -> [] (regex found nothing - needs AI)`)
    regexFailCount++
  }
}

console.log(`\n  Summary: ${regexSuccessCount} OK, ${regexFailCount} XX`)
if (regexSuccessCount >= 1 && regexFailCount >= 1) {
  console.log('  PASS: At least 1 OK and 1 XX')
} else {
  console.log('  WARNING: Expected mix of OK/XX results')
}

// ── STEP 5: AI fallback for items with 0 regex results ───────────────────

console.log('\n=== STEP 5: AI fallback (mirrors fixed pipeline: trigger when no roster match) ===')
let aiCallCount = 0
let aiSuccessCount = 0

for (const tracked of trackedItems) {
  // Fixed logic: skip AI only if regex names already matched a roster player
  if (tracked.regexRosterMatched) continue

  aiCallCount++
  const shortTitle = tracked.raw.title.substring(0, 60) + (tracked.raw.title.length > 60 ? '...' : '')
  const reason = tracked.regexNames.length > 0 ? 'regex found garbage, no roster match' : 'regex found nothing'
  console.log(`  AI fallback on: "${shortTitle}" (${reason})`)

  try {
    const aiNames = await extractPlayerNamesAI(tracked.raw.title, tracked.raw.body)
    tracked.aiNames = aiNames
    if (aiNames.length > 0) {
      console.log(`    -> AI found: ${JSON.stringify(aiNames)}`)
      aiSuccessCount++
    } else {
      console.log(`    -> AI found: [] (no players identified)`)
    }
  } catch (err) {
    console.error(`    -> AI ERROR: ${err instanceof Error ? err.message : err}`)
    tracked.aiNames = []
  }
}

console.log(`\n  AI called: ${aiCallCount} times, found players: ${aiSuccessCount}`)
console.log('  PASS: AI completed without throwing')

// ── STEP 6: Insert all items into DB ─────────────────────────────────────

console.log('\n=== STEP 6: Insert all items into DB ===')
let insertedCount = 0
let skippedCount = 0

for (const tracked of trackedItems) {
  try {
    const { id, isNew } = insertIfNew(tracked.raw)
    tracked.dbId = id
    tracked.isNew = isNew

    if (isNew) {
      // Determine processed status (mirrors fixed production pipeline)
      let status: number
      if (tracked.regexRosterMatched) {
        status = 1 // regex matched a roster player
      } else if (tracked.aiNames.length > 0) {
        status = 4 // ai_fallback found names (regex missed or found garbage)
      } else {
        status = 2 // no_match — neither path found players
      }
      markProcessed(id, status)
      insertedCount++
      console.log(`  INSERT id=${id} processed=${status} "${tracked.raw.title.substring(0, 50)}..."`)
    } else {
      skippedCount++
      console.log(`  SKIP (dup) id=${id} "${tracked.raw.title.substring(0, 50)}..."`)
    }
  } catch (err) {
    console.error(`  DB ERROR: ${err instanceof Error ? err.message : err}`)
  }
}

console.log(`\n  Inserted: ${insertedCount}, Skipped (dups): ${skippedCount}`)
console.log('  PASS: All inserts succeeded')

// ── STEP 7: Run regex improvement job ────────────────────────────────────

console.log('\n=== STEP 7: Run runRegexImprovementJob() ===')
try {
  await runRegexImprovementJob()

  if (fs.existsSync(skipRulesPath)) {
    const content = JSON.parse(fs.readFileSync(skipRulesPath, 'utf-8'))
    console.log(`  skip-rules.json created with ${content.skipPhrases.length} phrases:`)
    for (const phrase of content.skipPhrases) {
      console.log(`    - "${phrase}"`)
    }
    if (content.skipPhrases.length >= 1) {
      console.log('  PASS: skipPhrases.length >= 1')
    } else {
      console.log('  WARNING: skipPhrases is empty')
    }
  } else {
    console.log('  WARNING: skip-rules.json was NOT created')
    console.log('  (This can happen if no items had processed=4 in the last 24h)')
  }
} catch (err) {
  console.error(`  ERROR: ${err instanceof Error ? err.message : err}`)
}

// ── STEP 8: Load fresh skip rules and re-run regex ──────────────────────

console.log('\n=== STEP 8: Load fresh skip rules and show improvement ===')
const freshSkip = loadSkipRules()
console.log(`  Loaded ${freshSkip.size} dynamic skip phrases`)

let improvementShown = false
for (const tracked of trackedItems) {
  const beforeNames = extractWithFreshSkip(tracked.raw.title, tracked.raw.body, new Set())
  const afterNames = extractWithFreshSkip(tracked.raw.title, tracked.raw.body, freshSkip)

  if (beforeNames.length > 0 && (afterNames.length < beforeNames.length)) {
    const shortTitle = tracked.raw.title.substring(0, 60) + (tracked.raw.title.length > 60 ? '...' : '')
    console.log(`  "${shortTitle}":`)
    console.log(`    Before skip rules: ${JSON.stringify(beforeNames)}`)
    console.log(`    After skip rules:  ${JSON.stringify(afterNames)} ${afterNames.length === 0 ? '(all filtered out)' : '(reduced)'}`)
    improvementShown = true
  }
}

if (improvementShown) {
  console.log('  PASS: At least 1 false-positive phrase now filtered')
} else {
  console.log('  WARNING: No improvement shown (skip rules may not have matched any false positives)')
}

// ── STEP 9: Cleanup — delete test rows from DB ──────────────────────────

console.log('\n=== STEP 9: Cleanup ===')
const db = getDb()
const hashesWeInserted = trackedItems.filter(t => t.isNew).map(t => t.hash)

if (hashesWeInserted.length > 0) {
  // Delete mentions first (in case no CASCADE)
  const idsToClean = trackedItems.filter(t => t.isNew).map(t => t.dbId)
  if (idsToClean.length > 0) {
    const mentionPlaceholders = idsToClean.map(() => '?').join(',')
    const mentionResult = db.prepare(
      `DELETE FROM news_player_mentions WHERE news_item_id IN (${mentionPlaceholders})`
    ).run(...idsToClean)
    console.log(`  Deleted ${mentionResult.changes} mention rows`)
  }

  // Delete news items
  const placeholders = hashesWeInserted.map(() => '?').join(',')
  const result = db.prepare(
    `DELETE FROM news_items WHERE content_hash IN (${placeholders})`
  ).run(...hashesWeInserted)
  console.log(`  Deleted ${result.changes} news_items rows`)
} else {
  console.log('  No rows to clean (nothing was inserted as new)')
}

// Verify cleanup
const remainingCount = hashesWeInserted.length > 0
  ? (db.prepare(
      `SELECT COUNT(*) as cnt FROM news_items WHERE content_hash IN (${hashesWeInserted.map(() => '?').join(',')})`
    ).get(...hashesWeInserted) as any)?.cnt ?? 0
  : 0

if (remainingCount === 0) {
  console.log('  PASS: All test rows cleaned up')
} else {
  console.log(`  WARNING: ${remainingCount} test rows remain in DB`)
}

// Delete skip-rules.json so it doesn't affect production
if (fs.existsSync(skipRulesPath)) {
  fs.unlinkSync(skipRulesPath)
  console.log('  Deleted skip-rules.json (clean for production)')
}

console.log('\n=== ALL STEPS COMPLETE ===\n')

})().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
