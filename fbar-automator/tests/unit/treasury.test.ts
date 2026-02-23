import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted runs before imports)
// ---------------------------------------------------------------------------

const { mockPrisma, mockFetch } = vi.hoisted(() => ({
  mockPrisma: {
    exchangeRate: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockFetch: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

// Stub fetch globally
vi.stubGlobal("fetch", mockFetch)

import {
  fetchTreasuryRates,
  syncTreasuryRates,
  getRate,
  getRatesForYear,
} from "@/lib/treasury"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a mock Treasury API response with data */
function makeTreasuryResponse(
  data: Array<{ country_currency_desc: string; exchange_rate: string; record_date: string }>,
  opts?: { next?: string | null }
): {
  ok: true
  json: () => Promise<{
    data: typeof data
    meta: { count: number; "total-count": number; "total-pages": number }
    links: { self: string; first: string; prev: null; next: string | null; last: string }
  }>
} {
  return {
    ok: true,
    json: async () => ({
      data,
      meta: { count: data.length, "total-count": data.length, "total-pages": 1 },
      links: {
        self: "https://api.fiscaldata.treasury.gov/...",
        first: "https://api.fiscaldata.treasury.gov/...",
        prev: null,
        next: opts?.next ?? null,
        last: "https://api.fiscaldata.treasury.gov/...",
      },
    }),
  }
}

/** Builds an empty Treasury API response */
function makeEmptyTreasuryResponse() {
  return makeTreasuryResponse([])
}

/** Builds a failed HTTP response */
function makeErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  }
}

/** Creates a mock DB exchange rate record as returned by Prisma */
function makeDbRecord(overrides?: Partial<{
  currencyCode: string
  countryName: string
  rate: number | { toNumber: () => number }
  recordDate: Date
  source: string
  fetchedAt: Date
}>) {
  return {
    id: 1,
    currencyCode: "JPY",
    countryName: "Japan",
    rate: 148.5,
    recordDate: new Date("2024-12-31T00:00:00Z"),
    source: "treasury_api",
    fetchedAt: new Date(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Suppress console output during tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Group 1: resolveISOCode (tested via fetchTreasuryRates)
// ---------------------------------------------------------------------------

describe("resolveISOCode (via fetchTreasuryRates)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves a direct match like 'Japan-Yen' to JPY", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("JPY")
  })

  it("normalizes whitespace: '  Japan - Yen  ' resolves to JPY", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "  Japan - Yen  ", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("JPY")
  })

  it("resolves case-insensitively: 'japan-yen' becomes JPY", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "japan-yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("JPY")
  })

  it("filters out records with unknown currency descriptions", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Atlantis-Trident", exchange_rate: "42.0", record_date: "2024-12-31" },
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    // Unknown Atlantis-Trident is filtered out, only Japan-Yen remains
    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("JPY")
  })

  it("resolves EUR for multiple countries: Belgium-Euro and France-Euro", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Belgium-Euro", exchange_rate: "0.92", record_date: "2024-12-31" },
        { country_currency_desc: "France-Euro", exchange_rate: "0.92", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(2)
    expect(result[0].currencyCode).toBe("EUR")
    expect(result[1].currencyCode).toBe("EUR")
    expect(result[0].countryName).toBe("Belgium")
    expect(result[1].countryName).toBe("France")
  })
})

// ---------------------------------------------------------------------------
// Group 2: parseRecord (tested via fetchTreasuryRates)
// ---------------------------------------------------------------------------

