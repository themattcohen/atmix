// ---------------------------------------------------------------------------
// Treasury Fiscal Data API Integration
// ---------------------------------------------------------------------------
// Fetches and caches U.S. Treasury year-end exchange rates for FBAR currency
// conversion. The Treasury publishes "Rates of Exchange" quarterly; for FBAR
// purposes we use the December 31 rate of the filing year.
//
// API docs: https://fiscaldata.treasury.gov/api-documentation/
// Dataset:  https://fiscaldata.treasury.gov/datasets/treasury-reporting-rates-exchange/
//
// All rates are expressed as foreign currency units per 1 USD.
// Conversion: USD = foreignAmount / rate
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// In-Memory Cache (OPT-5)
// ---------------------------------------------------------------------------

// Simple in-memory LRU cache for exchange rate lookups
const rateCache = new Map<string, { rate: RateLookupResult; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TREASURY_API_BASE =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange"

/** Maximum results per API page. Treasury supports up to 10000. */
const PAGE_SIZE = 500

/** Polite delay between consecutive API requests (ms). */
const REQUEST_DELAY_MS = 1_100

// ---------------------------------------------------------------------------
// Treasury API response types
// ---------------------------------------------------------------------------

interface TreasuryApiResponse {
  data: TreasuryApiRecord[]
  meta: {
    count: number
    "total-count": number
    "total-pages": number
  }
  links: {
    self: string
    first: string
    prev: string | null
    next: string | null
    last: string
  }
}

interface TreasuryApiRecord {
  country_currency_desc: string
  exchange_rate: string
  record_date: string
}

// ---------------------------------------------------------------------------
// Public return types
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
// Treasury country-currency description to ISO 4217 mapping
// ---------------------------------------------------------------------------
// The Treasury API returns `country_currency_desc` in the format
// "Country-Currency" (e.g., "Japan-Yen"). This map converts those
// descriptions to standard ISO 4217 currency codes.
//
// Covers 100+ currencies to handle the full breadth of FBAR filings.
// ---------------------------------------------------------------------------

const CURRENCY_DESC_TO_ISO: Record<string, string> = {
  // Major currencies
  "Afghanistan-Afghani": "AFN",
  "Albania-Lek": "ALL",
  "Algeria-Dinar": "DZD",
  "Angola-Kwanza": "AOA",
  "Antigua & Barbuda-E. Caribbean Dollar": "XCD",
  "Argentina-Peso": "ARS",
  "Armenia-Dram": "AMD",
  "Australia-Dollar": "AUD",
  "Azerbaijan-Manat": "AZN",
  "Bahamas-Dollar": "BSD",
  "Bahrain-Dinar": "BHD",
  "Bangladesh-Taka": "BDT",
  "Barbados-Dollar": "BBD",
  "Belarus-Ruble": "BYN",
  "Belgium-Euro": "EUR",
  "Belize-Dollar": "BZD",
  "Benin-CFA Franc": "XOF",
  "Bermuda-Dollar": "BMD",
  "Bolivia-Boliviano": "BOB",
  "Bosnia-Marka": "BAM",
  "Botswana-Pula": "BWP",
  "Brazil-Real": "BRL",
  "Brunei-Dollar": "BND",
  "Bulgaria-Lev": "BGN",
  "Burkina Faso-CFA Franc": "XOF",
  "Burma-Kyat": "MMK",
  "Burundi-Franc": "BIF",
  "Cambodia-Riel": "KHR",
  "Cameroon-CFA Franc": "XAF",
  "Canada-Dollar": "CAD",
  "Cape Verde-Escudo": "CVE",
  "Central African Rep.-CFA Franc": "XAF",
  "Chad-CFA Franc": "XAF",
  "Chile-Peso": "CLP",
  "China-Renminbi": "CNY",
  "China-Yuan": "CNY",
  "Colombia-Peso": "COP",
  "Comoros-Franc": "KMF",
  "Congo-CFA Franc": "XAF",
  "Costa Rica-Colon": "CRC",
  "Cote D'Ivoire-CFA Franc": "XOF",
  "Croatia-Kuna": "HRK",
  "Croatia-Euro": "EUR",
  "Cuba-Peso": "CUP",
  "Cyprus-Euro": "EUR",
  "Czech Republic-Koruna": "CZK",
  "Denmark-Krone": "DKK",
  "Djibouti-Franc": "DJF",
  "Dominican Republic-Peso": "DOP",
  "East Timor-Dollar": "USD",
  "Ecuador-Dollar": "USD",
  "Egypt-Pound": "EGP",
  "El Salvador-Dollar": "USD",
  "Equatorial Guinea-CFA Franc": "XAF",
  "Eritrea-Nakfa": "ERN",
  "Estonia-Euro": "EUR",
  "Ethiopia-Birr": "ETB",
  "Euro Zone-Euro": "EUR",
  "Fiji-Dollar": "FJD",
  "Finland-Euro": "EUR",
  "France-Euro": "EUR",
  "Gabon-CFA Franc": "XAF",
  "Gambia-Dalasi": "GMD",
  "Georgia-Lari": "GEL",
  "Germany-Euro": "EUR",
  "Ghana-Cedi": "GHS",
  "Greece-Euro": "EUR",
  "Guatemala-Quetzal": "GTQ",
  "Guinea-Franc": "GNF",
  "Guyana-Dollar": "GYD",
  "Haiti-Gourde": "HTG",
  "Honduras-Lempira": "HNL",
  "Hong Kong-Dollar": "HKD",
  "Hungary-Forint": "HUF",
  "Iceland-Krona": "ISK",
  "India-Rupee": "INR",
  "Indonesia-Rupiah": "IDR",
  "Iran-Rial": "IRR",
  "Iraq-Dinar": "IQD",
  "Ireland-Euro": "EUR",
  "Israel-Shekel": "ILS",
  "Israel-New Shekel": "ILS",
  "Italy-Euro": "EUR",
  "Jamaica-Dollar": "JMD",
  "Japan-Yen": "JPY",
  "Jordan-Dinar": "JOD",
  "Kazakhstan-Tenge": "KZT",
  "Kenya-Shilling": "KES",
  "Korea-Won": "KRW",
  "South Korea-Won": "KRW",
  "Kuwait-Dinar": "KWD",
  "Kyrgyzstan-Som": "KGS",
  "Laos-Kip": "LAK",
  "Latvia-Euro": "EUR",
  "Lebanon-Pound": "LBP",
  "Lesotho-Loti": "LSL",
  "Liberia-Dollar": "LRD",
  "Libya-Dinar": "LYD",
  "Lithuania-Euro": "EUR",
  "Luxembourg-Euro": "EUR",
  "Macau-Pataca": "MOP",
  "Madagascar-Ariary": "MGA",
  "Malawi-Kwacha": "MWK",
  "Malaysia-Ringgit": "MYR",
  "Maldives-Rufiyaa": "MVR",
  "Mali-CFA Franc": "XOF",
  "Malta-Euro": "EUR",
  "Mauritania-Ouguiya": "MRU",
  "Mauritius-Rupee": "MUR",
  "Mexico-Peso": "MXN",
  "Moldova-Leu": "MDL",
  "Mongolia-Tugrik": "MNT",
  "Montenegro-Euro": "EUR",
  "Morocco-Dirham": "MAD",
  "Mozambique-Metical": "MZN",
  "Namibia-Dollar": "NAD",
  "Nepal-Rupee": "NPR",
  "Netherlands-Euro": "EUR",
  "New Zealand-Dollar": "NZD",
  "Nicaragua-Cordoba": "NIO",
  "Niger-CFA Franc": "XOF",
  "Nigeria-Naira": "NGN",
  "North Macedonia-Denar": "MKD",
  "Norway-Krone": "NOK",
  "Oman-Rial": "OMR",
  "Pakistan-Rupee": "PKR",
  "Panama-Balboa": "PAB",
  "Papua New Guinea-Kina": "PGK",
  "Paraguay-Guarani": "PYG",
  "Peru-Sol": "PEN",
  "Philippines-Peso": "PHP",
  "Poland-Zloty": "PLN",
  "Portugal-Euro": "EUR",
  "Qatar-Riyal": "QAR",
  "Romania-Leu": "RON",
  "Russia-Ruble": "RUB",
  "Rwanda-Franc": "RWF",
  "Samoa-Tala": "WST",
  "Sao Tome & Principe-Dobra": "STN",
  "Saudi Arabia-Riyal": "SAR",
  "Senegal-CFA Franc": "XOF",
  "Serbia-Dinar": "RSD",
  "Seychelles-Rupee": "SCR",
  "Sierra Leone-Leone": "SLL",
  "Singapore-Dollar": "SGD",
  "Slovakia-Euro": "EUR",
  "Slovenia-Euro": "EUR",
  "Solomon Islands-Dollar": "SBD",
  "Somalia-Shilling": "SOS",
  "South Africa-Rand": "ZAR",
  "South Sudan-Pound": "SSP",
  "Spain-Euro": "EUR",
  "Sri Lanka-Rupee": "LKR",
  "Sudan-Pound": "SDG",
  "Suriname-Dollar": "SRD",
  "Sweden-Krona": "SEK",
  "Switzerland-Franc": "CHF",
  "Syria-Pound": "SYP",
  "Taiwan-Dollar": "TWD",
  "Tajikistan-Somoni": "TJS",
  "Tanzania-Shilling": "TZS",
  "Thailand-Baht": "THB",
  "Togo-CFA Franc": "XOF",
  "Tonga-Pa'anga": "TOP",
  "Trinidad & Tobago-Dollar": "TTD",
  "Tunisia-Dinar": "TND",
  "Turkey-Lira": "TRY",
  "Turkmenistan-Manat": "TMT",
  "Uganda-Shilling": "UGX",
  "Ukraine-Hryvnia": "UAH",
  "United Arab Emirates-Dirham": "AED",
  "United Kingdom-Pound": "GBP",
  "Uruguay-Peso": "UYU",
  "Uzbekistan-Som": "UZS",
  "Vanuatu-Vatu": "VUV",
  "Venezuela-Bolivar": "VES",
  "Vietnam-Dong": "VND",
  "Yemen-Rial": "YER",
  "Zambia-Kwacha": "ZMW",
  "Zimbabwe-Dollar": "ZWL",
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the Treasury country_currency_desc string to an ISO 4217 code.
 * Falls back to null for unrecognized descriptions.
 */
function resolveISOCode(desc: string): string | null {
  // Direct lookup
  const direct = CURRENCY_DESC_TO_ISO[desc]
  if (direct) return direct

  // Normalized lookup: trim whitespace, normalize dashes
  const normalized = desc.trim().replace(/\s*-\s*/g, "-")
  const normalizedResult = CURRENCY_DESC_TO_ISO[normalized]
  if (normalizedResult) return normalizedResult

  // Case-insensitive fallback
  const lower = desc.toLowerCase()
  for (const [key, code] of Object.entries(CURRENCY_DESC_TO_ISO)) {
    if (key.toLowerCase() === lower) return code
  }

  return null
}

/**
 * Parses a single Treasury API record into a TreasuryRate.
 * Returns null if the record cannot be parsed (unknown currency, bad rate).
 */
function parseRecord(record: TreasuryApiRecord): TreasuryRate | null {
  const currencyCode = resolveISOCode(record.country_currency_desc)
  if (!currencyCode) {
    console.error(
      `[treasury] Unknown currency description: "${record.country_currency_desc}"`
    )
    return null
  }

  const rate = parseFloat(record.exchange_rate)
  if (isNaN(rate) || rate <= 0) {
    console.error(
      `[treasury] Invalid rate "${record.exchange_rate}" for ${record.country_currency_desc}`
    )
    return null
  }

  // Extract country name from the description (everything before the last dash)
  const dashIndex = record.country_currency_desc.lastIndexOf("-")
  const countryName =
    dashIndex > 0
      ? record.country_currency_desc.substring(0, dashIndex).trim()
      : record.country_currency_desc

  return {
    currencyCode,
    countryName,
    rate,
    recordDate: new Date(record.record_date + "T00:00:00Z"),
  }
}

/**
 * Builds the Treasury API URL for a specific record date.
 */
function buildApiUrl(recordDate: string): string {
  const params = new URLSearchParams({
    "fields": "country_currency_desc,exchange_rate,record_date",
    "filter": `record_date:eq:${recordDate}`,
    "page[size]": String(PAGE_SIZE),
  })
  return `${TREASURY_API_BASE}?${params.toString()}`
}

/**
 * Fetches a single page of Treasury rates for a specific date.
 * Returns the raw API response or null on failure.
 */
async function fetchPage(url: string): Promise<TreasuryApiResponse | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      console.error(
        `[treasury] API returned ${response.status}: ${response.statusText} for ${url}`
      )
      return null
    }

    return (await response.json()) as TreasuryApiResponse
  } catch (error) {
    console.error(`[treasury] Fetch failed for ${url}:`, error)
    return null
  }
}

