import cron from 'node-cron'
import { runSync, isSyncing } from './sync/sync-service'
import { runNightlyRollup } from './archive/rollup-service'
import { runSourceIngestion } from './news/index'
import { initRosterIfEmpty } from './news/matching/roster-sync'
import { syncRoster } from './news/matching/roster-sync'
import { deleteExpired } from './db/signals'
import type { AppConfig } from './config'
import { hasEbayCredentials } from './config'

export async function startScheduler(config: AppConfig): Promise<void> {
  // --- News pipeline crons (no eBay credentials needed) ---

  // Initialize roster on first boot if empty
  try {
    await initRosterIfEmpty()
  } catch (err) {
    console.error('Initial roster sync failed (will retry on schedule):', err)
  }

  // RotoWire RSS: every 10 min, 2-min offset from eBay sync
  cron.schedule('2,12,22,32,42,52 * * * *', async () => {
    try {
      await runSourceIngestion('rotowire_rss')
    } catch (err) {
      console.error('RotoWire ingestion failed:', err)
    }
  })

  // MLB Transactions: every 30 min, 4-min offset
  cron.schedule('4,34 * * * *', async () => {
    try {
      await runSourceIngestion('mlb_transactions')
    } catch (err) {
      console.error('MLB transactions ingestion failed:', err)
    }
  })

  // Google News RSS: every 30 min, 8-min offset
  cron.schedule('8,38 * * * *', async () => {
    try {
      await runSourceIngestion('google_news_rss')
    } catch (err) {
      console.error('Google News ingestion failed:', err)
    }
  })

  // ESPN RSS: every 30 min, 6-min offset
  cron.schedule('6,36 * * * *', async () => {
    try {
      await runSourceIngestion('espn_rss')
    } catch (err) {
      console.error('ESPN RSS ingestion failed:', err)
    }
  })

  // Roster sync: weekly Monday 2am
  cron.schedule('0 2 * * 1', async () => {
    console.log('Weekly roster sync starting...')
    try {
      await syncRoster()
    } catch (err) {
      console.error('Weekly roster sync failed:', err)
    }
  })

  // Signal cleanup: daily 3am, deletes expired signals
  cron.schedule('0 3 * * *', () => {
    try {
      const deleted = deleteExpired()
      if (deleted > 0) {
        console.log(`[Signals] Cleaned up ${deleted} expired signals`)
      }
    } catch (err) {
      console.error('Signal cleanup failed:', err)
    }
  })

  console.log('News pipeline scheduler started: RotoWire(10m), MLB(30m), Google(30m), ESPN(30m), Roster(weekly), Cleanup(daily)')

  // --- eBay sync crons (require credentials) ---

  if (!hasEbayCredentials(config)) {
    console.log('eBay sync disabled: credentials not configured')
    return
  }

  const intervalMinutes = config.SYNC_INTERVAL_MINUTES
  const cronExpression = `*/${intervalMinutes} * * * *`

  cron.schedule(cronExpression, async () => {
    if (isSyncing()) {
      console.log('Sync already in progress, skipping scheduled sync')
      return
    }

    console.log('Scheduled sync starting...')
    try {
      await runSync()
    } catch (err) {
      console.error('Scheduled sync failed:', err)
    }
  })

  console.log(`eBay sync scheduler started: syncing every ${intervalMinutes} minutes`)

  // Daily rollup at 00:05 UTC — runs after the midnight sync completes
  cron.schedule('5 0 * * *', async () => {
    console.log('Nightly rollup starting...')
    try {
      await runNightlyRollup()
    } catch (err) {
      console.error('Nightly rollup failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('Rollup scheduler started: daily at 00:05 UTC')
}