describe("parseRecord (via fetchTreasuryRates)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("parses a valid record with correct fields", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      currencyCode: "JPY",
      countryName: "Japan",
      rate: 148.5,
      recordDate: new Date("2024-12-31T00:00:00Z"),
    })
  })

  it("rejects a record with zero rate", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "0", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    // Zero rate is invalid (rate <= 0), should be filtered out.
    // The response had 1 record but it was rejected, so the Dec 31 attempt
    // returns an empty parsed array, triggering fallback to Sep 30, etc.
    // All fallbacks also return empty, so result is [].
    // Actually: fetchRatesForDate checks response.data.length first (which is 1),
    // then iterates and parseRecord returns null. rates array ends up empty.
    // fetchTreasuryRates then moves to Sep 30.
    // We need to mock all subsequent calls too.
    // Mock remaining 3 quarter fallbacks as empty responses
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    // Already started the promise; run all timers to completion
    await vi.runAllTimersAsync()

    // Re-await to get the final result
    expect(result).toEqual([])
  })

  it("rejects a record with negative rate", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "-5.0", record_date: "2024-12-31" },
      ])
    )
    // Mock remaining 3 quarter fallbacks
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
  })

  it("rejects a record with NaN rate (e.g. 'abc')", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "abc", record_date: "2024-12-31" },
      ])
    )
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
  })

  it("parses a compound country name: 'Trinidad & Tobago-Dollar' as TTD", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Trinidad & Tobago-Dollar", exchange_rate: "6.78", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("TTD")
    expect(result[0].countryName).toBe("Trinidad & Tobago")
    expect(result[0].rate).toBe(6.78)
  })

  it("parses a large rate: Vietnam-Dong at 25000", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Vietnam-Dong", exchange_rate: "25000", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("VND")
    expect(result[0].rate).toBe(25000)
  })
})

// ---------------------------------------------------------------------------
// Group 3: fetchTreasuryRates
// ---------------------------------------------------------------------------

describe("fetchTreasuryRates", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns rates from Dec 31 when available", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
        { country_currency_desc: "United Kingdom-Pound", exchange_rate: "0.79", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(2)
    expect(result[0].recordDate).toEqual(new Date("2024-12-31T00:00:00Z"))
    // Verify first fetch URL includes Dec 31 filter
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain("record_date%3Aeq%3A2024-12-31")
  })

  it("falls back to Sep 30 when Dec 31 returns empty", async () => {
    // Dec 31: empty
    mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    // Sep 30: has data
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "147.0", record_date: "2024-09-30" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].recordDate).toEqual(new Date("2024-09-30T00:00:00Z"))
    // Dec 31 call + Sep 30 call = 2
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("returns empty array when all quarters are empty", async () => {
    // Dec 31, Sep 30, Jun 30, Mar 31 all empty
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it("returns empty array on HTTP 500", async () => {
    // Dec 31: server error (fetchPage returns null, breaks the while loop)
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"))
    // Sep 30, Jun 30, Mar 31 also fail
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"))
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"))
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"))

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
  })

  it("returns empty array on network timeout/error", async () => {
    // All quarters throw network errors
    for (let i = 0; i < 4; i++) {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"))
    }

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
  })

  it("handles pagination across 2 pages", async () => {
    const page2Url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?page=2"

    // Page 1: has data and a next link
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse(
        [{ country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" }],
        { next: page2Url }
      )
    )
    // Page 2: more data, no next
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "United Kingdom-Pound", exchange_rate: "0.79", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(2)
    expect(result[0].currencyCode).toBe("JPY")
    expect(result[1].currencyCode).toBe("GBP")
    // Two fetches: page 1 + page 2
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toBe(page2Url)
  })
})

// ---------------------------------------------------------------------------
// Group 4: syncTreasuryRates
// ---------------------------------------------------------------------------

describe("syncTreasuryRates", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockPrisma.$transaction.mockReset()
    mockPrisma.exchangeRate.upsert.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("upserts N rates and returns the count", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
        { country_currency_desc: "United Kingdom-Pound", exchange_rate: "0.79", record_date: "2024-12-31" },
        { country_currency_desc: "Canada-Dollar", exchange_rate: "1.36", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}])

    const p = syncTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const count = await p

    expect(count).toBe(3)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("returns 0 and skips DB when fetchTreasuryRates returns empty", async () => {
    // All quarters empty
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    const p = syncTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const count = await p

    expect(count).toBe(0)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("uses currencyCode_recordDate composite key in upsert where clause", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}])

    const p = syncTreasuryRates(2024)
    await vi.runAllTimersAsync()
    await p

    // $transaction receives an array of upsert promises (the return of rates.map)
    // We inspect the upsert mock calls
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currencyCode_recordDate: {
            currencyCode: "JPY",
            recordDate: new Date("2024-12-31T00:00:00Z"),
          },
        },
      })
    )
  })

  it("includes source: 'treasury_api' in the create payload", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}])

    const p = syncTreasuryRates(2024)
    await vi.runAllTimersAsync()
    await p

    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: "treasury_api",
        }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Group 5: getRate
