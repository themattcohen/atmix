-- AlterTable: Add MFA fields to User
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

-- CreateTable: MfaRecoveryCode
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_codeHash_idx" ON "MfaRecoveryCode"("codeHash");

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Statement → FilingYear, missing from earlier migration)
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_filingYearId_fkey" FOREIGN KEY ("filingYearId") REFERENCES "FilingYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (FilingYear composite index for query performance)
CREATE INDEX "FilingYear_userId_status_idx" ON "FilingYear"("userId", "status");
