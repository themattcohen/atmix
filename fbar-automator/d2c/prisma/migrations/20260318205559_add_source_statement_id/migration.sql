-- AlterTable
ALTER TABLE "ForeignAccount" ADD COLUMN     "sourceStatementId" TEXT;

-- AddForeignKey
ALTER TABLE "ForeignAccount" ADD CONSTRAINT "ForeignAccount_sourceStatementId_fkey" FOREIGN KEY ("sourceStatementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
