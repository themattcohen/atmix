// ---------------------------------------------------------------------------
// Integration Tests: Review & Approval Workflow
// ---------------------------------------------------------------------------
// Tests the filing lifecycle state machine, currency conversion during review,
// incomplete review rejection, role-based access, reopen workflow, and FBAR
// threshold calculation.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
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
    upsert: vi.fn(),
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
  $transaction: vi.fn((fnOrArray: unknown) => {
    // Handle both callback and array-of-promises patterns
    if (typeof fnOrArray === "function") {
      return (fnOrArray as (tx: typeof mockPrisma) => unknown)(mockPrisma)
    }
    // Array pattern: return the array as-is (prisma.$transaction([...]))
    return Promise.resolve(fnOrArray)
  }),
}

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/treasury", () => ({
  getRate: vi.fn(),
  getRatesForYear: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function createMockFilingYear(overrides: Record<string, unknown> = {}) {
  return {
    id: "fy-2024-001",
    calendarYear: 2024,
    clientId: "client-001",
    status: "IN_PROGRESS",
    reviewedById: null,
    reviewedAt: null,
    exportedAt: null,
    filedAt: null,
    has25PlusAccounts: false,
    filingType: "INITIAL",
    client: {
      id: "client-001",
      firstName: "John",
      lastName: "Doe",
      tin: "123456789",
      tinType: "SSN",
      type: "INDIVIDUAL",
      foreignAccounts: [
        {
          id: "fa-1",
          institutionName: "Swiss Bank Corp",
          accountNumber: "CH-123456",
          accountType: "BANK",
          isActive: true,
          isJointlyOwned: false,
          ownershipType: "FINANCIAL_INTEREST",
          institutionAddressCountry: "CH",
        },
        {
          id: "fa-2",
          institutionName: "Tokyo Securities",
          accountNumber: "JP-789012",
          accountType: "SECURITIES",
          isActive: true,
          isJointlyOwned: false,
          ownershipType: "FINANCIAL_INTEREST",
          institutionAddressCountry: "JP",
        },
      ],
    },
    ...overrides,
  }
}

