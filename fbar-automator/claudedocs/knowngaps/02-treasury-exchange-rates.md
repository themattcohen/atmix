# Gap #02: Treasury Exchange Rates

**Severity:** Blocking
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

`d2c/src/lib/treasury.ts` contains four stub functions that all return empty/null values. Without exchange rates, `ForeignAccount.maxValueUsd` cannot be computed from `maxValueLocal + currencyCode`, making it impossible to determine whether accounts meet the FBAR $10,000 threshold and impossible to generate correct XML (FinCEN requires USD values). Every user with a non-USD foreign account is blocked at the accounts step.

The B2B app has a complete, working implementation at `src/lib/treasury.ts` (687 lines). The D2C app already has the `ExchangeRate` Prisma model in schema. This is a near-verbatim port — the only structural difference is a minor schema variation in the unique constraint.

## Current State

**D2C stub** (`d2c/src/lib/treasury.ts`, lines 37-112):

| Function | Current behavior |
|---|---|
| `fetchTreasuryRates(year)` | Returns `[]`, line 45 |
| `syncTreasuryRates(year)` | Returns `0`, line 63 |
| `getRate(currencyCode, year)` | Returns `null`, line 84 |
| `getRatesForYear(year)` | Returns `[]`, line 111 |

All four exported interfaces (`TreasuryRate`, `RateLookupResult`) are already correctly defined and match the B2B types.

**B2B reference** (`src/lib/treasury.ts`, lines 1-687):
- `fetchTreasuryRates(year)` — tries Dec 31, Sep 30, Jun 30, Mar 31 dates in order; handles pagination (lines 396-420)
- `syncTreasuryRates(year)` — calls fetchTreasuryRates, upserts all rates in a Prisma transaction (lines 459-503)
- `getRate(currencyCode, year)` — checks in-memory cache, then DB, auto-syncs if not found, upgrades fallback rates after Jan 15 (lines 518-588)
- `getRatesForYear(year)` — queries DB, auto-syncs if empty, deduplicates per currency (lines 631-686)
- Internal helpers: `CURRENCY_DESC_TO_ISO` map (100+ entries, lines 91-273), `resolveISOCode()` (lines 283-300), `parseRecord()` (lines 306-336), `buildApiUrl()` (lines 341-348), `fetchPage()` (lines 354-373), `sleep()` (lines 378-380), `fetchRatesForDate()` (lines 425-450), `findRateInDb()` (lines 595-622)
- In-memory LRU cache (`rateCache` Map, 1-hour TTL, lines 22-23)

**D2C ExchangeRate schema** (`d2c/prisma/schema.prisma`, lines 125-136):
```prisma
model ExchangeRate {
  id            String              @id @default(cuid())
  currencyCode  String
  countryName   String
  rate          Decimal             @db.Decimal(12, 6)
  recordDate    DateTime
  source        ExchangeRateSource  @default(TREASURY)
  createdAt     DateTime            @default(now())

  @@unique([currencyCode, recordDate, source])
  @@index([currencyCode])
}

enum ExchangeRateSource {
  TREASURY
  MANUAL
}
```

**B2B ExchangeRate schema** (for reference):
The B2B upsert uses `currencyCode_recordDate` as the unique constraint name (implying `@@unique([currencyCode, recordDate])` — two-field unique without `source`).

## Schema Difference: Unique Constraint

This is the one adaptation required. D2C uses a three-field unique constraint `[currencyCode, recordDate, source]`, while B2B uses a two-field constraint `[currencyCode, recordDate]`.

**B2B upsert** (`src/lib/treasury.ts`, lines 472-494):
```ts
prisma.exchangeRate.upsert({
  where: {
    currencyCode_recordDate: {     // <-- two-field unique key name
      currencyCode: rate.currencyCode,
      recordDate: rate.recordDate,
    },
  },
  create: { ...rate, source: "treasury_api", fetchedAt: now },
  update: { rate: rate.rate, countryName: rate.countryName, fetchedAt: now },
})
```

**D2C upsert must use** the three-field composite key and match the D2C enum value:
```ts
prisma.exchangeRate.upsert({
  where: {
    currencyCode_recordDate_source: {  // <-- three-field unique key name
      currencyCode: rate.currencyCode,
      recordDate: rate.recordDate,
      source: "TREASURY",              // <-- D2C uses ExchangeRateSource enum: "TREASURY" not "treasury_api"
    },
  },
  create: {
    currencyCode: rate.currencyCode,
    countryName: rate.countryName,
    rate: rate.rate,
    recordDate: rate.recordDate,
    source: "TREASURY",                // <-- ExchangeRateSource enum value, not string
    // Note: D2C ExchangeRate has no fetchedAt field — omit it
  },
  update: {
    rate: rate.rate,
    countryName: rate.countryName,
    // No fetchedAt to update
  },
})
```

