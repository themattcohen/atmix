-- 011_news_event_classification.sql
-- Store event classification directly on news_items so all roster-matched news
-- shows EVENT/SCORE/KEYWORD columns on /news page, not just card-matched items.

ALTER TABLE news_items ADD COLUMN event_type TEXT;
ALTER TABLE news_items ADD COLUMN event_score INTEGER;
ALTER TABLE news_items ADD COLUMN matched_keyword TEXT;
