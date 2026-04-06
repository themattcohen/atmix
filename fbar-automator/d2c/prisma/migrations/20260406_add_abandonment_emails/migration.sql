-- Add abandonment email tracking fields to User
ALTER TABLE "User" ADD COLUMN "unsubscribedFromReminders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "unsubscribeToken" TEXT;

-- Generate unique unsubscribe tokens for existing users
UPDATE "User" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;

-- Add unique constraint on unsubscribeToken
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

-- Create AbandonmentEmail table
CREATE TABLE "AbandonmentEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingYearId" TEXT,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonmentEmail_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint to prevent duplicate sends
CREATE UNIQUE INDEX "AbandonmentEmail_userId_filingYearId_sequence_key" ON "AbandonmentEmail"("userId", "filingYearId", "sequence");

-- Create index for user lookups
CREATE INDEX "AbandonmentEmail_userId_idx" ON "AbandonmentEmail"("userId");

-- Add foreign key
ALTER TABLE "AbandonmentEmail" ADD CONSTRAINT "AbandonmentEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
