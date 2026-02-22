CREATE TABLE card_metadata (
  item_id           TEXT PRIMARY KEY REFERENCES items(item_id) ON DELETE CASCADE,

  -- Identity
  player_name       TEXT,
  year              INTEGER,
  brand             TEXT,
  set_name          TEXT,
  parallel          TEXT,
  card_number       TEXT,

  -- Special attributes (stored as 0/1 INTEGER — SQLite has no BOOLEAN)
  is_rookie         INTEGER DEFAULT 0,
  is_auto           INTEGER DEFAULT 0,
  is_patch          INTEGER DEFAULT 0,
  is_relic          INTEGER DEFAULT 0,

  -- Grading
  grading_company   TEXT,       -- 'PSA' | 'BGS' | 'SGC' | NULL
  grade_value       TEXT,       -- '10' | '9.5' | '8' etc. (TEXT to support decimals)

  -- Numbering
  print_run         INTEGER,    -- serial denominator, e.g. 99 for /99
  serial_number     INTEGER,    -- specific copy number if present, e.g. 42 for 42/99

  -- Context
  sport             TEXT,
  team              TEXT,

  -- Parse metadata
  parse_model       TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  parse_confidence  REAL,       -- 0.0–1.0, model self-reported
  parse_error       TEXT,       -- non-NULL if last parse attempt failed
  parsed_at         TEXT DEFAULT (datetime('now')),
  title_at_parse    TEXT        -- snapshot of title when parsed; detect stale parses
);

CREATE INDEX idx_metadata_player    ON card_metadata(player_name);
CREATE INDEX idx_metadata_year      ON card_metadata(year);
CREATE INDEX idx_metadata_brand     ON card_metadata(brand);
CREATE INDEX idx_metadata_grading   ON card_metadata(grading_company, grade_value);
CREATE INDEX idx_metadata_print_run ON card_metadata(print_run);
CREATE INDEX idx_metadata_rookie    ON card_metadata(is_rookie);
CREATE INDEX idx_metadata_auto      ON card_metadata(is_auto);
CREATE INDEX idx_metadata_parsed_at ON card_metadata(parsed_at);
