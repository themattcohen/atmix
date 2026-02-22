-- 006_fix_fk_references.sql
-- Fix foreign key references: items(id) -> items(item_id)

-- Recreate card_player_mapping with correct FK
CREATE TABLE card_player_mapping_new (
  item_id TEXT PRIMARY KEY REFERENCES items(item_id),
  player_id INTEGER REFERENCES player_roster(id),
  player_name TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  mapped_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO card_player_mapping_new SELECT * FROM card_player_mapping;
DROP TABLE card_player_mapping;
ALTER TABLE card_player_mapping_new RENAME TO card_player_mapping;
CREATE INDEX IF NOT EXISTS idx_mapping_player ON card_player_mapping(player_id);

-- Recreate card_signals with correct FK
CREATE TABLE card_signals_new (
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
INSERT INTO card_signals_new SELECT * FROM card_signals;
DROP TABLE card_signals;
ALTER TABLE card_signals_new RENAME TO card_signals;
CREATE INDEX IF NOT EXISTS idx_signals_item ON card_signals(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_score ON card_signals(score, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_acknowledged ON card_signals(acknowledged, created_at DESC);
