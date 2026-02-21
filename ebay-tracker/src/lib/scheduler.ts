import cron from 'node-cron'
import { runSync, isSyncing } from './sync/sync-service'
import type { AppConfig } from './config'
import { hasEbayCredentials } from './config'

export function startScheduler(config: AppConfig): void {
  if (!hasEbayCredentials(config)) {
    console.log('Scheduler disabled: eBay credentials not configured')
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

  console.log(`Scheduler started: syncing every ${intervalMinutes} minutes`)
}
