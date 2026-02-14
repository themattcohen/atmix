// ---------------------------------------------------------------------------
// Extraction Worker
// ---------------------------------------------------------------------------
// BullMQ worker that processes uploaded bank statements through the LLM
// extraction pipeline. Each job receives a statement ID and file path,
// sends the document to Claude for structured data extraction, and persists
// the results into the ExtractedData table.
//
// Run standalone:  tsx src/workers/extract.ts
// ---------------------------------------------------------------------------

import { Worker, Job } from "bullmq"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getRedisConnection } from "@/lib/redis"
import { extractFromStatement } from "@/lib/extraction"
import type { ExtractionJobData } from "@/lib/queue"
import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const connection = getRedisConnection()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a YYYY-MM-DD date string into a Date object.
 * Returns null for missing, empty, or malformed values.
 */
function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null

  // Strict YYYY-MM-DD format check
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Basic range validation
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // Construct date at noon UTC to avoid timezone edge-case shifts
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  // Verify the date components survived construction (catches e.g. Feb 30)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

async function processExtractionJob(
  job: Job<ExtractionJobData>
): Promise<{
  statementId: string
  status: string
  accountsFound: number
}> {
  const { statementId, filePath, fileType } = job.data

  console.log(
    `[Worker] Processing extraction for statement: ${statementId} (${fileType})`
  )

  // 1. Mark statement as processing
  await prisma.statement.update({
    where: { id: statementId },
    data: {
      processingStatus: "PROCESSING",
      processingStartedAt: new Date(),
    },
  })

  await job.updateProgress(10)

  // 2. Run LLM extraction
  const response = await extractFromStatement(filePath, fileType)

  await job.updateProgress(60)

  // 3. Handle extraction failure
  if (!response.success || !response.result) {
    const errorMessage =
      response.error || "Extraction returned no result"

    console.error(
      `[Worker] Extraction failed for statement ${statementId}: ${errorMessage}`
    )

    await prisma.statement.update({
      where: { id: statementId },
      data: {
        processingStatus: "FAILED",
        processingError: errorMessage,
        processingCompletedAt: new Date(),
        llmModelUsed: response.model || null,
        llmTokensUsed: response.tokensUsed || null,
      },
    })

    throw new Error(`Extraction failed: ${errorMessage}`)
  }

  // 4. Extraction succeeded -- persist results
  const result: ExtractionResult = response.result
  const primaryAccount: ExtractedAccount | undefined = result.accounts[0]

  if (!primaryAccount) {
    // Edge case: extraction succeeded but found zero accounts
    const noAccountError = "Extraction returned zero accounts"

    await prisma.statement.update({
      where: { id: statementId },
      data: {
        processingStatus: "FAILED",
        processingError: noAccountError,
        processingCompletedAt: new Date(),
        llmModelUsed: response.model,
        llmTokensUsed: response.tokensUsed,
      },
    })

    throw new Error(noAccountError)
  }

  await job.updateProgress(70)

  // 5. Build ExtractedData record from the primary (first) account.
  //    The full multi-account result is preserved in rawLlmResponse so
  //    the review UI can display all accounts.
  //
  //    OPT-8: Wrap extractedData.upsert + statement.update in a transaction
  //    to ensure atomicity (both succeed or both fail).
  await prisma.$transaction(async (tx) => {
    await tx.extractedData.upsert({
      where: { statementId },
      create: {
        statementId,
        rawLlmResponse: result as unknown as Prisma.InputJsonValue,
        bankName: primaryAccount.bank_name,
        bankAddress:
          primaryAccount.bank_address as unknown as Prisma.InputJsonValue,
        accountNumber: primaryAccount.account_number,
        accountTypeDetected: primaryAccount.account_type,
        currencyCode: primaryAccount.currency,
        balances:
          primaryAccount.balances as unknown as Prisma.InputJsonValue,
        maxBalanceLocal: primaryAccount.max_balance.amount
          ? new Prisma.Decimal(primaryAccount.max_balance.amount.toString())
          : null,
        maxBalanceDate: parseDateSafe(primaryAccount.max_balance.date),
        statementPeriodStart: parseDateSafe(
          primaryAccount.statement_period.start_date
        ),
        statementPeriodEnd: parseDateSafe(
          primaryAccount.statement_period.end_date
        ),
        confidenceScores:
          primaryAccount.confidence as unknown as Prisma.InputJsonValue,
        extractionWarnings:
          primaryAccount.warnings as unknown as Prisma.InputJsonValue,
      },
      update: {
        rawLlmResponse: result as unknown as Prisma.InputJsonValue,
        bankName: primaryAccount.bank_name,
        bankAddress:
          primaryAccount.bank_address as unknown as Prisma.InputJsonValue,
        accountNumber: primaryAccount.account_number,
        accountTypeDetected: primaryAccount.account_type,
        currencyCode: primaryAccount.currency,
        balances:
          primaryAccount.balances as unknown as Prisma.InputJsonValue,
        maxBalanceLocal: primaryAccount.max_balance.amount
          ? new Prisma.Decimal(primaryAccount.max_balance.amount.toString())
          : null,
        maxBalanceDate: parseDateSafe(primaryAccount.max_balance.date),
        statementPeriodStart: parseDateSafe(
          primaryAccount.statement_period.start_date
        ),
        statementPeriodEnd: parseDateSafe(
          primaryAccount.statement_period.end_date
        ),
        confidenceScores:
          primaryAccount.confidence as unknown as Prisma.InputJsonValue,
        extractionWarnings:
          primaryAccount.warnings as unknown as Prisma.InputJsonValue,
      },
    })

    await job.updateProgress(90)

    // 6. Mark statement as completed
    await tx.statement.update({
      where: { id: statementId },
      data: {
        processingStatus: "COMPLETED",
        processingCompletedAt: new Date(),
        llmModelUsed: response.model,
        llmTokensUsed: response.tokensUsed,
      },
    })
  })

  await job.updateProgress(100)

  const accountsFound = result.accounts.length
  console.log(
    `[Worker] Completed extraction for statement ${statementId}: ${accountsFound} account(s) found`
  )

  return { statementId, status: "completed", accountsFound }
}

// ---------------------------------------------------------------------------
// Worker Instance
// ---------------------------------------------------------------------------

const worker = new Worker<ExtractionJobData>(
  "extraction",
  processExtractionJob,
  {
    connection: connection as any,
    concurrency: 2, // Conservative for LLM API rate limits
    limiter: {
      max: 10,
      duration: 60_000, // 10 jobs per minute
    },
  }
)

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

worker.on("completed", (job, result) => {
  console.log(
    `[Worker] Job ${job.id} completed — ${result?.accountsFound ?? 0} account(s) extracted`
  )
})

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`)
})

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err)
})

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}, shutting down gracefully...`)
  await worker.close()
  await connection.quit()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log("[Worker] Extraction worker started")
console.log(`[Worker] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`)
console.log("[Worker] Concurrency: 2 | Rate limit: 10 jobs/min")

export default worker