/**
 * Sleeps for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches exchange rates from the Treasury Fiscal Data API for a given year.
 *
 * Attempts the December 31 rate first (the standard FBAR rate date). If
 * unavailable, falls back to September 30 (Q3 end), then the latest
 * available rate in the year.
 *
 * Returns an array of parsed TreasuryRate objects. Returns an empty array
 * if all attempts fail.
 */
export async function fetchTreasuryRates(
  year: number
): Promise<TreasuryRate[]> {
  // Preferred dates in order: Dec 31, Sep 30, Jun 30, Mar 31
  const candidateDates = [
    `${year}-12-31`,
    `${year}-09-30`,
    `${year}-06-30`,
    `${year}-03-31`,
  ]

  for (const date of candidateDates) {
    const rates = await fetchRatesForDate(date)
    if (rates.length > 0) {
      return rates
    }
    // Polite delay between API requests
    await sleep(REQUEST_DELAY_MS)
  }

  console.error(
    `[treasury] No rates found for any quarter in year ${year}`
  )
  return []
}

/**
 * Fetches all rates for a specific record date, handling pagination.
 */
async function fetchRatesForDate(recordDate: string): Promise<TreasuryRate[]> {
  const rates: TreasuryRate[] = []
  let url: string | null = buildApiUrl(recordDate)

  while (url) {
    const response = await fetchPage(url)
    if (!response || response.data.length === 0) break

    for (const record of response.data) {
      const parsed = parseRecord(record)
      if (parsed) {
        rates.push(parsed)
      }
    }

    // Follow pagination if more pages exist
    if (response.links.next) {
      url = response.links.next
      await sleep(REQUEST_DELAY_MS)
    } else {
      url = null
    }
  }

  return rates
}

