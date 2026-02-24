CREATE INDEX IF NOT EXISTS idx_roster_lastname_sport
  ON player_roster(last_name COLLATE NOCASE, sport);
CREATE INDEX IF NOT EXISTS idx_roster_fullname_sport
  ON player_roster(full_name COLLATE NOCASE, sport);
ALTER TABLE news_items ADD COLUMN sport TEXT;
