import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks - vi.hoisted ensures the mock object is available when vi.mock runs
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  filingYear: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  foreignAccount: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  reviewedAccountYear: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  statement: {
    groupBy: vi.fn(),
  },
  user: {
    findUniqueOrThrow: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

import {
  getFilingProgress,
  submitForReview,
  approveForExport,
} from "@/lib/approval"

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getFilingProgress
// ---------------------------------------------------------------------------

describe("getFilingProgress", () => {
  function setupGetFilingProgress(config: {
    calendarYear?: number
    status?: string
    totalAccounts?: number
    reviewedAccounts?: number
    statementCounts?: Array<{ processingStatus: string; _count: { id: number } }>
    reviewedAccountYears?: Array<{ maxValueUsd: number | null }>
  }) {
    const {
      calendarYear = 2024,
      status = "IN_PROGRESS",
      totalAccounts = 3,
      reviewedAccounts = 3,
      statementCounts = [{ processingStatus: "COMPLETED", _count: { id: 5 } }],
      reviewedAccountYears = [
        { maxValueUsd: 5000 },
        { maxValueUsd: 3000 },
        { maxValueUsd: 4000 },
      ],
    } = config

    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear,
      status,
      clientId: "client-001",
      client: { id: "client-001" },
    })

    mockPrisma.foreignAccount.count.mockResolvedValueOnce(totalAccounts)
    mockPrisma.reviewedAccountYear.count.mockResolvedValueOnce(reviewedAccounts)
    mockPrisma.statement.groupBy.mockResolvedValueOnce(statementCounts)
    mockPrisma.reviewedAccountYear.findMany.mockResolvedValueOnce(
      reviewedAccountYears
    )
  }

  it("returns correct counts and flags", async () => {
    setupGetFilingProgress({
      totalAccounts: 3,
      reviewedAccounts: 3,
      statementCounts: [
        { processingStatus: "COMPLETED", _count: { id: 5 } },
      ],
      reviewedAccountYears: [
        { maxValueUsd: 5000 },
        { maxValueUsd: 3000 },
        { maxValueUsd: 4000 },
      ],
    })

    const progress = await getFilingProgress("fy-001")

    expect(progress.filingYearId).toBe("fy-001")
    expect(progress.calendarYear).toBe(2024)
    expect(progress.totalAccounts).toBe(3)
    expect(progress.reviewedAccounts).toBe(3)
    expect(progress.completedStatements).toBe(5)
    expect(progress.pendingStatements).toBe(0)
    expect(progress.failedStatements).toBe(0)
    expect(progress.totalStatements).toBe(5)
    expect(progress.aggregateMaxValueUSD).toBe(12000)
  })

  it("isReadyForReview is true when all statements completed and none pending/failed", async () => {
    setupGetFilingProgress({
      statementCounts: [
        { processingStatus: "COMPLETED", _count: { id: 3 } },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.isReadyForReview).toBe(true)
  })

  it("isReadyForReview is false when statements are still pending", async () => {
    setupGetFilingProgress({
      statementCounts: [
        { processingStatus: "COMPLETED", _count: { id: 2 } },
        { processingStatus: "PENDING", _count: { id: 1 } },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.isReadyForReview).toBe(false)
  })

  it("isReadyForReview is false when statements have failed", async () => {
    setupGetFilingProgress({
      statementCounts: [
        { processingStatus: "COMPLETED", _count: { id: 2 } },
        { processingStatus: "FAILED", _count: { id: 1 } },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.isReadyForReview).toBe(false)
  })

  it("isFullyReviewed is true when all accounts are reviewed", async () => {
    setupGetFilingProgress({
      totalAccounts: 3,
      reviewedAccounts: 3,
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.isFullyReviewed).toBe(true)
  })

  it("isFullyReviewed is false when not all accounts are reviewed", async () => {
    setupGetFilingProgress({
      totalAccounts: 5,
      reviewedAccounts: 3,
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.isFullyReviewed).toBe(false)
  })

  it("exceedsThreshold is true when aggregate > $10,000", async () => {
    setupGetFilingProgress({
      reviewedAccountYears: [
        { maxValueUsd: 6000 },
        { maxValueUsd: 5000 },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.exceedsThreshold).toBe(true)
    expect(progress.aggregateMaxValueUSD).toBe(11000)
  })

  it("exceedsThreshold is false when aggregate <= $10,000", async () => {
    setupGetFilingProgress({
      reviewedAccountYears: [
        { maxValueUsd: 3000 },
        { maxValueUsd: 2000 },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.exceedsThreshold).toBe(false)
    expect(progress.aggregateMaxValueUSD).toBe(5000)
  })

  it("handles zero accounts and statements gracefully", async () => {
    setupGetFilingProgress({
      totalAccounts: 0,
      reviewedAccounts: 0,
      statementCounts: [],
      reviewedAccountYears: [],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.totalAccounts).toBe(0)
    expect(progress.totalStatements).toBe(0)
    expect(progress.aggregateMaxValueUSD).toBe(0)
    expect(progress.isReadyForReview).toBe(false) // totalStatements is 0
    expect(progress.isFullyReviewed).toBe(false) // totalAccounts is 0
    expect(progress.exceedsThreshold).toBe(false)
  })

  it("handles null maxValueUsd in reviewed account years", async () => {
    setupGetFilingProgress({
      reviewedAccountYears: [
        { maxValueUsd: 5000 },
        { maxValueUsd: null },
        { maxValueUsd: 3000 },
      ],
    })

    const progress = await getFilingProgress("fy-001")
    expect(progress.aggregateMaxValueUSD).toBe(8000)
  })
})

// ---------------------------------------------------------------------------
// submitForReview
// ---------------------------------------------------------------------------

describe("submitForReview", () => {
  it("succeeds when all active accounts have been reviewed", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "IN_PROGRESS",
      clientId: "client-001",
      client: {
        id: "client-001",
        foreignAccounts: [
          { id: "fa-001", institutionName: "Bank A", accountNumber: "001", isActive: true },
          { id: "fa-002", institutionName: "Bank B", accountNumber: "002", isActive: true },
          { id: "fa-003", institutionName: "Bank C", accountNumber: "003", isActive: false }, // inactive
        ],
      },
    })

    mockPrisma.reviewedAccountYear.findMany.mockResolvedValueOnce([
      { foreignAccountId: "fa-001" },
      { foreignAccountId: "fa-002" },
    ])

    const updatedFiling = {
      id: "fy-001",
      status: "REVIEWED",
      calendarYear: 2024,
    }
    mockPrisma.$transaction.mockResolvedValueOnce([updatedFiling])

    const result = await submitForReview("fy-001", "user-001", "practice-001")
    expect(result.status).toBe("REVIEWED")
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
  })

  it("throws when accounts have not all been reviewed", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "IN_PROGRESS",
      clientId: "client-001",
      client: {
        id: "client-001",
        foreignAccounts: [
          { id: "fa-001", institutionName: "Bank A", accountNumber: "001", isActive: true },
          { id: "fa-002", institutionName: "Bank B", accountNumber: "002", isActive: true },
        ],
      },
    })

    // Only one of two active accounts has been reviewed
    mockPrisma.reviewedAccountYear.findMany.mockResolvedValueOnce([
      { foreignAccountId: "fa-001" },
    ])

    await expect(
      submitForReview("fy-001", "user-001", "practice-001")
    ).rejects.toThrow(/Cannot submit for review.*Bank B/)
  })
})

// ---------------------------------------------------------------------------
// approveForExport
// ---------------------------------------------------------------------------

describe("approveForExport", () => {
  it("succeeds when filing status is REVIEWED and user is ADMIN", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "REVIEWED",
      clientId: "client-001",
    })

    mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
      role: "ADMIN",
    })

    const updatedFiling = {
      id: "fy-001",
      status: "EXPORTED",
      calendarYear: 2024,
    }
    mockPrisma.$transaction.mockResolvedValueOnce([updatedFiling])

    const result = await approveForExport("fy-001", "user-001", "practice-001")
    expect(result.status).toBe("EXPORTED")
  })

  it("succeeds when filing status is REVIEWED and user is REVIEWER", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "REVIEWED",
      clientId: "client-001",
    })

    mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
      role: "REVIEWER",
    })

    const updatedFiling = {
      id: "fy-001",
      status: "EXPORTED",
      calendarYear: 2024,
    }
    mockPrisma.$transaction.mockResolvedValueOnce([updatedFiling])

    const result = await approveForExport("fy-001", "user-001", "practice-001")
    expect(result.status).toBe("EXPORTED")
  })

  it("fails when filing status is not REVIEWED", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "IN_PROGRESS",
      clientId: "client-001",
    })

    await expect(
      approveForExport("fy-001", "user-001", "practice-001")
    ).rejects.toThrow('filing status is "IN_PROGRESS"')
  })

  it("fails when user role is not ADMIN or REVIEWER", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "REVIEWED",
      clientId: "client-001",
    })

    mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
      role: "PREPARER",
    })

    await expect(
      approveForExport("fy-001", "user-001", "practice-001")
    ).rejects.toThrow('user role "PREPARER" is not authorized')
  })

  it("fails when filing status is EXPORTED (already approved)", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "EXPORTED",
      clientId: "client-001",
    })

    await expect(
      approveForExport("fy-001", "user-001", "practice-001")
    ).rejects.toThrow('filing status is "EXPORTED"')
  })

  it("fails when filing status is FILED", async () => {
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValueOnce({
      id: "fy-001",
      calendarYear: 2024,
      status: "FILED",
      clientId: "client-001",
    })

    await expect(
      approveForExport("fy-001", "user-001", "practice-001")
    ).rejects.toThrow('filing status is "FILED"')
  })
})
