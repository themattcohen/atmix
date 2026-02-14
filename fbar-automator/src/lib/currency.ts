// ---------------------------------------------------------------------------
// Currency Conversion for FBAR Filings
// ---------------------------------------------------------------------------
// Converts foreign currency amounts to USD using U.S. Treasury year-end
// exchange rates as required by FinCEN for FBAR (Form 114) filings.
//
// Treasury rates are expressed as "foreign currency units per 1 USD."
// Conversion formula: USD = foreignAmount / rate
//
// Reference: PRD Section 7, Appendix B
// ---------------------------------------------------------------------------

import { getRate, getRatesForYear } from "@/lib/treasury"
import type { RateLookupResult } from "@/lib/treasury"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversionResult {
  usdAmount: number
  exchangeRate: number
  source: "TREASURY" | "MANUAL"
  recordDate: Date
}

export interface BatchConversionItem {
  amount: number
  currencyCode: string
}

export interface BatchConversionResult extends BatchConversionItem {
  usdAmount: number
  exchangeRate: number
  source: "TREASURY" | "MANUAL"
  recordDate: Date
}

// ---------------------------------------------------------------------------
// Single conversion
// ---------------------------------------------------------------------------

/**
 * Converts a foreign currency amount to USD using the Treasury exchange rate
 * for the specified filing year.
 *
 * Treasury rates are "foreign currency units per 1 USD," so the conversion
 * formula is:
 *
 *   USD = foreignAmount / exchangeRate
 *
 * The result is rounded to the nearest cent (2 decimal places). Per FBAR
 * instructions, the reported value should be in whole dollars, but we
 * preserve cents for intermediate calculations. The caller can truncate
 * to whole dollars at export time.
 *
 * Returns null if no exchange rate is available for the given currency and
 * year. The caller should prompt for a manual rate in that case.
 */
export async function convertToUSD(
  amount: number,
  currencyCode: string,
  year: number
): Promise<ConversionResult | null> {
  const code = currencyCode.toUpperCase().trim()

  // USD to USD: no conversion needed
  if (code === "USD") {
    return {
      usdAmount: roundToCents(amount),
      exchangeRate: 1.0,
      source: "TREASURY",
      recordDate: new Date(`${year}-12-31T00:00:00Z`),
    }
  }

  const rateLookup = await getRate(code, year)
  if (!rateLookup) {
    return null
  }

  const usdAmount = amount / rateLookup.rate

  return {
    usdAmount: roundToCents(usdAmount),
    exchangeRate: rateLookup.rate,
    source: mapSource(rateLookup.source),
    recordDate: rateLookup.recordDate,
  }
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

/**
 * Converts multiple foreign currency amounts to USD in a single operation.
 *
 * Optimized to fetch all rates for the year once, then perform all
 * conversions without additional DB queries. Items whose currency has no
 * available rate are returned with usdAmount of 0, exchangeRate of 0,
 * and source of "MANUAL" to indicate that manual input is required.
 */
export async function convertBatchToUSD(
  items: BatchConversionItem[],
  year: number
): Promise<BatchConversionResult[]> {
  if (items.length === 0) return []

  // Pre-fetch all rates for the year into a lookup map
  const yearRates = await getRatesForYear(year)
  const rateMap = new Map<string, { rate: number; recordDate: Date; source: string }>()

  for (const r of yearRates) {
    rateMap.set(r.currencyCode, {
      rate: r.rate,
      recordDate: r.recordDate,
      source: r.source,
    })
  }

  // USD is always 1:1
  rateMap.set("USD", {
    rate: 1.0,
    recordDate: new Date(`${year}-12-31T00:00:00Z`),
    source: "treasury_api",
  })

  return items.map((item) => {
    const code = item.currencyCode.toUpperCase().trim()
    const rateInfo = rateMap.get(code)

    if (!rateInfo) {
      // Currency not found in Treasury rates; requires manual rate entry
      return {
        amount: item.amount,
        currencyCode: item.currencyCode,
        usdAmount: 0,
        exchangeRate: 0,
        source: "MANUAL" as const,
        recordDate: new Date(`${year}-12-31T00:00:00Z`),
      }
    }

    const usdAmount = code === "USD" ? item.amount : item.amount / rateInfo.rate

    return {
      amount: item.amount,
      currencyCode: item.currencyCode,
      usdAmount: roundToCents(usdAmount),
      exchangeRate: rateInfo.rate,
      source: mapSource(rateInfo.source),
      recordDate: rateInfo.recordDate,
    }
  })
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/**
 * Formats a numeric amount as a human-readable currency string.
 *
 * - USD: "$1,234.56"
 * - Non-USD: "1,234.56 EUR"
 *
 * Uses Intl.NumberFormat for locale-aware number formatting.
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const code = currencyCode.toUpperCase().trim()

  if (code === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // For non-USD: format the number then append the currency code
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${formatted} ${code}`
}

/**
 * Formats a USD amount as whole dollars for FBAR reporting.
 * FBAR instructions require amounts rounded to nearest dollar.
 */
export function formatFBARDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Rounds a number to 2 decimal places (cents).
 * Uses the "round half away from zero" strategy matching standard
 * financial rounding.
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Maps the treasury source string to the Prisma ExchangeRateSource enum
 * value used in application types.
 */
function mapSource(source: string): "TREASURY" | "MANUAL" {
  if (source === "treasury_api") return "TREASURY"
  return "MANUAL"
}
