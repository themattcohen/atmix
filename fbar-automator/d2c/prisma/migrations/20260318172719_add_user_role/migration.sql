/*
  Warnings:

  - You are about to alter the column `fileName` on the `Statement` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `utmSource` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `utmMedium` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `utmCampaign` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `utmContent` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `utmTerm` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "Statement" ALTER COLUMN "fileName" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "utmSource" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "utmMedium" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "utmCampaign" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "utmContent" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "utmTerm" SET DATA TYPE VARCHAR(200);