/**
 * Fetches Treasury rates for the given year and upserts them into the
 * ExchangeRate table. Uses the Prisma upsert with a unique constraint on
 * (currencyCode, recordDate) to avoid duplicates.
 *
 * Returns the count of rates synced.
 */
export async function syncTreasuryRates(year: number): Promise<number> {
  const rates = await fetchTreasuryRates(year)

  if (rates.length === 0) {
    console.error(`[treasury] No rates to sync for year ${year}`)
    return 0
  }

  const now = new Date()
  let syncedCount = 0

  // Batch upserts in a transaction for atomicity
  await prisma.$transaction(
    rates.map((rate) =>
      prisma.exchangeRate.upsert({
        where: {
          currencyCode_recordDate: {
            currencyCode: rate.currencyCode,
            recordDate: rate.recordDate,
          },
        },
        create: {
          currencyCode: rate.currencyCode,
          countryName: rate.countryName,
          rate: rate.rate,
          recordDate: rate.recordDate,
          source: "treasury_api",
          fetchedAt: now,
        },
        update: {
          rate: rate.rate,
          countryName: rate.countryName,
          fetchedAt: now,
        },
      })
    )
  )

  syncedCount = rates.length
  const firstRateDate = rates[0]?.recordDate?.toISOString().split("T")[0] ?? "unknown"
  console.log(
    `[treasury] Synced ${syncedCount} rates for year ${year} (record date: ${firstRateDate})`
  )

  return syncedCount
}

