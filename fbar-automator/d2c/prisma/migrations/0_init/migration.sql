-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TINType" AS ENUM ('SSN', 'ITIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'SECURITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FINANCIAL_INTEREST', 'SIGNATURE_AUTHORITY', 'BOTH');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'REVIEWED', 'SIGNED', 'PAID', 'SUBMITTING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FilingType" AS ENUM ('ORIGINAL', 'AMENDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('TREASURY', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "suffix" TEXT,
    "tin" TEXT,
    "tinType" "TINType",
    "dateOfBirth" TIMESTAMP(3),
    "usAddress" JSONB,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForeignAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "institutionAddress" JSONB,
    "accountNumber" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "ownershipType" "OwnershipType" NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isJointAccount" BOOLEAN NOT NULL DEFAULT false,
    "jointOwnerInfo" TEXT,
    "maxValueLocal" DECIMAL(18,2) NOT NULL,
    "maxValueUsd" DECIMAL(18,2),
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(12,6),
    "exchangeRateSource" "ExchangeRateSource",
    "calendarYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForeignAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "status" "FilingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "filingType" "FilingType" NOT NULL DEFAULT 'ORIGINAL',
    "has25PlusAccounts" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "signatureIp" TEXT,
    "signatureData" JSONB,
    "form114aUrl" TEXT,
    "stripePaymentId" TEXT,
    "stripeSessionId" TEXT,
    "sdtmSubmissionId" TEXT,
    "sdtmBatchId" TEXT,
    "bsaId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingYearId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "source" "ExchangeRateSource" NOT NULL DEFAULT 'TREASURY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ForeignAccount_userId_calendarYear_idx" ON "ForeignAccount"("userId", "calendarYear");

-- CreateIndex
CREATE INDEX "FilingYear_userId_idx" ON "FilingYear"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FilingYear_userId_calendarYear_filingType_key" ON "FilingYear"("userId", "calendarYear", "filingType");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_filingYearId_idx" ON "Payment"("filingYearId");

-- CreateIndex
CREATE INDEX "ExchangeRate_currencyCode_idx" ON "ExchangeRate"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currencyCode_recordDate_source_key" ON "ExchangeRate"("currencyCode", "recordDate", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "ForeignAccount" ADD CONSTRAINT "ForeignAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingYear" ADD CONSTRAINT "FilingYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_filingYearId_fkey" FOREIGN KEY ("filingYearId") REFERENCES "FilingYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

