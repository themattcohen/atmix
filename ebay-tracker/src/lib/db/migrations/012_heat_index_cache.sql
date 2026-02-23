-- Cache heat index computation results on items table
ALTER TABLE items ADD COLUMN heat_score INTEGER;
ALTER TABLE items ADD COLUMN heat_tier TEXT;
ALTER TABLE items ADD COLUMN heat_watcher_delta INTEGER;
ALTER TABLE items ADD COLUMN heat_watcher_trend TEXT;
ALTER TABLE items ADD COLUMN heat_computed_at TEXT;
