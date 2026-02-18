-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "FilingYear" ADD COLUMN     "tier" "PricingTier" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingYearId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "extractionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "extractionError" TEXT,
    "rawExtraction" JSONB,
    "extractedAccounts" JSONB,
    "llmModel" TEXT,
    "llmTokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Statement_userId_idx" ON "Statement"("userId");

-- CreateIndex
CREATE INDEX "Statement_filingYearId_idx" ON "Statement"("filingYearId");

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