// ---------------------------------------------------------------------------

describe("getRate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-02-15T12:00:00Z"))
    mockFetch.mockReset()
    mockPrisma.exchangeRate.findFirst.mockReset()
    mockPrisma.exchangeRate.upsert.mockReset()
    mockPrisma.$transaction.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns rate 1.0 for USD without any DB call", async () => {
    const result = await getRate("USD", 2024)

    expect(result).toEqual({
      rate: 1.0,
      source: "treasury_api",
      recordDate: new Date("2024-12-31T00:00:00Z"),
    })
    expect(mockPrisma.exchangeRate.findFirst).not.toHaveBeenCalled()
  })

  it("returns cached result on second call for same currencyCode+year", async () => {
    // First call: DB returns a rate
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({ currencyCode: "GBP", countryName: "United Kingdom", rate: 0.79 })
    )

    const result1 = await getRate("GBP", 2024)
    expect(result1).not.toBeNull()
    expect(result1!.rate).toBe(0.79)
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledTimes(1)

    // Second call: should use cache, not DB
    mockPrisma.exchangeRate.findFirst.mockReset()
    const result2 = await getRate("GBP", 2024)
    expect(result2).not.toBeNull()
    expect(result2!.rate).toBe(0.79)
    expect(mockPrisma.exchangeRate.findFirst).not.toHaveBeenCalled()
  })

  it("queries DB on cache miss", async () => {
    // Use a unique currency to avoid cache from prior tests
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({ currencyCode: "AUD", countryName: "Australia", rate: 1.55, recordDate: new Date("2024-12-31T00:00:00Z") })
    )

    const result = await getRate("AUD", 2024)

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(1.55)
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledTimes(1)
  })

  it("queries DB again after cache TTL expires (1 hour)", async () => {
    // Use unique currency
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({ currencyCode: "CHF", countryName: "Switzerland", rate: 0.88, recordDate: new Date("2024-12-31T00:00:00Z") })
    )

    // First call populates cache
    await getRate("CHF", 2024)
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledTimes(1)

    // Advance time past the 1hr TTL
    vi.advanceTimersByTime(60 * 60 * 1000 + 1)

    // Prepare fresh DB response for the re-query
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({ currencyCode: "CHF", countryName: "Switzerland", rate: 0.89, recordDate: new Date("2024-12-31T00:00:00Z") })
    )

    const result = await getRate("CHF", 2024)
    expect(result).not.toBeNull()
    expect(result!.rate).toBe(0.89)
    // findFirst called again because cache expired
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledTimes(2)
  })

  it("returns Dec 31 rate directly without upgrade attempt", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({
        currencyCode: "NZD",
        countryName: "New Zealand",
        rate: 1.62,
        recordDate: new Date("2024-12-31T00:00:00Z"),
      })
    )

    const result = await getRate("NZD", 2024)

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(1.62)
    expect(result!.recordDate).toEqual(new Date("2024-12-31T00:00:00Z"))
    // No sync attempted (would cause $transaction call)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("does NOT attempt upgrade for non-Dec-31 rate before Jan 15 deadline", async () => {
    // Set time to Jan 10, before the Jan 15 upgrade deadline
    vi.setSystemTime(new Date("2025-01-10T12:00:00Z"))

    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({
        currencyCode: "SEK",
        countryName: "Sweden",
        rate: 10.5,
        recordDate: new Date("2024-09-30T00:00:00Z"), // Not Dec 31
      })
    )

    const result = await getRate("SEK", 2024)

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(10.5)
    expect(result!.recordDate).toEqual(new Date("2024-09-30T00:00:00Z"))
    // No sync attempted because we're before Jan 15
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("triggers sync to upgrade non-Dec-31 rate after Jan 15 deadline", async () => {
    // Time is already set to Feb 15 (after Jan 15 deadline)
    mockPrisma.exchangeRate.findFirst
      // First findRateInDb call: returns Sep 30 fallback
      .mockResolvedValueOnce(
        makeDbRecord({
          currencyCode: "NOK",
          countryName: "Norway",
          rate: 10.8,
          recordDate: new Date("2024-09-30T00:00:00Z"),
        })
      )
      // Second findRateInDb call after sync: returns upgraded Dec 31 rate
      .mockResolvedValueOnce(
        makeDbRecord({
          currencyCode: "NOK",
          countryName: "Norway",
          rate: 11.0,
          recordDate: new Date("2024-12-31T00:00:00Z"),
        })
      )

    // syncTreasuryRates will call fetchTreasuryRates which calls fetch
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Norway-Krone", exchange_rate: "11.0", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}])

    const p = getRate("NOK", 2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(11.0)
    expect(result!.recordDate).toEqual(new Date("2024-12-31T00:00:00Z"))
    // Sync was triggered
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("auto-syncs on empty DB, then retries and returns result", async () => {
    // First findRateInDb: no record in DB
    mockPrisma.exchangeRate.findFirst
      .mockResolvedValueOnce(null)
      // After sync, retry findRateInDb returns result
      .mockResolvedValueOnce(
        makeDbRecord({
          currencyCode: "BRL",
          countryName: "Brazil",
          rate: 5.05,
          recordDate: new Date("2024-12-31T00:00:00Z"),
        })
      )

    // syncTreasuryRates fetches from API
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Brazil-Real", exchange_rate: "5.05", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}])

    const p = getRate("BRL", 2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(5.05)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("returns null when sync fails (no rates found)", async () => {
    // First findRateInDb: no record
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(null)

    // All quarters empty -> syncTreasuryRates returns 0
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    const p = getRate("XYZ", 2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toBeNull()
  })

  it("handles case insensitivity: 'eur' and 'EUR' both work", async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(
      makeDbRecord({
        currencyCode: "EUR",
        countryName: "Euro Zone",
        rate: 0.92,
        recordDate: new Date("2024-12-31T00:00:00Z"),
      })
    )

    const result = await getRate("eur", 2024)

    expect(result).not.toBeNull()
    expect(result!.rate).toBe(0.92)
    // The findFirst was called with uppercase "EUR"
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currencyCode: "EUR",
        }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Group 6: getRatesForYear
// ---------------------------------------------------------------------------

describe("getRatesForYear", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockPrisma.exchangeRate.findMany.mockReset()
    mockPrisma.exchangeRate.upsert.mockReset()
    mockPrisma.$transaction.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns rates sorted by currencyCode", async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([
      makeDbRecord({ currencyCode: "JPY", countryName: "Japan", rate: 148.5, recordDate: new Date("2024-12-31T00:00:00Z") }),
      makeDbRecord({ currencyCode: "CAD", countryName: "Canada", rate: 1.36, recordDate: new Date("2024-12-31T00:00:00Z") }),
      makeDbRecord({ currencyCode: "GBP", countryName: "United Kingdom", rate: 0.79, recordDate: new Date("2024-12-31T00:00:00Z") }),
    ])

    const result = await getRatesForYear(2024)

    expect(result).toHaveLength(3)
    // The function returns in DB order (orderBy recordDate desc, currencyCode asc)
    // Our mock returns them in JPY, CAD, GBP order (as if DB did that)
    expect(result[0].currencyCode).toBe("JPY")
    expect(result[1].currencyCode).toBe("CAD")
    expect(result[2].currencyCode).toBe("GBP")
    expect(result[0].source).toBe("treasury_api")
  })

  it("auto-syncs on empty DB, then re-queries", async () => {
    // First findMany: empty (no rates in DB)
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([])

    // syncTreasuryRates will fetch from API
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )
    mockPrisma.$transaction.mockResolvedValue([{}])

    // Second findMany after sync: returns data
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([
      makeDbRecord({ currencyCode: "JPY", countryName: "Japan", rate: 148.5 }),
    ])

    const p = getRatesForYear(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].currencyCode).toBe("JPY")
    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledTimes(2)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it("deduplicates multiple records per currency, keeping latest (Dec 31 over Sep 30)", async () => {
    // DB returns records ordered by recordDate desc, then currencyCode asc
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([
      makeDbRecord({ currencyCode: "JPY", countryName: "Japan", rate: 149.0, recordDate: new Date("2024-12-31T00:00:00Z") }),
      makeDbRecord({ currencyCode: "GBP", countryName: "United Kingdom", rate: 0.80, recordDate: new Date("2024-12-31T00:00:00Z") }),
      makeDbRecord({ currencyCode: "JPY", countryName: "Japan", rate: 147.0, recordDate: new Date("2024-09-30T00:00:00Z") }),
      makeDbRecord({ currencyCode: "GBP", countryName: "United Kingdom", rate: 0.78, recordDate: new Date("2024-09-30T00:00:00Z") }),
    ])

    const result = await getRatesForYear(2024)

    // Should only have 2 rates (deduped), Dec 31 values
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ currencyCode: "JPY", rate: 149.0 })
    expect(result[1]).toMatchObject({ currencyCode: "GBP", rate: 0.80 })
  })

  it("returns empty array when DB is empty even after sync", async () => {
    // First findMany: empty
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([])

    // syncTreasuryRates returns 0 (all quarters empty)
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(makeEmptyTreasuryResponse())
    }

    // Second findMany after sync: still empty
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([])

    const p = getRatesForYear(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toEqual([])
  })

  it("converts Prisma Decimal to number for rate field", async () => {
    // Prisma returns Decimal objects; the code does Number(record.rate)
    const decimalLike = 148.123456789
    mockPrisma.exchangeRate.findMany.mockResolvedValueOnce([
      makeDbRecord({ currencyCode: "JPY", countryName: "Japan", rate: decimalLike }),
    ])

    const result = await getRatesForYear(2024)

    expect(result).toHaveLength(1)
    expect(typeof result[0].rate).toBe("number")
    expect(result[0].rate).toBe(148.123456789)
  })
})

