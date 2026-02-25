/**
 * CardHedger API — Full data extraction script.
 *
 * Pulls EVERYTHING from the CardHedger Unlimited API Elite plan:
 *   - Daily CSV price exports (365 days)
 *   - Full card catalog (all sports/categories)
 *   - Comparable sales for every card
 *   - 365-day price history for every card
 *   - All-grades prices for every card
 *   - 90-day grade-level search prices
 *   - Top movers snapshot
 *   - Price updates (7-day delta)
 *   - Batch AI price estimates
 *
 * Usage:
 *   npx tsx scripts/cardhedger-extract.ts [--step csv|catalog|comps|prices|grades|90day|movers|updates|estimates|all]
 *
 * Resume-safe: skips files that already exist on disk.
 */

import 'dotenv/config'
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs'
import { join } from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = 'https://api.cardhedger.com'
const API_KEY = process.env.CARDHEDGER_API_KEY
if (!API_KEY) {
  console.error('[ch] CARDHEDGER_API_KEY not set in .env')
  process.exit(1)
}

const DATA_DIR = join(__dirname, '..', 'data', 'cardhedger')
const PROGRESS_FILE = join(DATA_DIR, 'progress.json')
const CONCURRENCY = 10       // high concurrency since API has ~60s latency
const STAGGER_MS = 50
const FETCH_TIMEOUT_MS = 120_000  // 2 min per request (API can take 60s+)

const CATEGORIES = [
  'baseball', 'basketball', 'football', 'hockey',
  'soccer', 'pokemon', 'non-sport',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function fileExists(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).size > 0
  } catch {
    return false
  }
}

function dirSize(dir: string): string {
  if (!existsSync(dir)) return '0 B'
  let total = 0
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else total += statSync(p).size
    }
  }
  walk(dir)
  if (total < 1024) return `${total} B`
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`
  if (total < 1024 * 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`
  return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function loadProgress(): Record<string, unknown> {
  if (fileExists(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
  }
  return {}
}

function saveProgress(data: Record<string, unknown>) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2))
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ─── API Client ──────────────────────────────────────────────────────────────

let backingOff = false

async function ch(path: string, body?: Record<string, unknown>): Promise<unknown> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'X-API-Key': API_KEY!,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (res.status === 429) {
    backingOff = true
    throw new Error('RATE_LIMITED')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CH ${res.status}: ${text.slice(0, 500)}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('json') ? res.json() : res.text()
}

