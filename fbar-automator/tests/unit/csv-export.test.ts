import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/approval", () => ({
  getReviewSummary: vi.fn(),
}))

import { generateFBARCsv, generateAccountsCsv } from "@/lib/export/csv"
import { getReviewSummary } from "@/lib/approval"

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function createMockReviewSummary(overrides: Record<string, unknown> = {}) {
  return {
    filingYear: {
      id: "fy-001",
      calendarYear: 2024,
      status: "REVIEWED",
    },
    client: {
      id: "client-001",
      firstName: "John",
      lastName: "Doe",
      tin: "123456789",
      tinType: "SSN",
    },
    accounts: [
      {
        foreignAccountId: "fa-001",
        institutionName: "Swiss National Bank",
        accountNumber: "CH93-0076-2011-6238-5295-7",
        accountType: "BANK",
        country: "CH",
        maxValueLocal: 75000,
        currencyCode: "CHF",
        exchangeRate: 0.88,
        maxValueUsd: 85227.27,
        isValueUnknown: false,
        reviewedAt: new Date("2024-11-15T10:30:00Z"),
        reviewedBy: "Jane Smith",
        corrections: null,
      },
    ],
    aggregateMaxValueUSD: 85227.27,
    exceedsThreshold: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// generateFBARCsv
// ---------------------------------------------------------------------------

describe("generateFBARCsv", () => {
  it("generates valid CSV with correct headers", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateFBARCsv("fy-001")

    expect(csv).toContain("Filing Year")
    expect(csv).toContain("Filer Last Name")
    expect(csv).toContain("Filer First Name")
    expect(csv).toContain("Filer TIN")
    expect(csv).toContain("Account Number")
    expect(csv).toContain("Institution Name")
    expect(csv).toContain("Account Type")
    expect(csv).toContain("Country")
    expect(csv).toContain("Currency Code")
    expect(csv).toContain("Max Value (Local Currency)")
    expect(csv).toContain("Exchange Rate")
    expect(csv).toContain("Max Value (USD)")
    expect(csv).toContain("Value Unknown")
    expect(csv).toContain("Reviewed By")
    expect(csv).toContain("Reviewed At")
  })

  it("masks TIN in output showing only last 4 digits", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateFBARCsv("fy-001")

    // The full TIN should never appear
    expect(csv).not.toContain("123456789")
    // Masked format should appear
    expect(csv).toContain("***-**-6789")
  })

  it("handles null values as empty strings", async () => {
    const summary = createMockReviewSummary({
      accounts: [
        {
          foreignAccountId: "fa-001",
          institutionName: "Test Bank",
          accountNumber: "1234",
          accountType: "BANK",
          country: null,
          maxValueLocal: null,
          currencyCode: null,
          exchangeRate: null,
          maxValueUsd: null,
          isValueUnknown: false,
          reviewedAt: null,
          reviewedBy: null,
          corrections: null,
        },
      ],
    })
    vi.mocked(getReviewSummary).mockResolvedValueOnce(summary)

    const csv = await generateFBARCsv("fy-001")

    // CSV should still be parseable and contain the account row
    expect(csv).toContain("Test Bank")
    expect(csv).toContain("1234")
  })

  it("includes a summary row at the bottom with aggregate max value", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateFBARCsv("fy-001")

    // The summary row has the aggregate max value and the label
    expect(csv).toContain("85227.27")
    expect(csv).toContain("Aggregate Max Value (USD)")
  })

  it("produces multiple rows for multiple accounts", async () => {
    const summary = createMockReviewSummary({
      accounts: [
        {
          foreignAccountId: "fa-001",
          institutionName: "Swiss National Bank",
          accountNumber: "CH93-001",
          accountType: "BANK",
          country: "CH",
          maxValueLocal: 50000,
          currencyCode: "CHF",
          exchangeRate: 0.88,
          maxValueUsd: 56818.18,
          isValueUnknown: false,
          reviewedAt: new Date("2024-11-15T10:30:00Z"),
          reviewedBy: "Jane Smith",
          corrections: null,
        },
        {
          foreignAccountId: "fa-002",
          institutionName: "Deutsche Bank",
          accountNumber: "DE89-002",
          accountType: "BANK",
          country: "DE",
          maxValueLocal: 30000,
          currencyCode: "EUR",
          exchangeRate: 0.92,
          maxValueUsd: 32608.7,
          isValueUnknown: false,
          reviewedAt: new Date("2024-11-16T14:00:00Z"),
          reviewedBy: "Jane Smith",
          corrections: null,
        },
      ],
      aggregateMaxValueUSD: 89426.88,
    })
    vi.mocked(getReviewSummary).mockResolvedValueOnce(summary)

    const csv = await generateFBARCsv("fy-001")

    expect(csv).toContain("Swiss National Bank")
    expect(csv).toContain("Deutsche Bank")
    expect(csv).toContain("CH93-001")
    expect(csv).toContain("DE89-002")

    // Count data rows: header + 2 accounts + 1 summary = 4 lines
    const lines = csv.split("\n").filter((l) => l.trim().length > 0)
    expect(lines.length).toBe(4)
  })

  it("formats boolean isValueUnknown as Yes/No", async () => {
    const summary = createMockReviewSummary({
      accounts: [
        {
          foreignAccountId: "fa-001",
          institutionName: "Test Bank",
          accountNumber: "1234",
          accountType: "BANK",
          country: "CH",
          maxValueLocal: 0,
          currencyCode: "CHF",
          exchangeRate: null,
          maxValueUsd: null,
          isValueUnknown: true,
          reviewedAt: null,
          reviewedBy: null,
          corrections: null,
        },
      ],
    })
    vi.mocked(getReviewSummary).mockResolvedValueOnce(summary)

    const csv = await generateFBARCsv("fy-001")
    expect(csv).toContain("Yes")
  })
})

// ---------------------------------------------------------------------------
// generateAccountsCsv
// ---------------------------------------------------------------------------

describe("generateAccountsCsv", () => {
  it("generates simplified CSV with correct headers", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateAccountsCsv("fy-001")

    expect(csv).toContain("Account Number")
    expect(csv).toContain("Institution Name")
    expect(csv).toContain("Account Type")
    expect(csv).toContain("Country")
    expect(csv).toContain("City")
    expect(csv).toContain("Currency")
    expect(csv).toContain("Max Balance Local")
    expect(csv).toContain("Max Balance USD")
  })

  it("does not include filer TIN or name columns", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateAccountsCsv("fy-001")

    expect(csv).not.toContain("Filer TIN")
    expect(csv).not.toContain("Filer Last Name")
    expect(csv).not.toContain("Filing Year")
  })

  it("produces account data rows", async () => {
    vi.mocked(getReviewSummary).mockResolvedValueOnce(createMockReviewSummary())

    const csv = await generateAccountsCsv("fy-001")

    expect(csv).toContain("Swiss National Bank")
    expect(csv).toContain("CH93-0076-2011-6238-5295-7")
  })
})
