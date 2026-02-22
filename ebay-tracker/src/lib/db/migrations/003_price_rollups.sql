-- Migration 003: Price rollup table for D2a Historical Archive feature
-- D2a: price_rollups — OHLC aggregations from price_snapshots
-- D2b: comp_rollups is defined in a later migration (blocked on A1)

CREATE TABLE price_rollups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  period_type    TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start   TEXT NOT NULL,  -- ISO date string: 'YYYY-MM-DD' for day/week, 'YYYY-MM-01' for month
  open_cents     INTEGER NOT NULL,  -- price_cents of first snapshot in period
  high_cents     INTEGER NOT NULL,  -- max price_cents in period
  low_cents      INTEGER NOT NULL,  -- min price_cents in period
  close_cents    INTEGER NOT NULL,  -- price_cents of last snapshot in period
  avg_cents      INTEGER NOT NULL,  -- ROUND(AVG(price_cents))
  volume         INTEGER NOT NULL,  -- count of raw snapshots in period
  watcher_low    INTEGER,           -- min watcher_count in period (nullable)
  watcher_close  INTEGER,           -- watcher_count of last snapshot (nullable)
  watcher_high   INTEGER,           -- max watcher_count in period (nullable)
  computed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, period_type, period_start)
);

-- Primary query pattern: item + period_type + date range
CREATE INDEX idx_rollups_item_period ON price_rollups(item_id, period_type, period_start);

-- For bulk backfill and recompute queries
CREATE INDEX idx_rollups_period_start ON price_rollups(period_type, period_start);
