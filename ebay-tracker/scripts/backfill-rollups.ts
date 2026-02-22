/**
 * One-time backfill script for price_rollups (D2a Historical Archive).
 *
 * Run after applying migration 003_price_rollups.sql to populate rollups
 * from all existing price_snapshots history.
 *
 * Usage:
 *   npx tsx scripts/backfill-rollups.ts
 *
 * The script is safe to run while the server is live: it reads from
 * price_snapshots and writes to price_rollups with no overlap with the
 * sync process.
 *
 * Estimated runtime: 4–8 minutes for 200 items × 6 months of history.
 */

import 'dotenv/config'
import { runMigrations } from '../src/lib/db/migrate'
import { backfillAllRollups } from '../src/lib/archive/rollup-service'

async function main() {
  console.log('[backfill] Running migrations to ensure schema is current...')
  runMigrations()

  console.log('[backfill] Starting price rollup backfill...')
  await backfillAllRollups()

  console.log('[backfill] Done.')
  process.exit(0)
}

main().catch(err => {
  console.error('[backfill] Fatal error:', err)
  process.exit(1)
})