/** Run tasks with bounded concurrency + stagger. Auto-backs off on 429. */
async function pooled<T>(
  items: T[],
  fn: (item: T, idx: number) => Promise<void>,
  label: string,
) {
  let concurrent = CONCURRENCY
  let completed = 0
  let failed = 0
  const failures: { item: T; error: string }[] = []
  const total = items.length

  const log = () =>
    process.stdout.write(`\r[${label}] ${completed}/${total} done, ${failed} failed`)

  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      const item = items[i]
      await sleep(STAGGER_MS)
      try {
        await fn(item, i)
        completed++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        failed++
        failures.push({ item, error: msg })

        if (msg === 'RATE_LIMITED') {
          console.warn(`\n[${label}] Rate limited — backing off 5s, reducing concurrency to 1`)
          concurrent = 1
          await sleep(5000)
          backingOff = false
        }
      }
      log()
    }
  }

  // Launch worker pool
  const workers: Promise<void>[] = []
  for (let w = 0; w < concurrent; w++) {
    workers.push(worker())
  }
  await Promise.allSettled(workers)
  console.log() // newline after progress

  if (failures.length > 0) {
    console.log(`[${label}] ${failures.length} failures:`)
    for (const f of failures.slice(0, 20)) {
      console.log(`  - ${JSON.stringify(f.item).slice(0, 80)}: ${f.error}`)
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`)
  }
}

// ─── Step 1: Daily CSV Exports ───────────────────────────────────────────────

async function stepCsv() {
  console.log('\n=== Step 1: Daily CSV Exports (365 days) ===')
  const dir = join(DATA_DIR, 'csv')
  ensureDir(dir)

  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  await pooled(dates, async (date) => {
    const file = join(dir, `${date}.csv`)
    if (fileExists(file)) return

    try {
      const data = await ch(`/v1/download/daily-price-export/${date}`)
      writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Some dates may not have exports (weekends, holidays) — log but don't fail
      if (msg.includes('404')) return
      throw err
    }
  }, 'csv')

  console.log(`[csv] Disk usage: ${dirSize(dir)}`)
}

// ─── Step 2: Full Card Catalog ───────────────────────────────────────────────

async function fetchCategory(category: string, dir: string): Promise<string[]> {
  const ids: string[] = []
  let page = 1
  let hasMore = true
  let retries = 0

  while (hasMore) {
    const file = join(dir, `${category}-page-${page}.json`)

    let data: any
    if (fileExists(file)) {
      data = JSON.parse(readFileSync(file, 'utf-8'))
    } else {
      try {
        data = await ch('/v1/cards/card-search', {
          category,
          page,
          page_size: 100,
        })
        writeFileSync(file, JSON.stringify(data, null, 2))
        await sleep(STAGGER_MS)
        retries = 0
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (retries < 3 && (msg.includes('timeout') || msg.includes('RATE_LIMITED') || msg.includes('502') || msg.includes('503'))) {
          retries++
          console.warn(`[catalog:${category}] Retry ${retries}/3 on page ${page}: ${msg}`)
          await sleep(2000 * retries)
          continue
        }
        console.warn(`[catalog:${category}] Stopping at page ${page}: ${msg}`)
        hasMore = false
        break
      }
    }

    const cards: any[] = data?.cards ?? data?.results ?? data?.data ?? []
    if (Array.isArray(cards)) {
      for (const c of cards) {
        const id = c.card_id ?? c.id
        if (id) ids.push(String(id))
      }
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      hasMore = false
    } else if (cards.length < 100) {
      hasMore = false
    } else {
      page++
    }

    if (page % 100 === 0) {
      console.log(`[catalog:${category}] page ${page}, ${ids.length} cards`)
    }
  }

  console.log(`[catalog:${category}] DONE — ${page - 1} pages, ${ids.length} cards`)
  return ids
}

async function stepCatalog(): Promise<string[]> {
  console.log('\n=== Step 2: Full Card Catalog (all categories IN PARALLEL) ===')
  const dir = join(DATA_DIR, 'catalog')
  ensureDir(dir)

  // Run ALL categories in parallel
  const results = await Promise.allSettled(
    CATEGORIES.map(cat => fetchCategory(cat, dir))
  )

  const idSet = new Set<string>()
  for (let i = 0; i < CATEGORIES.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      console.log(`[catalog] ${CATEGORIES[i]}: ${r.value.length} cards`)
      for (const id of r.value) idSet.add(id)
    } else {
      console.error(`[catalog] ${CATEGORIES[i]}: FAILED — ${r.reason}`)
    }
  }

  // Save master card ID list (Array.from to avoid stack overflow on large sets)
  const idFile = join(DATA_DIR, 'all-card-ids.json')
  const unique = Array.from(idSet)
  writeFileSync(idFile, JSON.stringify(unique))
  console.log(`[catalog] Total unique card IDs: ${unique.length}`)
  console.log(`[catalog] Disk usage: ${dirSize(dir)}`)

  return unique
}

function loadCardIds(): string[] {
  const file = join(DATA_DIR, 'all-card-ids.json')
  if (fileExists(file)) {
    return JSON.parse(readFileSync(file, 'utf-8'))
  }
  console.error('[error] No card IDs found. Run --step catalog first.')
  process.exit(1)
}

// ─── Step 3: Comparable Sales ────────────────────────────────────────────────

async function stepComps(cardIds?: string[]) {
  console.log('\n=== Step 3: Comparable Sales (all cards) ===')
  const dir = join(DATA_DIR, 'comps')
  ensureDir(dir)

  const ids = cardIds ?? loadCardIds()
  console.log(`[comps] Processing ${ids.length} cards...`)

  await pooled(ids, async (cardId) => {
    const file = join(dir, `${cardId}.json`)
    if (fileExists(file)) return

    const data = await ch('/v1/cards/comps', {
      card_id: cardId,
      include_raw_prices: true,
      count: 100,
      grade: 'all',
    })
    writeFileSync(file, JSON.stringify(data))
  }, 'comps')

  console.log(`[comps] Disk usage: ${dirSize(dir)}`)
}

// ─── Step 4: Price History ───────────────────────────────────────────────────

async function stepPrices(cardIds?: string[]) {
  console.log('\n=== Step 4: Price History — 365 days (all cards) ===')
  const dir = join(DATA_DIR, 'prices')
  ensureDir(dir)

  const ids = cardIds ?? loadCardIds()
  console.log(`[prices] Processing ${ids.length} cards...`)

  await pooled(ids, async (cardId) => {
    const file = join(dir, `${cardId}.json`)
    if (fileExists(file)) return

    const data = await ch('/v1/cards/prices-by-card', {
      card_id: cardId,
      days: 365,
      grade: 'Raw',
    })
    writeFileSync(file, JSON.stringify(data))
  }, 'prices')

  console.log(`[prices] Disk usage: ${dirSize(dir)}`)
}

// ─── Step 5: All Prices By Grade ─────────────────────────────────────────────

async function stepGrades(cardIds?: string[]) {
  console.log('\n=== Step 5: All Prices By Grade (all cards) ===')
  const dir = join(DATA_DIR, 'grades')
  ensureDir(dir)

  const ids = cardIds ?? loadCardIds()
  console.log(`[grades] Processing ${ids.length} cards...`)

  await pooled(ids, async (cardId) => {
    const file = join(dir, `${cardId}.json`)
    if (fileExists(file)) return

    const data = await ch('/v1/cards/all-prices-by-card', {
      card_id: cardId,
    })
    writeFileSync(file, JSON.stringify(data))
  }, 'grades')

  console.log(`[grades] Disk usage: ${dirSize(dir)}`)
}

// ─── Step 6: 90-Day Grade Prices ─────────────────────────────────────────────

async function step90day() {
  console.log('\n=== Step 6: 90-Day Grade Prices (by category) ===')
  const dir = join(DATA_DIR, '90day')
  ensureDir(dir)

  for (const category of CATEGORIES) {
    const file = join(dir, `${category}.json`)
    if (fileExists(file)) {
      console.log(`[90day] ${category} — already exists, skipping`)
      continue
    }

    console.log(`[90day] Fetching ${category}...`)
    try {
      const data = await ch('/v1/cards/90day-prices-by-grade-search', {
        category,
        page_size: 100,
      })
      writeFileSync(file, JSON.stringify(data, null, 2))
      await sleep(STAGGER_MS)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[90day] Error on ${category}: ${msg}`)
    }
  }

  console.log(`[90day] Disk usage: ${dirSize(dir)}`)
}

