-- Widen exchange rate precision to handle all treasury rates
-- Previous: Decimal(12,6) max integer part = 999,999
-- New: Decimal(18,8) max integer part = 9,999,999,999

ALTER TABLE "ForeignAccount" ALTER COLUMN "exchangeRate" TYPE DECIMAL(18,8);
ALTER TABLE "ExchangeRate" ALTER COLUMN "rate" TYPE DECIMAL(18,8);
