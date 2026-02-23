import cron from 'node-cron'
import { runSync, isSyncing } from './sync/sync-service'
import { runNightlyRollup } from './archive/rollup-service'
import { runSourceIngestion } from './news/index'
import { runRegexImprovementJob } from './news/regex-improvement-service'
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

  // RotoBaller RSS: every 30 min, 14-min offset
  cron.schedule('14,44 * * * *', async () => {
    try {
      await runSourceIngestion('rotoballer_rss')
    } catch (err) {
      console.error('RotoBaller RSS ingestion failed:', err)
    }
  })

  // CBS Sports RSS: every 30 min, 10-min offset
  cron.schedule('10,40 * * * *', async () => {
    try {
      await runSourceIngestion('cbs_sports_rss')
    } catch (err) {
      console.error('CBS Sports RSS ingestion failed:', err)
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

  // Regex improvement: daily 3:30am UTC — analyze AI-fallback items, grow skip list
  cron.schedule('30 3 * * *', async () => {
    try {
      await runRegexImprovementJob()
    } catch (err) {
      console.error('Regex improvement job failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('News pipeline scheduler started: RotoWire(10m), MLB(30m), Google(30m), ESPN(30m), CBS(30m), RotoBaller(30m), Roster(weekly), Cleanup(daily), RegexImprove(daily)')

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
