// ---------------------------------------------------------------------------
// Approval Workflow Service
// ---------------------------------------------------------------------------
// Manages the FBAR filing lifecycle: progress tracking, review submission,
// export approval, filed marking, and reopening. All state transitions are
// validated and audit-logged for SOC 2 compliance.
//
// Filing lifecycle: NOT_STARTED -> IN_PROGRESS -> REVIEWED -> EXPORTED -> FILED
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db"
import type { FilingYear, Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** FinCEN FBAR reporting threshold: aggregate max value > $10,000 */
const FBAR_THRESHOLD_USD = 10_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilingProgress {
  filingYearId: string
  calendarYear: number
  status: string
  totalAccounts: number
  reviewedAccounts: number
  pendingStatements: number
  completedStatements: number
  failedStatements: number
  totalStatements: number
  isReadyForReview: boolean
  isFullyReviewed: boolean
  isReadyForExport: boolean
  aggregateMaxValueUSD: number
  exceedsThreshold: boolean
}

export interface ReviewSummary {
  filingYear: {
    id: string
    calendarYear: number
    status: string
  }
  client: {
    id: string
    firstName: string | null
    lastName: string
    tin: string | null
    tinType: string | null
  }
  accounts: Array<{
    foreignAccountId: string
    institutionName: string
    accountNumber: string
    accountType: string
    country: string | null
    maxValueLocal: number | null
    currencyCode: string | null
    exchangeRate: number | null
    maxValueUsd: number | null
    isValueUnknown: boolean
    reviewedAt: Date | null
    reviewedBy: string | null
    corrections: Prisma.JsonValue | null
  }>
  aggregateMaxValueUSD: number
  exceedsThreshold: boolean
}

// ---------------------------------------------------------------------------
// 1. getFilingProgress
// ---------------------------------------------------------------------------

/**
 * Returns the completion status of a filing year, including statement
 * processing counts, account review progress, and FBAR threshold check.
 */
export async function getFilingProgress(
  filingYearId: string
): Promise<FilingProgress> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
    include: { client: true },
  })

  const [
    totalAccounts,
    reviewedAccounts,
    statementCounts,
    reviewedAccountYears,
  ] = await Promise.all([
    // Count active foreign accounts for this client
    prisma.foreignAccount.count({
      where: { clientId: filingYear.clientId, isActive: true },
    }),

    // Count reviewed account years for this filing year
    prisma.reviewedAccountYear.count({
      where: { filingYearId },
    }),

    // Count statements grouped by processing status
    prisma.statement.groupBy({
      by: ["processingStatus"],
      where: { filingYearId },
      _count: { id: true },
    }),

    // Fetch reviewed account years for aggregate calculation
    prisma.reviewedAccountYear.findMany({
      where: { filingYearId },
      select: { maxValueUsd: true },
    }),
  ])

  // Parse statement counts by status
  const statusCounts = new Map(
    statementCounts.map((s) => [s.processingStatus, s._count.id])
  )
  const pendingStatements =
    (statusCounts.get("PENDING") ?? 0) +
    (statusCounts.get("PROCESSING") ?? 0)
  const completedStatements = statusCounts.get("COMPLETED") ?? 0
  const failedStatements = statusCounts.get("FAILED") ?? 0
  const totalStatements = pendingStatements + completedStatements + failedStatements

  // Calculate aggregate max value in USD
  const aggregateMaxValueUSD = reviewedAccountYears.reduce(
    (sum, ray) => sum + (ray.maxValueUsd ? Number(ray.maxValueUsd) : 0),
    0
  )

  // Derive readiness flags
  const isReadyForReview =
    totalStatements > 0 && pendingStatements === 0 && failedStatements === 0
  const isFullyReviewed =
    totalAccounts > 0 && reviewedAccounts >= totalAccounts
  const isReadyForExport =
    isFullyReviewed && filingYear.status === "REVIEWED"

  return {
    filingYearId,
    calendarYear: filingYear.calendarYear,
    status: filingYear.status,
    totalAccounts,
    reviewedAccounts,
    pendingStatements,
    completedStatements,
    failedStatements,
    totalStatements,
    isReadyForReview,
    isFullyReviewed,
    isReadyForExport,
    aggregateMaxValueUSD,
    exceedsThreshold: aggregateMaxValueUSD > FBAR_THRESHOLD_USD,
  }
}

