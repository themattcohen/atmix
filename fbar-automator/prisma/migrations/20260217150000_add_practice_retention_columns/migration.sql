-- AlterTable
ALTER TABLE "practices" ADD COLUMN "statement_retention_days" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "practices" ADD COLUMN "audit_log_retention_days" INTEGER NOT NULL DEFAULT 2555;
ALTER TABLE "practices" ADD COLUMN "inactive_client_archive_days" INTEGER NOT NULL DEFAULT 1095;