Also note: D2C `ExchangeRate` does not have a `fetchedAt` field — remove all `fetchedAt` references.

## Implementation Plan

### Step 1: Replace the stub file verbatim, then apply D2C adaptations

Copy the entire contents of `src/lib/treasury.ts` into `d2c/src/lib/treasury.ts`. Then apply the following targeted changes:

**1a. Import path** — change the Prisma import:
```ts
// B2B:
import { prisma } from "@/lib/db"

// D2C (same path, different app root — no change needed if tsconfig paths match):
import { prisma } from "@/lib/db"
```
This is already the correct pattern for D2C (confirmed by `d2c/src/lib/filing-guards.ts` line 1).

**1b. Fix `syncTreasuryRates` — upsert key and source value**

In the `syncTreasuryRates` function (B2B lines 459-503), change the upsert call:

```ts
// OLD (B2B):
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

// NEW (D2C):
prisma.exchangeRate.upsert({
  where: {
    currencyCode_recordDate_source: {
      currencyCode: rate.currencyCode,
      recordDate: rate.recordDate,
      source: "TREASURY",
    },
  },
  create: {
    currencyCode: rate.currencyCode,
    countryName: rate.countryName,
    rate: rate.rate,
    recordDate: rate.recordDate,
    source: "TREASURY",
  },
  update: {
    rate: rate.rate,
    countryName: rate.countryName,
  },
})
```

Also remove `const now = new Date()` (line 467 in B2B) since `fetchedAt` is no longer used.

**1c. Fix `findRateInDb` — `source` field in return**

In `findRateInDb` (B2B lines 595-622), the function returns `record.source`. D2C ExchangeRate stores source as an enum (`ExchangeRateSource`). This will serialize to the string `"TREASURY"` automatically — no change needed beyond ensuring the type is compatible with `RateLookupResult.source: string`.

**1d. Fix `getRatesForYear` — `source` field in map**

In `getRatesForYear` (B2B lines 631-686), the `.map()` return includes `source: r.source`. Since `r.source` is now an `ExchangeRateSource` enum value (`"TREASURY"` or `"MANUAL"`), this maps correctly to `string` in the return type — no change needed.

**1e. Remove `fetchedAt` from `syncTreasuryRates` log** (B2B line 498):

```ts
// B2B:
const firstRateDate = rates[0]?.recordDate?.toISOString().split("T")[0] ?? "unknown"

// D2C: same line, no change — fetchedAt is just not included in create/update
```

### Step 2: Keep everything else identical

All of the following copy verbatim with zero changes:
- `TREASURY_API_BASE` constant (line 29-31)
- `PAGE_SIZE = 500` and `REQUEST_DELAY_MS = 1_100` (lines 33-36)
- `TreasuryApiResponse` and `TreasuryApiRecord` interface types (lines 42-62)
- `TreasuryRate` and `RateLookupResult` exported interfaces (lines 68-79) — already match D2C stub
- Entire `CURRENCY_DESC_TO_ISO` map (lines 91-273) — 100+ currencies
- `resolveISOCode()` (lines 283-300)
- `parseRecord()` (lines 306-336)
- `buildApiUrl()` (lines 341-348)
- `fetchPage()` (lines 354-373)
- `sleep()` (lines 378-380)
- `fetchTreasuryRates()` (lines 396-420) — same date fallback logic
- `fetchRatesForDate()` (lines 425-450) — same pagination
- `getRate()` (lines 518-588) — same cache + auto-sync + upgrade logic
- `getRatesForYear()` (lines 631-686) — same dedup logic

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/treasury.ts` | Replace stub with B2B implementation; change upsert key to `currencyCode_recordDate_source`, source value to `"TREASURY"`, remove `fetchedAt` |

No other files need changes. No new files needed.

## Environment / Config Changes

None. The Treasury Fiscal Data API is public and requires no API key. No additional environment variables are needed.

No schema migrations required — the `ExchangeRate` model already exists in the D2C schema with all required fields.

## Testing

### Quick smoke test (manual)

In the D2C app running locally, open a Node REPL or add a temporary API route:

```ts
import { fetchTreasuryRates, syncTreasuryRates, getRate } from "@/lib/treasury"