/**
 * Retrieves the exchange rate for a specific currency and filing year.
 *
 * Lookup strategy:
 * 1. For USD, return rate 1.0 immediately (no DB lookup needed).
 * 2. Query the ExchangeRate table for the given currency in the filing year.
 * 3. If no rate exists in DB, trigger a sync from the Treasury API and retry.
 * 4. Returns null if the currency is not available from Treasury.
 *
 * The returned rate is "foreign currency units per 1 USD" as published
 * by Treasury.
 */
export async function getRate(
  currencyCode: string,
  year: number
): Promise<RateLookupResult | null> {
  const code = currencyCode.toUpperCase().trim()

  // USD is always 1:1
  if (code === "USD") {
    return {
      rate: 1.0,
      source: "treasury_api",
      recordDate: new Date(`${year}-12-31T00:00:00Z`),
    }
  }

  // OPT-5: Check in-memory cache first
  const cacheKey = `${code}:${year}`
  const cached = rateCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.rate
  }

  // Step 1: Check DB for existing rate in the given year
  const existing = await findRateInDb(code, year)
  if (existing) {
    // OPT-5: Cache the DB result
    rateCache.set(cacheKey, {
      rate: existing,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return existing
  }

  // Step 2: Sync from Treasury API and retry
  const synced = await syncTreasuryRates(year)
  if (synced === 0) return null

  // Step 3: Retry DB lookup after sync
  const result = await findRateInDb(code, year)
  if (result) {
    // OPT-5: Cache the newly synced result
    rateCache.set(cacheKey, {
      rate: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
  }
  return result
}

/**
 * Queries the ExchangeRate table for a currency rate within a filing year.
 * Prefers the latest available rate in the year (Dec 31 > Sep 30 > etc).
 */
async function findRateInDb(
  currencyCode: string,
  year: number
): Promise<RateLookupResult | null> {
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`)
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`)

  const record = await prisma.exchangeRate.findFirst({
    where: {
      currencyCode,
      recordDate: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    orderBy: {
      recordDate: "desc",
    },
  })

  if (!record) return null

  return {
    rate: Number(record.rate),
    source: record.source,
    recordDate: record.recordDate,
  }
}

/**
 * Returns all exchange rates stored in the DB for a given filing year.
 * If no rates exist for the year, automatically syncs from the Treasury API
 * before returning.
 *
 * Returns rates sorted by currency code for predictable ordering.
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
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`)
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`)

  let records = await prisma.exchangeRate.findMany({
    where: {
      recordDate: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    orderBy: [{ recordDate: "desc" }, { currencyCode: "asc" }],
  })

  // Auto-sync if no rates exist for this year
  if (records.length === 0) {
    await syncTreasuryRates(year)
    records = await prisma.exchangeRate.findMany({
      where: {
        recordDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: [{ recordDate: "desc" }, { currencyCode: "asc" }],
    })
  }

  // Deduplicate: keep only the latest rate per currency code (Dec 31 > Sep 30)
  const seen = new Set<string>()
  const deduplicated: typeof records = []
  for (const record of records) {
    if (!seen.has(record.currencyCode)) {
      seen.add(record.currencyCode)
      deduplicated.push(record)
    }
  }

  return deduplicated.map((r) => ({
    currencyCode: r.currencyCode,
    countryName: r.countryName,
    rate: Number(r.rate),
    recordDate: r.recordDate,
    source: r.source,
  }))
}