function createMockReviewedAccountYear(
  foreignAccountId: string,
  maxValueUsd: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: `ray-${foreignAccountId}`,
    filingYearId: "fy-2024-001",
    foreignAccountId,
    maxValueLocal: maxValueUsd * 0.88,
    currencyCode: "CHF",
    exchangeRate: 0.88,
    maxValueUsd,
    isValueUnknown: false,
    reviewedAt: new Date("2024-06-15"),
    reviewedById: "user-reviewer",
    corrections: null,
    foreignAccount: {
      id: foreignAccountId,
      institutionName: "Test Bank",
      accountNumber: "TEST-123",
      accountType: "BANK",
      institutionAddressCountry: "CH",
    },
    reviewedBy: { name: "Jane Smith" },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Review & Approval Workflow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Full lifecycle status transitions
  // -------------------------------------------------------------------------

  describe("full filing lifecycle", () => {
    it("transitions through NOT_STARTED -> IN_PROGRESS -> REVIEWED -> EXPORTED -> FILED", async () => {
      const {
        getFilingProgress,
        submitForReview,
        approveForExport,
        markAsFiled,
      } = await import("@/lib/approval")

      // --- Stage 1: NOT_STARTED - no statements yet ---
      const notStartedFiling = createMockFilingYear({
        status: "NOT_STARTED",
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        notStartedFiling
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(0)
      mockPrisma.statement.groupBy.mockResolvedValue([])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([])

      const progressNotStarted = await getFilingProgress("fy-2024-001")
      expect(progressNotStarted.status).toBe("NOT_STARTED")
      expect(progressNotStarted.totalStatements).toBe(0)
      expect(progressNotStarted.isReadyForReview).toBe(false)
      expect(progressNotStarted.isFullyReviewed).toBe(false)

      // --- Stage 2: IN_PROGRESS - statements uploaded and processed ---
      const inProgressFiling = createMockFilingYear({
        status: "IN_PROGRESS",
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        inProgressFiling
      )
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 3 } },
      ])
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 56818 },
        { maxValueUsd: 33670 },
      ])

      const progressInProgress = await getFilingProgress("fy-2024-001")
      expect(progressInProgress.status).toBe("IN_PROGRESS")
      expect(progressInProgress.completedStatements).toBe(3)
      expect(progressInProgress.pendingStatements).toBe(0)
      expect(progressInProgress.isReadyForReview).toBe(true)
      expect(progressInProgress.isFullyReviewed).toBe(true)
      expect(progressInProgress.aggregateMaxValueUSD).toBe(90488)
      expect(progressInProgress.exceedsThreshold).toBe(true)

      // --- Stage 3: Submit for review (IN_PROGRESS -> REVIEWED) ---
      const filingWithAccounts = createMockFilingYear({
        status: "IN_PROGRESS",
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        filingWithAccounts
      )
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { foreignAccountId: "fa-1" },
        { foreignAccountId: "fa-2" },
      ])

      const updatedToReviewed = {
        ...filingWithAccounts,
        status: "REVIEWED",
        reviewedById: "user-reviewer",
        reviewedAt: new Date(),
      }
      mockPrisma.$transaction.mockResolvedValue([
        updatedToReviewed,
        { id: "audit-1" },
      ])

      const reviewedFiling = await submitForReview(
        "fy-2024-001",
        "user-reviewer",
        "practice-001"
      )
      expect(reviewedFiling.status).toBe("REVIEWED")

      // --- Stage 4: Approve for export (REVIEWED -> EXPORTED) ---
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue({
        ...filingWithAccounts,
        status: "REVIEWED",
      })
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        role: "ADMIN",
      })

      const updatedToExported = {
        ...filingWithAccounts,
        status: "EXPORTED",
        exportedAt: new Date(),
      }
      mockPrisma.$transaction.mockResolvedValue([
        updatedToExported,
        { id: "audit-2" },
      ])

      const exportedFiling = await approveForExport(
        "fy-2024-001",
        "user-admin",
        "practice-001"
      )
      expect(exportedFiling.status).toBe("EXPORTED")

      // --- Stage 5: Mark as filed (EXPORTED -> FILED) ---
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue({
        ...filingWithAccounts,
        status: "EXPORTED",
      })

      const updatedToFiled = {
        ...filingWithAccounts,
        status: "FILED",
        filedAt: new Date(),
      }
      mockPrisma.$transaction.mockResolvedValue([
        updatedToFiled,
        { id: "audit-3" },
      ])

      const filedResult = await markAsFiled(
        "fy-2024-001",
        "user-admin",
        "practice-001"
      )
      expect(filedResult.status).toBe("FILED")
    })

    it("returns correct filing progress at each stage", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      // Partially processed: some pending, some completed
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(1) // only 1 of 2 reviewed
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 2 } },
        { processingStatus: "PENDING", _count: { id: 1 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 56818 },
      ])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.totalAccounts).toBe(2)
      expect(progress.reviewedAccounts).toBe(1)
      expect(progress.completedStatements).toBe(2)
      expect(progress.pendingStatements).toBe(1)
      expect(progress.isReadyForReview).toBe(false) // has pending statements
      expect(progress.isFullyReviewed).toBe(false) // not all accounts reviewed
      expect(progress.isReadyForExport).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Review with currency conversion
  // -------------------------------------------------------------------------

  describe("review with currency conversion", () => {
    it("converts EUR amounts to USD using Treasury rates during review", async () => {
      const { convertToUSD } = await import("@/lib/currency")
      const { getRate } = await import("@/lib/treasury")

      const mockGetRate = getRate as ReturnType<typeof vi.fn>
      mockGetRate.mockResolvedValue({
        rate: 1.1,
        source: "treasury_api",
        recordDate: new Date("2024-12-31"),
      })

      // EUR 50,000 / 1.1 = ~45,454.55 USD
      const result = await convertToUSD(50000, "EUR", 2024)

      expect(result).not.toBeNull()
      expect(result!.exchangeRate).toBe(1.1)
      expect(result!.usdAmount).toBeCloseTo(45454.55, 2)
      expect(result!.source).toBe("TREASURY")
    })

    it("converts JPY amounts to USD correctly", async () => {
      const { convertToUSD } = await import("@/lib/currency")
      const { getRate } = await import("@/lib/treasury")

      const mockGetRate = getRate as ReturnType<typeof vi.fn>
      mockGetRate.mockResolvedValue({
        rate: 148.5,
        source: "treasury_api",
        recordDate: new Date("2024-12-31"),
      })

      // JPY 5,000,000 / 148.5 = ~33,670.03 USD
      const result = await convertToUSD(5000000, "JPY", 2024)

      expect(result).not.toBeNull()
      expect(result!.exchangeRate).toBe(148.5)
      expect(result!.usdAmount).toBeCloseTo(33670.03, 2)
    })

    it("returns null when no Treasury rate is available", async () => {
      const { convertToUSD } = await import("@/lib/currency")
      const { getRate } = await import("@/lib/treasury")

      const mockGetRate = getRate as ReturnType<typeof vi.fn>
      mockGetRate.mockResolvedValue(null)

      const result = await convertToUSD(10000, "XAF", 2024)
      expect(result).toBeNull()
    })

    it("handles USD-to-USD conversion as identity", async () => {
      const { convertToUSD } = await import("@/lib/currency")

      const result = await convertToUSD(25000, "USD", 2024)

      expect(result).not.toBeNull()
      expect(result!.usdAmount).toBe(25000)
      expect(result!.exchangeRate).toBe(1.0)
      expect(result!.source).toBe("TREASURY")
    })

    it("batch converts multiple currencies in one operation", async () => {
      const { convertBatchToUSD } = await import("@/lib/currency")
      const { getRatesForYear } = await import("@/lib/treasury")

      const mockGetRatesForYear = getRatesForYear as ReturnType<typeof vi.fn>
      mockGetRatesForYear.mockResolvedValue([
        {
          currencyCode: "CHF",
          rate: 0.88,
          recordDate: new Date("2024-12-31"),
          source: "treasury_api",
        },
        {
          currencyCode: "JPY",
          rate: 148.5,
          recordDate: new Date("2024-12-31"),
          source: "treasury_api",
        },
        {
          currencyCode: "EUR",
          rate: 1.1,
          recordDate: new Date("2024-12-31"),
          source: "treasury_api",
        },
      ])

      const results = await convertBatchToUSD(
        [
          { amount: 50000, currencyCode: "CHF" },
          { amount: 5000000, currencyCode: "JPY" },
          { amount: 100000, currencyCode: "EUR" },
          { amount: 1000, currencyCode: "XYZ" }, // unknown currency
        ],
        2024
      )

      expect(results).toHaveLength(4)

      // CHF: 50000 / 0.88 = ~56818.18
      expect(results[0].usdAmount).toBeCloseTo(56818.18, 2)
      expect(results[0].source).toBe("TREASURY")

      // JPY: 5000000 / 148.5 = ~33670.03
      expect(results[1].usdAmount).toBeCloseTo(33670.03, 2)

      // EUR: 100000 / 1.1 = ~90909.09
      expect(results[2].usdAmount).toBeCloseTo(90909.09, 2)

      // Unknown currency: returns 0 with MANUAL source
      expect(results[3].usdAmount).toBe(0)
      expect(results[3].exchangeRate).toBe(0)
      expect(results[3].source).toBe("MANUAL")
    })
  })

  // -------------------------------------------------------------------------
  // 3. Incomplete review rejection
  // -------------------------------------------------------------------------

  describe("incomplete review rejection", () => {
    it("rejects submitForReview when not all accounts are reviewed", async () => {
      const { submitForReview } = await import("@/lib/approval")

      const filingWithAccounts = createMockFilingYear({
        status: "IN_PROGRESS",
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        filingWithAccounts
      )

      // Only 1 of 2 accounts reviewed
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { foreignAccountId: "fa-1" },
        // fa-2 is missing
      ])

      await expect(
        submitForReview("fy-2024-001", "user-reviewer", "practice-001")
      ).rejects.toThrow("Cannot submit for review")

      // Verify error mentions the unreviewed account
      try {
        await submitForReview("fy-2024-001", "user-reviewer", "practice-001")
      } catch (error) {
        expect((error as Error).message).toContain("Tokyo Securities")
        expect((error as Error).message).toContain("1 account(s)")
      }
    })

    it("rejects submitForReview when zero accounts are reviewed", async () => {
      const { submitForReview } = await import("@/lib/approval")

      const filingWithAccounts = createMockFilingYear({
        status: "IN_PROGRESS",
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        filingWithAccounts
      )
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([])

      await expect(
        submitForReview("fy-2024-001", "user-reviewer", "practice-001")
      ).rejects.toThrow("2 account(s) have not been reviewed")
    })
  })

  // -------------------------------------------------------------------------
  // 4. Role-based access control
  // -------------------------------------------------------------------------

  describe("role-based access control", () => {
    it("allows ADMIN to approve for export", async () => {
      const { approveForExport } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "REVIEWED" })
      )
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        role: "ADMIN",
      })

      const updatedFiling = createMockFilingYear({ status: "EXPORTED" })
      mockPrisma.$transaction.mockResolvedValue([
        updatedFiling,
        { id: "audit-1" },
      ])

      const result = await approveForExport(
        "fy-2024-001",
        "user-admin",
        "practice-001"
      )
      expect(result.status).toBe("EXPORTED")
    })

    it("allows REVIEWER to approve for export", async () => {
      const { approveForExport } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "REVIEWED" })
      )
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        role: "REVIEWER",
      })

      const updatedFiling = createMockFilingYear({ status: "EXPORTED" })
      mockPrisma.$transaction.mockResolvedValue([
        updatedFiling,
        { id: "audit-1" },
      ])

      const result = await approveForExport(
        "fy-2024-001",
        "user-reviewer",
        "practice-001"
      )
      expect(result.status).toBe("EXPORTED")
    })

    it("rejects PREPARER from approving for export", async () => {
      const { approveForExport } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "REVIEWED" })
      )
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        role: "PREPARER",
      })

      await expect(
        approveForExport("fy-2024-001", "user-preparer", "practice-001")
      ).rejects.toThrow("not authorized")

      try {
        await approveForExport(
          "fy-2024-001",
          "user-preparer",
          "practice-001"
        )
      } catch (error) {
        expect((error as Error).message).toContain("PREPARER")
        expect((error as Error).message).toContain(
          "Requires ADMIN or REVIEWER"
        )
      }
    })

    it("rejects VIEWER from approving for export", async () => {
      const { approveForExport } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "REVIEWED" })
      )
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        role: "VIEWER",
      })

      await expect(
        approveForExport("fy-2024-001", "user-viewer", "practice-001")
      ).rejects.toThrow("not authorized")
    })

    it("rejects export approval when filing is not in REVIEWED status", async () => {
      const { approveForExport } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )

      await expect(
        approveForExport("fy-2024-001", "user-admin", "practice-001")
      ).rejects.toThrow('expected "REVIEWED"')
    })
  })

  // -------------------------------------------------------------------------
  // 5. Reopen workflow
  // -------------------------------------------------------------------------

  describe("reopen workflow", () => {
    it("reopens a REVIEWED filing to IN_PROGRESS", async () => {
      const { reopenFiling } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "REVIEWED" })
      )

      const reopenedFiling = createMockFilingYear({
        status: "IN_PROGRESS",
        reviewedById: null,
        reviewedAt: null,
      })
      mockPrisma.$transaction.mockResolvedValue([
        reopenedFiling,
        { id: "audit-reopen" },
      ])

      const result = await reopenFiling(
        "fy-2024-001",
        "user-admin",
        "practice-001"
      )
      expect(result.status).toBe("IN_PROGRESS")
      expect(result.reviewedById).toBeNull()
      expect(result.reviewedAt).toBeNull()
    })

    it("reopens an EXPORTED filing to IN_PROGRESS", async () => {
      const { reopenFiling } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "EXPORTED" })
      )

      const reopenedFiling = createMockFilingYear({
        status: "IN_PROGRESS",
        reviewedById: null,
        reviewedAt: null,
        exportedAt: null,
      })
      mockPrisma.$transaction.mockResolvedValue([
        reopenedFiling,
        { id: "audit-reopen" },
      ])

      const result = await reopenFiling(
        "fy-2024-001",
        "user-admin",
        "practice-001"
      )
      expect(result.status).toBe("IN_PROGRESS")
    })

    it("cannot reopen a FILED filing", async () => {
      const { reopenFiling } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "FILED" })
      )

      await expect(
        reopenFiling("fy-2024-001", "user-admin", "practice-001")
      ).rejects.toThrow("Cannot reopen filing")

      try {
        await reopenFiling("fy-2024-001", "user-admin", "practice-001")
      } catch (error) {
        expect((error as Error).message).toContain("FILED")
        expect((error as Error).message).toContain("amendment")
      }
    })

    it("cannot reopen a NOT_STARTED filing", async () => {
      const { reopenFiling } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "NOT_STARTED" })
      )

      await expect(
        reopenFiling("fy-2024-001", "user-admin", "practice-001")
      ).rejects.toThrow("Cannot reopen filing")
    })
  })

  // -------------------------------------------------------------------------
  // 6. FBAR threshold check
  // -------------------------------------------------------------------------

  describe("FBAR threshold check", () => {
    it("exceeds threshold when aggregate value > $10,000", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(2)
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 2 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 6000 },
        { maxValueUsd: 5000 },
      ])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.aggregateMaxValueUSD).toBe(11000)
      expect(progress.exceedsThreshold).toBe(true)
    })

    it("does not exceed threshold when aggregate value < $10,000", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(2)
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 2 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 4000 },
        { maxValueUsd: 5000 },
      ])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.aggregateMaxValueUSD).toBe(9000)
      expect(progress.exceedsThreshold).toBe(false)
    })

    it("does not exceed threshold when aggregate value is exactly $10,000", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(1)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(1)
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 1 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 10000 },
      ])

      const progress = await getFilingProgress("fy-2024-001")

      // $10,000 exactly does NOT exceed the threshold (> not >=)
      expect(progress.aggregateMaxValueUSD).toBe(10000)
      expect(progress.exceedsThreshold).toBe(false)
    })

    it("handles zero accounts correctly", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      const filingNoAccounts = createMockFilingYear({
        status: "NOT_STARTED",
        client: {
          ...createMockFilingYear().client,
          foreignAccounts: [],
        },
      })
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        filingNoAccounts
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(0)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(0)
      mockPrisma.statement.groupBy.mockResolvedValue([])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.aggregateMaxValueUSD).toBe(0)
      expect(progress.exceedsThreshold).toBe(false)
      expect(progress.totalAccounts).toBe(0)
      expect(progress.isFullyReviewed).toBe(false)
    })

    it("handles null maxValueUsd in reviewed accounts", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(2)
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 2 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 8000 },
        { maxValueUsd: null }, // value unknown
      ])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.aggregateMaxValueUSD).toBe(8000)
      expect(progress.exceedsThreshold).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Filing progress with failed statements
  // -------------------------------------------------------------------------

  describe("filing progress with statement failures", () => {
    it("not ready for review when there are failed statements", async () => {
      const { getFilingProgress } = await import("@/lib/approval")

      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYear({ status: "IN_PROGRESS" })
      )
      mockPrisma.foreignAccount.count.mockResolvedValue(2)
      mockPrisma.reviewedAccountYear.count.mockResolvedValue(2)
      mockPrisma.statement.groupBy.mockResolvedValue([
        { processingStatus: "COMPLETED", _count: { id: 2 } },
        { processingStatus: "FAILED", _count: { id: 1 } },
      ])
      mockPrisma.reviewedAccountYear.findMany.mockResolvedValue([
        { maxValueUsd: 50000 },
        { maxValueUsd: 30000 },
      ])

      const progress = await getFilingProgress("fy-2024-001")

      expect(progress.failedStatements).toBe(1)
      expect(progress.isReadyForReview).toBe(false) // failed statements block review
      expect(progress.totalStatements).toBe(3)
    })
  })
})