// Should return 100+ TreasuryRate objects
const rates = await fetchTreasuryRates(2024)
console.log(rates.length, rates[0])

// Should upsert rates and return count > 0
const count = await syncTreasuryRates(2024)
console.log(count)

// Should return { rate: ~0.91, source: "TREASURY", recordDate: Date } for EUR
const eur = await getRate("EUR", 2024)
console.log(eur)

// USD should always return { rate: 1.0, ... } without a DB query
const usd = await getRate("USD", 2024)
console.log(usd)
```

### Unit tests (new file: `d2c/src/lib/__tests__/treasury.test.ts`)

The B2B test suite has 107 total tests covering the XML generator. Consider porting relevant treasury tests:

1. **`resolveISOCode`**: Test direct lookup (`"Japan-Yen"` → `"JPY"`), normalized lookup (extra whitespace), case-insensitive fallback, unknown description returns null.

2. **`parseRecord`**: Valid record returns `TreasuryRate`; unknown currency returns null; invalid rate (NaN, 0, negative) returns null.

3. **`getRate` — USD shortcut**: Returns `{ rate: 1.0 }` without any DB/API call.

4. **`getRate` — cache hit**: Call twice for same currency/year; second call should not trigger DB query (mock prisma to assert call count).

5. **`getRatesForYear` — deduplication**: Insert two rates for `EUR` (Dec 31 and Sep 30); assert only Dec 31 is returned.

6. **`syncTreasuryRates` — upsert idempotency**: Call twice for same year; assert total ExchangeRate count doesn't double.

### Integration check via accounts page

After implementing, create a D2C test account with a EUR-denominated foreign account. The accounts page or accounts API should:
1. Call `getRate("EUR", calendarYear)` to retrieve the rate
2. Compute `maxValueUsd = Number(maxValueLocal) / rate`
3. Store `maxValueUsd` on `ForeignAccount`

If this works, the threshold calculation and XML generation are both unblocked.

## Risks / Notes

1. **Treasury API availability**: The Treasury Fiscal Data API (`fiscaldata.treasury.gov`) is a public government API with no rate limiting beyond good-citizen throttling. The implementation already uses 1.1-second delays between pages. The API has been reliable but may have outages during government shutdowns — the DB cache prevents repeated calls for the same year.

2. **Dec 31 rate availability**: FinCEN requires the December 31 rate for the filing year. The Treasury typically publishes this in early January. The `fetchTreasuryRates` fallback sequence (Dec 31 → Sep 30 → Jun 30 → Mar 31) handles the window between Jan 1 and when Dec 31 data is published. The `getRate` upgrade logic (B2B lines 546-564) automatically re-fetches after Jan 15 to replace a Sep 30 fallback with Dec 31 data — this logic is preserved verbatim.

3. **`currencyCode_recordDate_source` unique constraint name**: Prisma generates composite unique constraint names from field names joined by underscores. The D2C schema has `@@unique([currencyCode, recordDate, source])` which generates the Prisma client accessor `currencyCode_recordDate_source`. Verify this matches after running `prisma generate` — if the generated name differs, the upsert `where` clause will fail at runtime with a TypeScript error.

4. **No `fetchedAt` tracking**: The D2C schema omits `fetchedAt` from `ExchangeRate`. This means there's no way to know when rates were last synced from the API. This is acceptable for now — rates change quarterly and the in-memory cache prevents excessive API calls. If staleness tracking becomes important later, add a `fetchedAt DateTime @default(now())` field to the schema (requires migration).

5. **Downstream dependency**: Gap #01 (FinCEN XML generation) depends on `maxValueUsd` being populated on `ForeignAccount` records. Gap #02 (this module) provides `getRate()` which is used by the accounts API to compute and store `maxValueUsd`. Implement Gap #02 first — or at minimum in parallel — to avoid null `maxValueUsd` errors during XML generation.

6. **`ExchangeRateSource` enum vs string**: The B2B `source` field is stored as a plain string (`"treasury_api"`). D2C uses a Prisma enum (`ExchangeRateSource` with values `TREASURY` and `MANUAL`). The source value in all D2C code must be the enum value `"TREASURY"` (not `"treasury_api"`). This difference is limited to the `syncTreasuryRates` upsert and is the only non-trivial adaptation in this gap.
