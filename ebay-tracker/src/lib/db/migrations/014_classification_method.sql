-- Add classification method to track keyword vs AI classification
ALTER TABLE news_items ADD COLUMN classification_method TEXT DEFAULT NULL;
-- Values: 'keyword', 'ai', NULL (unclassified)
