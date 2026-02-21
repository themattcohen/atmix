import fs from 'fs'
import path from 'path'
import { getDb } from './client'

export function runMigrations(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  const migrationsDir = path.join(__dirname, 'migrations')

  // In dev mode via tsx, __dirname points to src/lib/db
  // In prod mode (compiled), __dirname points to dist/lib/db
  // Try both locations
  let resolvedDir = migrationsDir
  if (!fs.existsSync(resolvedDir)) {
    resolvedDir = path.resolve(process.cwd(), 'src/lib/db/migrations')
  }

  if (!fs.existsSync(resolvedDir)) {
    console.warn('No migrations directory found')
    return
  }

  const files = fs.readdirSync(resolvedDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((row: any) => row.name)
  )

  for (const file of files) {
    if (applied.has(file)) continue

    const sql = fs.readFileSync(path.join(resolvedDir, file), 'utf-8')

    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    })()

    console.log(`Applied migration: ${file}`)
  }
}
