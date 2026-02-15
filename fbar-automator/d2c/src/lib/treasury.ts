/**
 * STUB MODULE — Will be replaced with B2B fbar-automator code when production-ready.
 * See: /Users/matt/atmix/fbar-automator/src/lib/treasury.ts
 *
 * This stub exports the same interface for seamless future integration.
 */

// ---------------------------------------------------------------------------
// Public return types (matching B2B module)
// ---------------------------------------------------------------------------

export interface TreasuryRate {
  currencyCode: string
  countryName: string
  rate: number
  recordDate: Date
}

export interface RateLookupResult {
  rate: number
  source: string
  recordDate: Date
}

// ---------------------------------------------------------------------------
// Public API (stub implementations)
// ---------------------------------------------------------------------------

/**
 * Fetches exchange rates from the Treasury Fiscal Data API for a given year.
 *
 * @param year - The filing year to fetch rates for
 * @returns Array of parsed TreasuryRate objects
 *
 * @stub Returns empty array until B2B module is integrated
 */
export async function fetchTreasuryRates(
  year: number
): Promise<TreasuryRate[]> {
  console.warn(
    `[STUB] fetchTreasuryRates called with year=${year}. B2B integration pending.`
  )

  // @TODO: Replace with actual B2B fbar-automator/src/lib/treasury.ts implementation
  return []
}

/**
 * Fetches Treasury rates for the given year and upserts them into the
 * ExchangeRate table.
 *
 * @param year - The filing year to sync rates for
 * @returns Count of rates synced
 *
 * @stub Returns 0 until B2B module is integrated
 */
export async function syncTreasuryRates(year: number): Promise<number> {
  console.warn(
    `[STUB] syncTreasuryRates called with year=${year}. B2B integration pending.`
  )

  // @TODO: Replace with actual B2B fbar-automator/src/lib/treasury.ts implementation
  return 0
}

/**
 * Retrieves the exchange rate for a specific currency and filing year.
 *
 * @param currencyCode - ISO 4217 currency code (e.g., "EUR", "JPY")
 * @param year - The filing year
 * @returns Rate lookup result or null if not available
 *
 * @stub Returns null until B2B module is integrated
 */
export async function getRate(
  currencyCode: string,
  year: number
): Promise<RateLookupResult | null> {
  console.warn(
    `[STUB] getRate called with currencyCode=${currencyCode}, year=${year}. B2B integration pending.`
  )

  // @TODO: Replace with actual B2B fbar-automator/src/lib/treasury.ts implementation
  return null
}

/**
 * Returns all exchange rates stored in the DB for a given filing year.
 *
 * @param year - The filing year
 * @returns Array of exchange rate records
 *
 * @stub Returns empty array until B2B module is integrated
 */
export async function getRatesForYear(
  year: number
): Promise<
  Array<{
    currencyCode: string
    countryName: string
    rate: number
    recordDate: Date
    source: string
  }>
> {
  console.warn(
    `[STUB] getRatesForYear called with year=${year}. B2B integration pending.`
  )

  // @TODO: Replace with actual B2B fbar-automator/src/lib/treasury.ts implementation
  return []
}