// ─── Step 7: Top Movers ──────────────────────────────────────────────────────

async function stepMovers() {
  console.log('\n=== Step 7: Top Movers Snapshot ===')
  const file = join(DATA_DIR, 'top-movers.json')

  if (fileExists(file)) {
    console.log('[movers] Already exists, skipping')
    return
  }

  const data = await ch('/v1/cards/top-movers')
  writeFileSync(file, JSON.stringify(data, null, 2))
  console.log('[movers] Saved.')
}

// ─── Step 8: Price Updates (Delta) ───────────────────────────────────────────

async function stepUpdates() {
  console.log('\n=== Step 8: Price Updates (7-day delta) ===')
  const file = join(DATA_DIR, 'price-updates.json')

  if (fileExists(file)) {
    console.log('[updates] Already exists, skipping')
    return
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const data = await ch('/v1/cards/price-updates', {
    since: sevenDaysAgo.toISOString().split('T')[0],
  })
  writeFileSync(file, JSON.stringify(data, null, 2))
  console.log('[updates] Saved.')
}

// ─── Step 9: Batch Price Estimates ───────────────────────────────────────────

async function stepEstimates(cardIds?: string[]) {
  console.log('\n=== Step 9: Batch AI Price Estimates ===')
  const dir = join(DATA_DIR, 'estimates')
  ensureDir(dir)

  const ids = cardIds ?? loadCardIds()
  const batchSize = 100
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize))
  }

  console.log(`[estimates] ${ids.length} cards in ${batches.length} batches of ${batchSize}`)

  await pooled(batches, async (batch, batchIdx) => {
    const file = join(dir, `batch-${batchIdx}.json`)
    if (fileExists(file)) return

    const data = await ch('/v1/cards/batch-price-estimate', {
      items: batch.map(card_id => ({ card_id, grade: 'Raw' })),
    })
    writeFileSync(file, JSON.stringify(data))
  }, 'estimates')

  console.log(`[estimates] Disk usage: ${dirSize(dir)}`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const stepIdx = args.indexOf('--step')
  const step = stepIdx >= 0 ? args[stepIdx + 1] : 'all'

  console.log(`[cardhedger] Starting extraction — step: ${step}`)
  console.log(`[cardhedger] Data directory: ${DATA_DIR}`)
  ensureDir(DATA_DIR)

  const progress = loadProgress()
  const startTime = Date.now()

  let cardIds: string[] | undefined

  if (step === 'all' || step === 'csv') {
    await stepCsv()
    progress.csv = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'catalog') {
    cardIds = await stepCatalog()
    progress.catalog = 'done'
    progress.card_count = cardIds.length
    saveProgress(progress)
  }

  // For per-card steps, load IDs if not already in memory
  if (['all', 'comps', 'prices', 'grades', 'estimates'].includes(step) && !cardIds) {
    cardIds = loadCardIds()
  }

  if (step === 'all' || step === 'comps') {
    await stepComps(cardIds)
    progress.comps = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'prices') {
    await stepPrices(cardIds)
    progress.prices = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'grades') {
    await stepGrades(cardIds)
    progress.grades = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === '90day') {
    await step90day()
    progress['90day'] = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'movers') {
    await stepMovers()
    progress.movers = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'updates') {
    await stepUpdates()
    progress.updates = 'done'
    saveProgress(progress)
  }

  if (step === 'all' || step === 'estimates') {
    await stepEstimates(cardIds)
    progress.estimates = 'done'
    saveProgress(progress)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n[cardhedger] Complete in ${elapsed}s`)
  console.log(`[cardhedger] Total disk usage: ${dirSize(DATA_DIR)}`)
  saveProgress(progress)
}

main().catch(err => {
  console.error('[cardhedger] Fatal error:', err)
  process.exit(1)
})
