CREATE TABLE price_targets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id               TEXT NOT NULL REFERENCES items(item_id),
  target_type           TEXT NOT NULL CHECK (target_type IN ('buy_below', 'sell_above')),
  target_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'triggered', 'acknowledged', 'deactivated')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  triggered_at          TEXT,
  triggered_price_cents INTEGER,
  acknowledged_at       TEXT
);

CREATE INDEX idx_targets_item   ON price_targets(item_id);
CREATE INDEX idx_targets_status ON price_targets(status);
