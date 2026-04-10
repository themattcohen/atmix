-- AlterTable
ALTER TABLE "ForeignAccount" ADD COLUMN "jointOwnerFirstName" TEXT,
ADD COLUMN "jointOwnerLastName" TEXT,
ADD COLUMN "jointOwnerAddress" JSONB,
ADD COLUMN "jointOwnerTin" TEXT,
ADD COLUMN "jointOwnerTinType" "TINType";
