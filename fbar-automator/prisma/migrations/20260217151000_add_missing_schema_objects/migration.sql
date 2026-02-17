-- AlterTable: users
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: users.practice_id
CREATE INDEX "users_practice_id_idx" ON "users"("practice_id");

-- CreateIndex: filing_years.status
CREATE INDEX "filing_years_status_idx" ON "filing_years"("status");

-- CreateIndex: statements (filing_year_id, processing_status)
CREATE INDEX "statements_filing_year_id_processing_status_idx" ON "statements"("filing_year_id", "processing_status");

-- CreateIndex: reviewed_account_years.filing_year_id
CREATE INDEX "reviewed_account_years_filing_year_id_idx" ON "reviewed_account_years"("filing_year_id");

-- CreateTable: password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
