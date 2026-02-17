-- AlterTable: widen exchange rate precision for high-value currencies (e.g. VND)
ALTER TABLE "exchange_rates" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(18,6);
