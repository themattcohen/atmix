CREATE TABLE items (
  item_id          TEXT PRIMARY KEY,
  rank             INTEGER UNIQUE,
  title            TEXT NOT NULL,
  current_price    INTEGER NOT NULL,
  buy_it_now_price INTEGER,
  shipping_cost    INTEGER DEFAULT 0,
  listing_type     TEXT NOT NULL,
  condition_name   TEXT,
  end_time         TEXT,
  time_left        TEXT,
  seller_id        TEXT,
  seller_feedback  INTEGER,
  watcher_count    INTEGER,
  bid_count        INTEGER DEFAULT 0,
  image_url        TEXT,
  listing_url      TEXT,
  status           TEXT DEFAULT 'Active',
  is_in_queue      INTEGER DEFAULT 0,
  notes            TEXT,
  first_seen_at    TEXT DEFAULT (datetime('now')),
  last_synced_at   TEXT DEFAULT (datetime('now')),
  removed_at       TEXT
);

CREATE INDEX idx_items_rank ON items(rank);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_end_time ON items(end_time);

CREATE TABLE price_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       TEXT NOT NULL REFERENCES items(item_id),
  price_cents   INTEGER NOT NULL,
  shipping      INTEGER DEFAULT 0,
  watcher_count INTEGER,
  bid_count     INTEGER DEFAULT 0,
  recorded_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_snapshots_item ON price_snapshots(item_id, recorded_at);

CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(item_id),
  event_type  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  detected_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_item ON events(item_id, detected_at);
CREATE INDEX idx_events_type ON events(event_type, detected_at);
