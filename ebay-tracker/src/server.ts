import 'dotenv/config'
import next from 'next'
import { createServer } from 'http'
import { parse } from 'url'
import { runMigrations } from './lib/db/migrate'
import { startScheduler } from './lib/scheduler'
import { validateConfig } from './lib/config'

async function main() {
  const config = validateConfig()
  runMigrations()

  const app = next({ dev: config.NODE_ENV !== 'production' })
  await app.prepare()
  const handle = app.getRequestHandler()

  createServer((req, res) => {
    handle(req, res, parse(req.url!, true))
  }).listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`)
    // Fire-and-forget: don't block HTTP server on scheduler init
    startScheduler(config).catch((err) => {
      console.error('Scheduler failed to start:', err)
    })
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...')
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
