-- 004_news_pipeline.sql
-- Player news signal pipeline: roster, card mapping, news ingestion, signals

-- Active MLB players from StatsAPI (weekly refresh)
CREATE TABLE IF NOT EXISTS player_roster (
  id INTEGER PRIMARY KEY,          -- MLB player ID
  full_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  team TEXT,
  team_id INTEGER,
  active INTEGER DEFAULT 1,
  sport TEXT DEFAULT 'baseball',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_roster_name ON player_roster(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_roster_team ON player_roster(team_id);

-- eBay title -> roster player mapping (cached, one-time parse per item)
CREATE TABLE IF NOT EXISTS card_player_mapping (
  item_id TEXT PRIMARY KEY REFERENCES items(item_id),
  player_id INTEGER REFERENCES player_roster(id),
  player_name TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  mapped_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mapping_player ON card_player_mapping(player_id);

-- Raw ingested news with content_hash dedup
CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,              -- 'mlb_transactions' | 'rotowire_rss' | 'google_news_rss'
  source_id TEXT,                    -- original item GUID/ID
  content_hash TEXT NOT NULL UNIQUE, -- SHA-256 for dedup
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  published_at TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  processed INTEGER DEFAULT 0        -- 0=pending, 1=matched, 2=no_match, 3=error
);

CREATE INDEX IF NOT EXISTS idx_news_processed ON news_items(processed, fetched_at);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_items(source, fetched_at DESC);

-- Many-to-many: news item <-> player(s) mentioned
CREATE TABLE IF NOT EXISTS news_player_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_item_id INTEGER NOT NULL REFERENCES news_items(id),
  player_id INTEGER NOT NULL REFERENCES player_roster(id),
  confidence REAL NOT NULL DEFAULT 0,
  UNIQUE(news_item_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_player ON news_player_mentions(player_id);

-- Scored signals per card per news item (final output)
CREATE TABLE IF NOT EXISTS card_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_item_id INTEGER NOT NULL REFERENCES news_items(id),
  item_id TEXT NOT NULL REFERENCES items(item_id),
  player_id INTEGER NOT NULL REFERENCES player_roster(id),
  event_type TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN -3 AND 3),
  confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  headline TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  acknowledged INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(news_item_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_item ON card_signals(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_score ON card_signals(score, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_acknowledged ON card_signals(acknowledged, created_at DESC);

-- Circuit breaker state per source (persisted)
CREATE TABLE IF NOT EXISTS source_health (
  source TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_failure_at TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  circuit_open INTEGER DEFAULT 0,
  circuit_open_until TEXT,
  last_error TEXT
);

-- Seed source health rows
INSERT OR IGNORE INTO source_health (source) VALUES ('mlb_transactions');
INSERT OR IGNORE INTO source_health (source) VALUES ('rotowire_rss');
INSERT OR IGNORE INTO source_health (source) VALUES ('google_news_rss');
