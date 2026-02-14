import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks - must be declared before imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  prisma: {
    exchangeRate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/treasury", () => ({
  getRate: vi.fn(),
  getRatesForYear: vi.fn(),
}))

import { formatCurrency, convertToUSD, convertBatchToUSD } from "@/lib/currency"
import { getRate, getRatesForYear } from "@/lib/treasury"

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency", () => {
  it("formats USD with dollar sign and commas", () => {
    const result = formatCurrency(1234.56, "USD")
    expect(result).toBe("$1,234.56")
  })

  it("formats EUR with amount followed by currency code", () => {
    const result = formatCurrency(1234.56, "EUR")
    expect(result).toBe("1,234.56 EUR")
  })

  it("formats zero amount for USD", () => {
    const result = formatCurrency(0, "USD")
    expect(result).toBe("$0.00")
  })

  it("formats zero amount for non-USD", () => {
    const result = formatCurrency(0, "JPY")
    expect(result).toBe("0.00 JPY")
  })

  it("formats large amounts with comma separators", () => {
    const result = formatCurrency(1000000.99, "USD")
    expect(result).toBe("$1,000,000.99")
  })

  it("formats large non-USD amounts with comma separators", () => {
    const result = formatCurrency(9999999.5, "GBP")
    expect(result).toBe("9,999,999.50 GBP")
  })

  it("handles case-insensitive currency codes", () => {
    const result = formatCurrency(100, "usd")
    expect(result).toBe("$100.00")
  })
})

// ---------------------------------------------------------------------------
// convertToUSD
// ---------------------------------------------------------------------------

describe("convertToUSD", () => {
  it("returns passthrough for USD (rate 1.0)", async () => {
    const result = await convertToUSD(5000, "USD", 2024)
    expect(result).not.toBeNull()
    expect(result!.usdAmount).toBe(5000)
    expect(result!.exchangeRate).toBe(1.0)
    expect(result!.source).toBe("TREASURY")
  })

  it("converts foreign currency using Treasury rate", async () => {
    vi.mocked(getRate).mockResolvedValueOnce({
      rate: 110,
      source: "treasury_api",
      recordDate: new Date("2024-12-31T00:00:00Z"),
    })

    const result = await convertToUSD(1000, "JPY", 2024)
    expect(result).not.toBeNull()
    // 1000 / 110 = 9.090909... rounded to 9.09
    expect(result!.usdAmount).toBe(9.09)
    expect(result!.exchangeRate).toBe(110)
    expect(result!.source).toBe("TREASURY")
  })

  it("returns null when no exchange rate is available", async () => {
    vi.mocked(getRate).mockResolvedValueOnce(null)

    const result = await convertToUSD(5000, "ZZZ", 2024)
    expect(result).toBeNull()
  })

  it("maps manual source correctly", async () => {
    vi.mocked(getRate).mockResolvedValueOnce({
      rate: 0.85,
      source: "manual",
      recordDate: new Date("2024-12-31T00:00:00Z"),
    })

    const result = await convertToUSD(100, "GBP", 2024)
    expect(result).not.toBeNull()
    expect(result!.source).toBe("MANUAL")
  })

  it("rounds result to 2 decimal places", async () => {
    vi.mocked(getRate).mockResolvedValueOnce({
      rate: 3,
      source: "treasury_api",
      recordDate: new Date("2024-12-31T00:00:00Z"),
    })

    // 100 / 3 = 33.33333... should round to 33.33
    const result = await convertToUSD(100, "BRL", 2024)
    expect(result).not.toBeNull()
    expect(result!.usdAmount).toBe(33.33)
  })
})

// ---------------------------------------------------------------------------
// convertBatchToUSD
// ---------------------------------------------------------------------------

describe("convertBatchToUSD", () => {
  it("returns empty array for empty input", async () => {
    const result = await convertBatchToUSD([], 2024)
    expect(result).toEqual([])
  })

  it("converts multiple currencies in a batch", async () => {
    vi.mocked(getRatesForYear).mockResolvedValueOnce([
      {
        currencyCode: "EUR",
        countryName: "Euro Zone",
        rate: 0.92,
        recordDate: new Date("2024-12-31T00:00:00Z"),
        source: "treasury_api",
      },
      {
        currencyCode: "JPY",
        countryName: "Japan",
        rate: 150,
        recordDate: new Date("2024-12-31T00:00:00Z"),
        source: "treasury_api",
      },
    ])

    const items = [
      { amount: 920, currencyCode: "EUR" },
      { amount: 15000, currencyCode: "JPY" },
      { amount: 500, currencyCode: "USD" },
    ]

    const results = await convertBatchToUSD(items, 2024)
    expect(results).toHaveLength(3)

    // EUR: 920 / 0.92 = 1000
    expect(results[0].usdAmount).toBe(1000)
    expect(results[0].source).toBe("TREASURY")

    // JPY: 15000 / 150 = 100
    expect(results[1].usdAmount).toBe(100)
    expect(results[1].source).toBe("TREASURY")

    // USD passthrough
    expect(results[2].usdAmount).toBe(500)
    expect(results[2].source).toBe("TREASURY")
  })

  it("returns source MANUAL for unknown currencies", async () => {
    vi.mocked(getRatesForYear).mockResolvedValueOnce([])

    const items = [{ amount: 1000, currencyCode: "ZZZ" }]

    const results = await convertBatchToUSD(items, 2024)
    expect(results).toHaveLength(1)
    expect(results[0].usdAmount).toBe(0)
    expect(results[0].exchangeRate).toBe(0)
    expect(results[0].source).toBe("MANUAL")
  })
})