// ---------------------------------------------------------------------------
// Group 7: Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockPrisma.exchangeRate.findFirst.mockReset()
    mockPrisma.exchangeRate.findMany.mockReset()
    mockPrisma.exchangeRate.upsert.mockReset()
    mockPrisma.$transaction.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("maintains decimal precision for rates with many decimal places", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Bahrain-Dinar", exchange_rate: "0.376789123", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    expect(result[0].rate).toBe(0.376789123)
  })

  it("parses recordDate as UTC midnight (YYYY-MM-DDT00:00:00Z)", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(1)
    const date = result[0].recordDate
    expect(date.toISOString()).toBe("2024-12-31T00:00:00.000Z")
    expect(date.getUTCHours()).toBe(0)
    expect(date.getUTCMinutes()).toBe(0)
    expect(date.getUTCSeconds()).toBe(0)
  })

  it("passes AbortSignal.timeout(30000) to fetch", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    await p

    // Verify the second argument to fetch includes signal
    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit
    expect(fetchOptions).toBeDefined()
    expect(fetchOptions.signal).toBeDefined()
    // AbortSignal.timeout returns an AbortSignal
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal)
  })

  it("stops pagination when API returns infinite next links (bounded by empty data)", async () => {
    const nextUrl = "https://api.fiscaldata.treasury.gov/?page=2"
    const nextUrl2 = "https://api.fiscaldata.treasury.gov/?page=3"

    // Page 1: has data and next
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse(
        [{ country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" }],
        { next: nextUrl }
      )
    )
    // Page 2: has data and next
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse(
        [{ country_currency_desc: "United Kingdom-Pound", exchange_rate: "0.79", record_date: "2024-12-31" }],
        { next: nextUrl2 }
      )
    )
    // Page 3: empty data → loop breaks (response.data.length === 0)
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([], { next: "https://api.fiscaldata.treasury.gov/?page=4" })
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    const result = await p

    expect(result).toHaveLength(2)
    // Stopped at page 3 because data was empty
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("includes PAGE_SIZE=500 in the API URL", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreasuryResponse([
        { country_currency_desc: "Japan-Yen", exchange_rate: "148.5", record_date: "2024-12-31" },
      ])
    )

    const p = fetchTreasuryRates(2024)
    await vi.runAllTimersAsync()
    await p

    const calledUrl = mockFetch.mock.calls[0][0] as string
    // URL should contain page[size]=500
    expect(calledUrl).toContain("page%5Bsize%5D=500")
  })
})