// ---------------------------------------------------------------------------
// 2. submitForReview
// ---------------------------------------------------------------------------

/**
 * Transitions a filing from IN_PROGRESS to REVIEWED after verifying all
 * active accounts have been reviewed. Creates an audit log entry.
 */
export async function submitForReview(
  filingYearId: string,
  userId: string,
  practiceId: string
): Promise<FilingYear> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
    include: { client: { include: { foreignAccounts: true } } },
  })

  // Get active accounts for this client
  const activeAccounts = filingYear.client.foreignAccounts.filter(
    (fa) => fa.isActive
  )

  // Get reviewed account year IDs for this filing
  const reviewedAccountYears = await prisma.reviewedAccountYear.findMany({
    where: { filingYearId },
    select: { foreignAccountId: true },
  })
  const reviewedAccountIds = new Set(
    reviewedAccountYears.map((ray) => ray.foreignAccountId)
  )

  // Check which accounts have not been reviewed
  const unreviewedAccounts = activeAccounts.filter(
    (fa) => !reviewedAccountIds.has(fa.id)
  )

  if (unreviewedAccounts.length > 0) {
    const unreviewedDetails = unreviewedAccounts
      .map(
        (fa) =>
          `${fa.institutionName} (${fa.accountNumber})`
      )
      .join(", ")
    throw new Error(
      `Cannot submit for review: ${unreviewedAccounts.length} account(s) have not been reviewed: ${unreviewedDetails}`
    )
  }

  // Transition status and record reviewer
  const [updatedFiling] = await prisma.$transaction([
    prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "REVIEWED",
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FILING_SUBMITTED_FOR_REVIEW",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: filingYear.calendarYear,
          clientId: filingYear.clientId,
          totalAccountsReviewed: reviewedAccountYears.length,
        },
      },
    }),
  ])

  return updatedFiling
}

// ---------------------------------------------------------------------------
// 3. approveForExport
// ---------------------------------------------------------------------------

/**
 * Transitions a filing from REVIEWED to EXPORTED. Only users with ADMIN
 * or REVIEWER role may approve. Creates an audit log entry.
 */
export async function approveForExport(
  filingYearId: string,
  userId: string,
  practiceId: string
): Promise<FilingYear> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
  })

  if (filingYear.status !== "REVIEWED") {
    throw new Error(
      `Cannot approve for export: filing status is "${filingYear.status}", expected "REVIEWED"`
    )
  }

  // Verify user has appropriate role
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  })

  if (user.role !== "ADMIN" && user.role !== "REVIEWER") {
    throw new Error(
      `Cannot approve for export: user role "${user.role}" is not authorized. Requires ADMIN or REVIEWER.`
    )
  }

  const [updatedFiling] = await prisma.$transaction([
    prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "EXPORTED",
        exportedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FILING_APPROVED_FOR_EXPORT",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: filingYear.calendarYear,
          clientId: filingYear.clientId,
          approvedByRole: user.role,
        },
      },
    }),
  ])

  return updatedFiling
}

// ---------------------------------------------------------------------------
// 4. markAsFiled
// ---------------------------------------------------------------------------

/**
 * Transitions a filing from EXPORTED to FILED, recording the filing
 * timestamp. Creates an audit log entry.
 */
export async function markAsFiled(
  filingYearId: string,
  userId: string,
  practiceId: string
): Promise<FilingYear> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
  })

  if (filingYear.status !== "EXPORTED") {
    throw new Error(
      `Cannot mark as filed: filing status is "${filingYear.status}", expected "EXPORTED"`
    )
  }

  const [updatedFiling] = await prisma.$transaction([
    prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "FILED",
        filedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FILING_MARKED_FILED",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: filingYear.calendarYear,
          clientId: filingYear.clientId,
        },
      },
    }),
  ])

  return updatedFiling
}

// ---------------------------------------------------------------------------
// 5. reopenFiling
// ---------------------------------------------------------------------------

/**
 * Reopens a REVIEWED or EXPORTED filing for corrections by resetting it
 * to IN_PROGRESS. Filed filings cannot be reopened (they require an
 * amendment filing instead). Creates an audit log entry.
 */
