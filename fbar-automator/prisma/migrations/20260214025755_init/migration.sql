-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'PREPARER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "client_type" AS ENUM ('INDIVIDUAL', 'ENTITY');

-- CreateEnum
CREATE TYPE "tin_type" AS ENUM ('SSN', 'ITIN', 'EIN', 'FOREIGN_TIN');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('BANK', 'SECURITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "ownership_type" AS ENUM ('FINANCIAL_INTEREST', 'SIGNATURE_AUTHORITY', 'BOTH');

-- CreateEnum
CREATE TYPE "filing_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'REVIEWED', 'EXPORTED', 'FILED');

-- CreateEnum
CREATE TYPE "filing_type" AS ENUM ('ORIGINAL', 'AMENDED');

-- CreateEnum
CREATE TYPE "processing_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "exchange_rate_source" AS ENUM ('TREASURY', 'MANUAL');

-- CreateTable
CREATE TABLE "practices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "ein" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "type" "client_type" NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT,
    "tin" TEXT,
    "tin_type" "tin_type",
    "date_of_birth" TIMESTAMP(3),
    "us_address" JSONB,
    "mailing_address" JSONB,
    "spouse_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foreign_accounts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" "account_type" NOT NULL,
    "account_type_description" TEXT,
    "institution_name" TEXT NOT NULL,
    "institution_address_street" TEXT,
    "institution_address_city" TEXT,
    "institution_address_state" TEXT,
    "institution_address_country" TEXT,
    "institution_address_postal" TEXT,
    "is_jointly_owned" BOOLEAN NOT NULL DEFAULT false,
    "joint_owner_count" INTEGER NOT NULL DEFAULT 0,
    "ownership_type" "ownership_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foreign_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filing_years" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "calendar_year" INTEGER NOT NULL,
    "status" "filing_status" NOT NULL DEFAULT 'NOT_STARTED',
    "filing_type" "filing_type" NOT NULL DEFAULT 'ORIGINAL',
    "has_25_plus_accounts" BOOLEAN NOT NULL DEFAULT false,
    "assigned_preparer_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "exported_at" TIMESTAMP(3),
    "filed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filing_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" TEXT NOT NULL,
    "filing_year_id" TEXT NOT NULL,
    "foreign_account_id" TEXT,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "page_count" INTEGER,
    "processing_status" "processing_status" NOT NULL DEFAULT 'PENDING',
    "processing_started_at" TIMESTAMP(3),
    "processing_completed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "llm_model_used" TEXT,
    "llm_tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_data" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "raw_llm_response" JSONB NOT NULL,
    "bank_name" TEXT,
    "bank_address" JSONB,
    "account_number" TEXT,
    "account_type_detected" TEXT,
    "currency_code" TEXT,
    "balances" JSONB,
    "max_balance_local" DECIMAL(18,2),
    "max_balance_date" TIMESTAMP(3),
    "statement_period_start" TIMESTAMP(3),
    "statement_period_end" TIMESTAMP(3),
    "confidence_scores" JSONB,
    "extraction_warnings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewed_account_years" (
    "id" TEXT NOT NULL,
    "foreign_account_id" TEXT NOT NULL,
    "filing_year_id" TEXT NOT NULL,
    "max_value_local" DECIMAL(18,2),
    "currency_code" TEXT,
    "exchange_rate" DECIMAL(12,6),
    "exchange_rate_source" "exchange_rate_source",
    "manual_rate_justification" TEXT,
    "max_value_usd" DECIMAL(18,2),
    "is_value_unknown" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "corrections" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewed_account_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'treasury_api',
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "practice_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_spouse_client_id_key" ON "clients"("spouse_client_id");

-- CreateIndex
CREATE INDEX "clients_practice_id_idx" ON "clients"("practice_id");

-- CreateIndex
CREATE INDEX "foreign_accounts_client_id_idx" ON "foreign_accounts"("client_id");

-- CreateIndex
CREATE INDEX "filing_years_assigned_preparer_id_idx" ON "filing_years"("assigned_preparer_id");

-- CreateIndex
CREATE UNIQUE INDEX "filing_years_client_id_calendar_year_key" ON "filing_years"("client_id", "calendar_year");

-- CreateIndex
CREATE INDEX "statements_filing_year_id_idx" ON "statements"("filing_year_id");

-- CreateIndex
CREATE INDEX "statements_processing_status_idx" ON "statements"("processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_data_statement_id_key" ON "extracted_data"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviewed_account_years_foreign_account_id_filing_year_id_key" ON "reviewed_account_years"("foreign_account_id", "filing_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_code_record_date_key" ON "exchange_rates"("currency_code", "record_date");

-- CreateIndex
CREATE INDEX "audit_logs_practice_id_created_at_idx" ON "audit_logs"("practice_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_spouse_client_id_fkey" FOREIGN KEY ("spouse_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foreign_accounts" ADD CONSTRAINT "foreign_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filing_years" ADD CONSTRAINT "filing_years_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filing_years" ADD CONSTRAINT "filing_years_assigned_preparer_id_fkey" FOREIGN KEY ("assigned_preparer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filing_years" ADD CONSTRAINT "filing_years_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_filing_year_id_fkey" FOREIGN KEY ("filing_year_id") REFERENCES "filing_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_foreign_account_id_fkey" FOREIGN KEY ("foreign_account_id") REFERENCES "foreign_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_data" ADD CONSTRAINT "extracted_data_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_account_years" ADD CONSTRAINT "reviewed_account_years_foreign_account_id_fkey" FOREIGN KEY ("foreign_account_id") REFERENCES "foreign_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_account_years" ADD CONSTRAINT "reviewed_account_years_filing_year_id_fkey" FOREIGN KEY ("filing_year_id") REFERENCES "filing_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_account_years" ADD CONSTRAINT "reviewed_account_years_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