export async function reopenFiling(
  filingYearId: string,
  userId: string,
  practiceId: string
): Promise<FilingYear> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
  })

  if (filingYear.status !== "REVIEWED" && filingYear.status !== "EXPORTED") {
    throw new Error(
      `Cannot reopen filing: status is "${filingYear.status}". Only REVIEWED or EXPORTED filings can be reopened. Filed filings require an amendment.`
    )
  }

  const previousStatus = filingYear.status

  const [updatedFiling] = await prisma.$transaction([
    prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "IN_PROGRESS",
        reviewedById: null,
        reviewedAt: null,
        exportedAt: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FILING_REOPENED",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: filingYear.calendarYear,
          clientId: filingYear.clientId,
          previousStatus,
        },
      },
    }),
  ])

  return updatedFiling
}

// ---------------------------------------------------------------------------
// 6. getReviewSummary
// ---------------------------------------------------------------------------

/**
 * Returns detailed review data for a filing year, suitable for export
 * preparation and final review. Includes client info, all reviewed
 * account data with institution details, and aggregate FBAR threshold check.
 */
export async function getReviewSummary(
  filingYearId: string
): Promise<ReviewSummary> {
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tin: true,
          tinType: true,
        },
      },
    },
  })

  const reviewedAccountYears = await prisma.reviewedAccountYear.findMany({
    where: { filingYearId },
    include: {
      foreignAccount: {
        select: {
          id: true,
          institutionName: true,
          accountNumber: true,
          accountType: true,
          institutionAddressCountry: true,
        },
      },
      reviewedBy: {
        select: { name: true },
      },
    },
    orderBy: { foreignAccount: { institutionName: "asc" } },
  })

  // Map reviewed account years to the summary structure
  const accounts = reviewedAccountYears.map((ray) => ({
    foreignAccountId: ray.foreignAccountId,
    institutionName: ray.foreignAccount.institutionName,
    accountNumber: ray.foreignAccount.accountNumber,
    accountType: ray.foreignAccount.accountType,
    country: ray.foreignAccount.institutionAddressCountry,
    maxValueLocal: ray.maxValueLocal ? Number(ray.maxValueLocal) : null,
    currencyCode: ray.currencyCode,
    exchangeRate: ray.exchangeRate ? Number(ray.exchangeRate) : null,
    maxValueUsd: ray.maxValueUsd ? Number(ray.maxValueUsd) : null,
    isValueUnknown: ray.isValueUnknown,
    reviewedAt: ray.reviewedAt,
    reviewedBy: ray.reviewedBy?.name ?? null,
    corrections: ray.corrections,
  }))

  // Calculate aggregate max value in USD
  const aggregateMaxValueUSD = accounts.reduce(
    (sum, acct) => sum + (acct.maxValueUsd ?? 0),
    0
  )

  return {
    filingYear: {
      id: filingYear.id,
      calendarYear: filingYear.calendarYear,
      status: filingYear.status,
    },
    client: {
      id: filingYear.client.id,
      firstName: filingYear.client.firstName,
      lastName: filingYear.client.lastName,
      tin: filingYear.client.tin,
      tinType: filingYear.client.tinType,
    },
    accounts,
    aggregateMaxValueUSD,
    exceedsThreshold: aggregateMaxValueUSD > FBAR_THRESHOLD_USD,
  }
}

// ---------------------------------------------------------------------------
// 7. getFilingYearWithFullData
// ---------------------------------------------------------------------------

/**
 * Fetches a filing year with full review data, verifying it belongs to the
 * specified practice. This is the single source of data for all export
 * operations, eliminating redundant DB queries.
 *
 * @param filingYearId - The filing year to fetch
 * @param practiceId - The practice that must own the filing year
 * @returns Complete review summary with all account data
 * @throws Error if filing year not found or doesn't belong to practice
 */
export async function getFilingYearWithFullData(
  filingYearId: string,
  practiceId: string
): Promise<ReviewSummary> {
  // Verify the filing year belongs to the practice
  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
    include: { client: { select: { practiceId: true } } },
  })

  if (filingYear.client.practiceId !== practiceId) {
    throw new Error("Filing year not found")
  }

  // Reuse getReviewSummary which already fetches everything needed
  return getReviewSummary(filingYearId)
}
