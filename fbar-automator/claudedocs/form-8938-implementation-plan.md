# Form 8938 (FATCA) Support — Implementation Plan

**Date:** 2026-02-16
**Status:** Plan — no code changes yet
**Scope:** B2B FBAR Automator at `/Users/matt/atmix/fbar-automator/`

---

## Table of Contents

1. [Form 8938 Requirements Summary](#1-form-8938-requirements-summary)
2. [FBAR vs. Form 8938 Comparison](#2-fbar-vs-form-8938-comparison)
3. [Overlap Analysis: What Existing Data Can Be Reused](#3-overlap-analysis)
4. [Schema Changes](#4-schema-changes)
5. [New Types](#5-new-types)
6. [Extraction Pipeline Changes](#6-extraction-pipeline-changes)
7. [Validation Changes](#7-validation-changes)
8. [Export Modules](#8-export-modules)
9. [Approval Workflow Changes](#9-approval-workflow-changes)
10. [API Routes](#10-api-routes)
11. [UI Pages and Components](#11-ui-pages-and-components)
12. [File-by-File Implementation Breakdown](#12-file-by-file-implementation-breakdown)
13. [Phasing and Priority](#13-phasing-and-priority)
14. [Open Questions and Risks](#14-open-questions-and-risks)

---

## 1. Form 8938 Requirements Summary

### What Is Form 8938

Form 8938, "Statement of Specified Foreign Financial Assets," is filed with the IRS as an attachment to the taxpayer's annual income tax return (Form 1040, 1041, 1065, 1120). It was introduced by the Foreign Account Tax Compliance Act (FATCA) in 2010.

Unlike FBAR (FinCEN Form 114), which is filed separately with FinCEN via BSA E-Filing, Form 8938 travels with the tax return through the IRS Modernized e-File (MeF) system or on paper.

### Filing Thresholds

Form 8938 thresholds are more complex than FBAR's single $10,000 aggregate threshold. They vary by filing status and residency:

| Filing Status | Residency | Year-End Threshold | Any-Time Threshold |
|---|---|---|---|
| Single / Married Filing Separately | U.S. resident | $50,000 | $75,000 |
| Married Filing Jointly | U.S. resident | $100,000 | $150,000 |
| Single / Married Filing Separately | Living abroad | $200,000 | $300,000 |
| Married Filing Jointly | Living abroad | $400,000 | $600,000 |
| Specified domestic entities | Any | $50,000 | $75,000 |

Key difference from FBAR: the threshold is assessed against the aggregate value of all "specified foreign financial assets," not just bank accounts. Additionally, there are TWO thresholds per category — a year-end test AND an any-time-during-the-year test. Exceeding EITHER triggers the filing obligation.

### Specified Foreign Financial Assets

Form 8938 covers a broader set of assets than FBAR:

**Category 1: Foreign Financial Accounts (Part V of Form 8938)**
- Deposit accounts (checking, savings, CDs) at foreign financial institutions
- Custodial accounts (brokerage/securities accounts) at foreign financial institutions
- Cash-value life insurance and annuity contracts with foreign issuers

**Category 2: Other Foreign Financial Assets Held for Investment (Part VI of Form 8938)**
- Stock or securities issued by a non-U.S. person (held directly, not in an account)
- Partnership interests in foreign partnerships
- Interests in foreign corporations (beyond what triggers Form 5471)
- Notes, bonds, debentures, or other debt instruments issued by foreign persons
- Interests in foreign trusts or estates
- Foreign-issued financial instruments or contracts (derivatives, swaps, options) with a non-U.S. counterparty
- Interests in foreign pension or deferred compensation plans
- Interests in foreign hedge funds or private equity funds

**NOT reportable on Form 8938:**
- Foreign real estate held directly (though a foreign entity holding real estate IS reportable)
- Tangible personal property (art, jewelry, cars)
- Foreign currency
- Social Security-type benefits from foreign governments

### Form 8938 Structure (Field Reference)

**Part I — Foreign Deposit and Custodial Accounts Summary**
- Line 5: Number of deposit accounts included
- Line 6: Maximum aggregate value of all deposit accounts
- Line 7: Number of custodial accounts included
- Line 8: Maximum aggregate value of all custodial accounts
- Line 9: Were any accounts closed during tax year?

**Part II — Other Foreign Assets Summary**
- Line 10: Number of other foreign assets included
- Line 11: Maximum aggregate value of other foreign assets
- Line 12: Were any assets acquired/disposed of during tax year?

**Part III — Summary of Tax Items Attributable to Reported Assets**
- Aggregate interest, dividends, royalties, capital gains, other income, deductions, and credits from all reported assets
- Where reported on tax return (Schedule B, D, E, etc.)

**Part IV — Excepted Specified Foreign Financial Assets**
- Count of assets already reported on Forms 3520, 3520-A, 5471, 8621, 8865
- These assets' values STILL count toward the threshold, but detailed reporting is not duplicated

**Part V — Detailed Information for Each Foreign Deposit/Custodial Account**
Per account:
- Line 20: Type of account (deposit vs. custodial) — checkbox
- Line 21: Account number or other designation
- Line 22: Check if account was opened or closed during tax year; jointly owned with spouse
- Line 23: Maximum value of account during tax year (USD)
- Line 24: Exchange rate used (if foreign currency)
- Line 25: Source of exchange rate
- Line 26: Foreign currency in which account is denominated
- Line 27: Name and address of financial institution (name, city, country)
- Line 28: Income or gain from this account — type and schedule/form where reported

**Part VI — Detailed Information for Each Other Foreign Asset**
Per asset:
- Line 29: Description of asset
- Line 30: Identifying number or designation (if any)
- Line 31: Date asset was acquired
- Line 32: Check if asset was disposed of during tax year
- Line 33: Maximum value during tax year (USD)
- Line 34: Exchange rate used
- Line 35: Source of exchange rate
- Line 36: Foreign currency of the asset
- Line 37: Issuer/counterparty name, address, country
- Line 38: Income, gain, loss, deductions, credits — type, amount, and where reported on return

### Penalties

| Violation | Amount |
|---|---|
| Failure to file (initial) | $10,000 per form per year |
| Continued failure (after IRS notice) | Additional $10,000 per 30-day period, up to $50,000 maximum |
| Tax underpayment from undisclosed assets | 40% accuracy-related penalty on the understatement |
| Fraud | 75% penalty on underpayment |
| Extended statute of limitations | 6 years (vs. normal 3) if >$5,000 of foreign income omitted |

### Filing Mechanism

Form 8938 is filed as part of the income tax return:
- **Paper filing:** Attach Form 8938 to the paper tax return
- **E-filing:** Transmitted as part of the MeF XML package through tax preparation software (Drake, Lacerte, etc.)
- **Standalone filing is NOT possible:** Form 8938 cannot be filed independently like FBAR

This means the FBAR Automator cannot submit Form 8938 directly. Instead, it must:
1. Prepare the data
2. Export in a format compatible with tax software input (CSV/PDF workpaper at minimum, IRS MeF XML schema at most)
3. The preparer then imports/enters this data into their tax software alongside the rest of the return

---

## 2. FBAR vs. Form 8938 Comparison

| Dimension | FBAR (Form 114) | Form 8938 |
|---|---|---|
| Filed with | FinCEN (Treasury) | IRS (with tax return) |
| Filing mechanism | BSA E-Filing XML upload | Part of MeF XML tax return |
| Threshold | $10,000 aggregate, any time | $50K-$600K depending on status/residency |
| Threshold type | Single: any-time aggregate | Dual: year-end AND any-time |
| Asset scope | Financial accounts only | Financial accounts + stocks, partnerships, instruments, entities |
| Signature authority | Reportable | NOT reportable (financial interest only) |
| Value reported | Maximum value during year | Maximum value AND year-end value |
| Currency conversion | Treasury year-end rate | Same rate, but must report the rate used |
| Income reporting | Not required | Required — must link each asset to income/gain on return |
| Joint accounts | Report full value on each spouse's FBAR | Full value once on joint return; full value on each separate return |
| Penalties | Up to $16,536/form (non-willful); 50% of balance (willful) | $10,000 initial + $50,000 continuation; 40% accuracy penalty |
| Deadline | April 15 (auto-extension to Oct 15) | With tax return (including extensions) |
| Can this tool file it? | YES (BSA E-Filing XML export) | NO (must go through tax software) |

### Key Implications for Implementation

1. **Same accounts often appear on BOTH forms.** A foreign bank account above $10K triggers FBAR and may also trigger 8938 if total assets exceed the 8938 threshold. The tool should detect this dual-reporting requirement.

2. **8938 requires additional data not needed for FBAR:**
   - Year-end account value (FBAR only needs maximum value)
   - Income/gain attributable to each asset and where it appears on the tax return
   - Whether the account was opened/closed during the year
   - Filing status and residency status of the filer (to determine threshold)

3. **8938 covers assets that have no FBAR equivalent:** Foreign stocks held directly, partnership interests, trust interests, financial instruments — these need entirely new data entry workflows.

4. **Export format is different:** FBAR exports as BSA E-Filing XML. Form 8938 must be output as a preparer-friendly format (CSV/PDF) since it gets entered into the tax return through tax software.

---

## 3. Overlap Analysis

### Fields That Can Be Directly Reused from Existing FBAR Data

The following data already captured for FBAR maps directly to Form 8938 Part V fields:

| Existing Field | FBAR Use | 8938 Use | Notes |
|---|---|---|---|
| `ForeignAccount.accountNumber` | Item 18/28 | Part V Line 21 | Identical |
| `ForeignAccount.accountType` | Item 16/26 (bank/securities/other) | Part V Line 20 (deposit/custodial) | **Mapping needed**: FBAR "bank" = 8938 "deposit"; FBAR "securities" = 8938 "custodial" |
| `ForeignAccount.institutionName` | Item 17/27 | Part V Line 27 name | Identical |
| `ForeignAccount.institutionAddress*` | Items 19-23 | Part V Line 27 address | Identical (but 8938 uses city + country, not full address) |
| `ForeignAccount.isJointlyOwned` | Part III indicator | Part V Line 22 checkbox | Compatible |
| `ReviewedAccountYear.maxValueLocal` | Maximum value (local) | Part V Line 23 basis | Same data |
| `ReviewedAccountYear.maxValueUsd` | Item 15 | Part V Line 23 | Same, but 8938 also needs year-end value |
| `ReviewedAccountYear.currencyCode` | For conversion | Part V Line 26 | Identical |
| `ReviewedAccountYear.exchangeRate` | Implicit | Part V Lines 24-25 | 8938 requires explicitly reporting the rate and its source |
| `Client.tin`, `Client.tinType` | Part I | Form header | Identical |
| `Client.firstName`, `Client.lastName` | Part I | Form header | Identical |
| `ExchangeRate` table | Treasury rates | Same treasury rates | Same data, same source |

### Additional Data Needed for Form 8938 (Not Currently Captured)

**Client-level additions:**
- Filing status (single, married filing jointly, married filing separately, head of household) — needed for threshold determination
- Residency status (U.S. resident vs. living abroad) — needed for threshold determination
- Tax return type (1040, 1041, 1065, 1120) — determines entity vs. individual reporting

**Account-level additions (Part V accounts):**
- Year-end value (not just maximum value)
- Whether account was opened during tax year
- Whether account was closed during tax year
- Income earned from this account during tax year
- Type of income (interest, dividends, other)
- Where income is reported on tax return (Schedule B, D, etc.)

**New asset types (Part VI — entirely new):**
- Asset description / type category
- Identifying designation (ISIN, CUSIP, or free text)
- Acquisition date
- Disposition date (if sold/transferred)
- Maximum value during year
- Year-end value (or fair market value at disposition)
- Issuer / counterparty name and address
- Income, gains, losses, deductions, and credits attributable to asset
- Where each is reported on tax return

**Form-level additions:**
- Part IV: Cross-references to other forms (3520, 5471, 8621, 8865)
- Part III: Aggregate income/gain summaries

---

## 4. Schema Changes

### New Enums

```prisma
enum FilingStatusType {
  SINGLE
  MARRIED_FILING_JOINTLY
  MARRIED_FILING_SEPARATELY
  HEAD_OF_HOUSEHOLD
  QUALIFYING_WIDOW

  @@map("filing_status_type")
}

enum ResidencyStatus {
  US_RESIDENT
  LIVING_ABROAD

  @@map("residency_status")
}

enum Form8938AssetCategory {
  DEPOSIT_ACCOUNT      // Part V — deposit
  CUSTODIAL_ACCOUNT    // Part V — custodial
  STOCK_SECURITIES     // Part VI
  PARTNERSHIP_INTEREST // Part VI
  TRUST_ESTATE         // Part VI
  DEBT_INSTRUMENT      // Part VI
  DERIVATIVE_CONTRACT  // Part VI
  PENSION_DEFERRED     // Part VI
  OTHER_FINANCIAL      // Part VI

  @@map("form_8938_asset_category")
}

enum Form8938FilingStatus {
  NOT_STARTED
  IN_PROGRESS
  REVIEWED
  EXPORTED
  COMPLETED            // Not "FILED" because we can't file it — the preparer does

  @@map("form_8938_filing_status")
}

enum IncomeType {
  INTEREST
  DIVIDENDS
  ROYALTIES
  CAPITAL_GAIN
  OTHER_INCOME

  @@map("income_type")
}
```

### Modified Existing Models

**Client** — add filing-status and residency fields:

```prisma
model Client {
  // ... existing fields ...
  filingStatus     FilingStatusType? @map("filing_status")
  residencyStatus  ResidencyStatus?  @map("residency_status")
  // ... existing relations ...
}
```

**ForeignAccount** — add 8938-specific flags:

```prisma
model ForeignAccount {
  // ... existing fields ...
  // New: link to Form8938Asset for accounts also reported on 8938
  form8938Asset    Form8938Asset?
}
```

**ReviewedAccountYear** — add year-end value and income data:

```prisma
model ReviewedAccountYear {
  // ... existing fields ...
  yearEndValueLocal    Decimal?  @map("year_end_value_local") @db.Decimal(18, 2)
  yearEndValueUsd      Decimal?  @map("year_end_value_usd") @db.Decimal(18, 2)
  accountOpenedInYear  Boolean   @default(false) @map("account_opened_in_year")
  accountClosedInYear  Boolean   @default(false) @map("account_closed_in_year")
  // ... existing relations ...
}
```

### New Models

**Form8938Filing** — top-level filing record for a client/year:

```prisma
model Form8938Filing {
  id                  String              @id @default(uuid()) @map("id")
  clientId            String              @map("client_id")
  calendarYear        Int                 @map("calendar_year")
  status              Form8938FilingStatus @default(NOT_STARTED) @map("status")
  filingStatus        FilingStatusType     @map("filer_filing_status")
  residencyStatus     ResidencyStatus      @map("filer_residency_status")

  // Part I summary values (computed)
  aggregateDepositMaxValue      Decimal? @map("aggregate_deposit_max_value") @db.Decimal(18, 2)
  aggregateCustodialMaxValue    Decimal? @map("aggregate_custodial_max_value") @db.Decimal(18, 2)
  aggregateOtherMaxValue        Decimal? @map("aggregate_other_max_value") @db.Decimal(18, 2)
  totalAggregateMaxValue        Decimal? @map("total_aggregate_max_value") @db.Decimal(18, 2)
  totalAggregateYearEndValue    Decimal? @map("total_aggregate_year_end_value") @db.Decimal(18, 2)
  exceedsThreshold              Boolean  @default(false) @map("exceeds_threshold")

  // Part IV: excepted assets reported on other forms
  exceptedAssetsForms           Json?    @map("excepted_assets_forms")

  // Part III: aggregate income summaries
  aggregateIncome               Json?    @map("aggregate_income")

  assignedPreparerId            String?  @map("assigned_preparer_id")
  reviewedById                  String?  @map("reviewed_by_id")
  reviewedAt                    DateTime? @map("reviewed_at")
  exportedAt                    DateTime? @map("exported_at")
  createdAt                     DateTime @default(now()) @map("created_at")
  updatedAt                     DateTime @updatedAt @map("updated_at")

  client          Client         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  assets          Form8938Asset[]

  @@unique([clientId, calendarYear])
  @@index([status])
  @@map("form_8938_filings")
}
```

**Form8938Asset** — individual asset reported on Form 8938:

```prisma
model Form8938Asset {
  id                  String                @id @default(uuid()) @map("id")
  form8938FilingId    String                @map("form_8938_filing_id")
  category            Form8938AssetCategory @map("category")

  // --- Part V fields (for DEPOSIT_ACCOUNT / CUSTODIAL_ACCOUNT) ---
  foreignAccountId    String?               @unique @map("foreign_account_id")
  // When linked to ForeignAccount, institution info comes from there

  // --- Part VI fields (for non-account assets) ---
  assetDescription    String?               @map("asset_description")
  identifyingNumber   String?               @map("identifying_number")    // ISIN, CUSIP, etc.
  acquiredDate        DateTime?             @map("acquired_date")
  disposedDate        DateTime?             @map("disposed_date")
  wasAcquiredInYear   Boolean               @default(false) @map("was_acquired_in_year")
  wasDisposedInYear   Boolean               @default(false) @map("was_disposed_in_year")

  // Issuer / counterparty (Part VI)
  issuerName          String?               @map("issuer_name")
  issuerCity          String?               @map("issuer_city")
  issuerCountry       String?               @map("issuer_country")  // ISO 3166-1 alpha-2

  // --- Valuation (both Part V and Part VI) ---
  maxValueLocal       Decimal?              @map("max_value_local") @db.Decimal(18, 2)
  maxValueUsd         Decimal?              @map("max_value_usd") @db.Decimal(18, 2)
  yearEndValueLocal   Decimal?              @map("year_end_value_local") @db.Decimal(18, 2)
  yearEndValueUsd     Decimal?              @map("year_end_value_usd") @db.Decimal(18, 2)
  currencyCode        String?               @map("currency_code")      // ISO 4217
  exchangeRate        Decimal?              @map("exchange_rate") @db.Decimal(12, 6)
  exchangeRateSource  String?               @map("exchange_rate_source")
  isValueUnknown      Boolean               @default(false) @map("is_value_unknown")

  // --- Income / Gain Reporting ---
  incomeItems         Json?                 @map("income_items")
  // JSON array: [{ type: "interest"|"dividends"|"capital_gain"|"other", amount: number,
  //                schedule: "Schedule B"|"Schedule D"|"Form 8949"|"Other", lineNumber: string }]

  // --- Joint ownership ---
  isJointWithSpouse   Boolean               @default(false) @map("is_joint_with_spouse")
  hasOtherJointOwners Boolean               @default(false) @map("has_other_joint_owners")

  // --- Review tracking ---
  isReviewed          Boolean               @default(false) @map("is_reviewed")
  reviewedById        String?               @map("reviewed_by_id")
  reviewedAt          DateTime?             @map("reviewed_at")
  corrections         Json?                 @map("corrections")

  createdAt           DateTime              @default(now()) @map("created_at")
  updatedAt           DateTime              @updatedAt @map("updated_at")

  form8938Filing  Form8938Filing  @relation(fields: [form8938FilingId], references: [id], onDelete: Cascade)
  foreignAccount  ForeignAccount? @relation(fields: [foreignAccountId], references: [id], onDelete: SetNull)

  @@index([form8938FilingId])
  @@index([category])
  @@map("form_8938_assets")
}
```

### Migration Strategy

The schema changes can be applied as a single Prisma migration:
1. Add new enums
2. Add optional columns to `Client` and `ReviewedAccountYear`
3. Create `Form8938Filing` and `Form8938Asset` tables
4. No data migration needed — all new fields are optional or have defaults
5. Existing FBAR data is unaffected

---

## 5. New Types

### `src/types/form8938.ts`

```typescript
// Form 8938 filing thresholds by filing status and residency
export interface Form8938Threshold {
  yearEnd: number
  anyTime: number
}

export const FORM_8938_THRESHOLDS: Record<string, Record<string, Form8938Threshold>> = {
  US_RESIDENT: {
    SINGLE: { yearEnd: 50_000, anyTime: 75_000 },
    MARRIED_FILING_JOINTLY: { yearEnd: 100_000, anyTime: 150_000 },
    MARRIED_FILING_SEPARATELY: { yearEnd: 50_000, anyTime: 75_000 },
    HEAD_OF_HOUSEHOLD: { yearEnd: 50_000, anyTime: 75_000 },
    QUALIFYING_WIDOW: { yearEnd: 50_000, anyTime: 75_000 },
  },
  LIVING_ABROAD: {
    SINGLE: { yearEnd: 200_000, anyTime: 300_000 },
    MARRIED_FILING_JOINTLY: { yearEnd: 400_000, anyTime: 600_000 },
    MARRIED_FILING_SEPARATELY: { yearEnd: 200_000, anyTime: 300_000 },
    HEAD_OF_HOUSEHOLD: { yearEnd: 200_000, anyTime: 300_000 },
    QUALIFYING_WIDOW: { yearEnd: 200_000, anyTime: 300_000 },
  },
}

export interface Form8938IncomeItem {
  type: "interest" | "dividends" | "royalties" | "capital_gain" | "other"
  amount: number
  schedule: string      // "Schedule B", "Schedule D", etc.
  lineNumber?: string   // Line number on the schedule
  description?: string  // Free-text for "other" type
}

export interface Form8938AssetData {
  assetId: string
  category: string
  // For accounts (Part V):
  foreignAccountId?: string
  accountType?: "deposit" | "custodial"
  accountNumber?: string
  institutionName?: string
  institutionCity?: string
  institutionCountry?: string
  // For other assets (Part VI):
  assetDescription?: string
  identifyingNumber?: string
  issuerName?: string
  issuerCity?: string
  issuerCountry?: string
  acquiredDate?: string
  disposedDate?: string
  wasAcquiredInYear?: boolean
  wasDisposedInYear?: boolean
  // Common:
  maxValueUsd: number | null
  yearEndValueUsd: number | null
  currencyCode?: string
  exchangeRate?: number
  exchangeRateSource?: string
  isJointWithSpouse: boolean
  hasOtherJointOwners: boolean
  incomeItems: Form8938IncomeItem[]
}

export interface Form8938FilingSummary {
  filingId: string
  calendarYear: number
  status: string
  clientName: string
  filingStatus: string
  residencyStatus: string
  depositAccounts: Form8938AssetData[]
  custodialAccounts: Form8938AssetData[]
  otherAssets: Form8938AssetData[]
  aggregateDepositMaxValue: number
  aggregateCustodialMaxValue: number
  aggregateOtherMaxValue: number
  totalAggregateMaxValue: number
  totalAggregateYearEndValue: number
  exceedsThreshold: boolean
  threshold: Form8938Threshold
  exceptedForms: { formNumber: string; count: number }[]
  aggregateIncome: { type: string; amount: number }[]
}

// Maps FBAR account types to 8938 account types
export const FBAR_TO_8938_ACCOUNT_TYPE: Record<string, "deposit" | "custodial"> = {
  BANK: "deposit",
  SECURITIES: "custodial",
  OTHER: "deposit",  // Default; preparer should review
}
```

---

## 6. Extraction Pipeline Changes

The existing extraction pipeline extracts data from bank statements for FBAR purposes. For Form 8938:

### What Changes for Bank/Securities Account Statements

The existing extraction prompt (`src/lib/prompts.ts`) should be extended to also extract:
- **Year-end (December 31) balance** — currently the system extracts ALL balances and identifies the maximum. It needs to also flag the year-end/closing balance specifically.
- **Income earned** — interest earned, dividends received, if visible on the statement.

This is a **prompt modification**, not a new pipeline. The existing extraction infrastructure can serve both FBAR and 8938.

### New Extraction Target: Other Foreign Assets

Part VI assets (stocks, partnerships, trusts, etc.) will NOT typically come from bank statements. They come from:
- Brokerage statements (which the existing pipeline already handles as "securities" accounts)
- Foreign entity documents (partnership K-1 equivalents, share certificates)
- Preparer manual entry

**Recommendation:** Phase 1 of 8938 support should handle Part V (accounts) using existing extraction, and Part VI (other assets) via manual entry only. Extraction from foreign entity documents is a Phase 2 item requiring new prompts.

### Prompt Changes

File: `src/lib/prompts.ts`

Add to the existing `EXTRACTION_SYSTEM_PROMPT`:
```
Additional extraction targets for Form 8938 reporting:
- YEAR-END BALANCE: If the statement covers December or the end of a calendar year,
  identify the closing balance on the last day of the year (or the last available date
  in December). Add this to the balances array with the label "year_end_balance" or
  "december_closing_balance".
- INCOME EARNED: If the statement shows total interest earned, dividends received, or
  other income for the period, extract these as a separate "income" array with fields:
  { type: "interest"|"dividends"|"other", amount: number, currency: "ISO 4217 code",
    period: "YYYY-MM-DD to YYYY-MM-DD" }
```

Add to the JSON schema in the prompt:
```json
{
  "accounts": [{
    // ... existing fields ...
    "year_end_balance": {
      "amount": "number or null",
      "date": "YYYY-MM-DD or null",
      "label": "string"
    },
    "income": [
      {
        "type": "interest | dividends | other",
        "amount": "number",
        "currency": "ISO 4217 code",
        "period": "start_date to end_date"
      }
    ]
  }]
}
```

### Extraction Types Changes

File: `src/types/extraction.ts`

Add to `ExtractedAccount`:
```typescript
export interface ExtractedAccount {
  // ... existing fields ...
  year_end_balance?: {
    amount: number | null
    date: string | null
    label: string
  }
  income?: Array<{
    type: "interest" | "dividends" | "other"
    amount: number
    currency: string
    period: string
  }>
}
```

These fields are optional to maintain backward compatibility — existing extractions without them still work for FBAR.

---

## 7. Validation Changes

File: `src/lib/validation.ts`

### New Validation Function: `validateForm8938Asset`

```typescript
export function validateForm8938Asset(
  asset: Form8938AssetData,
  index: number
): { errors: ValidationError[]; warnings: ValidationWarning[] }
```

Validation rules specific to Form 8938:
1. **Max value required and positive** (unless `isValueUnknown`)
2. **Year-end value required** for accounts still open at year end
3. **Currency code valid** (reuse existing `validateCurrencyCode`)
4. **Country code valid** (reuse existing `validateCountryCode`)
5. **Income items have valid types** and non-negative amounts
6. **Schedule references are recognized** (Schedule B, D, E, etc.)
7. **Part VI assets require description** — `assetDescription` must be non-empty
8. **Part VI assets require issuer info** — `issuerName` and `issuerCountry` required
9. **Acquisition date is valid** (reuse existing `validateDateString`)

### New Validation Function: `validateForm8938Threshold`

```typescript
export function validateForm8938Threshold(
  totalMaxValue: number,
  totalYearEndValue: number,
  filingStatus: string,
  residencyStatus: string
): { exceeds: boolean; threshold: Form8938Threshold; reason: string }
```

Checks both the year-end test and the any-time test.

---

## 8. Export Modules

### 8a. Form 8938 CSV Export

File: `src/lib/export/form8938-csv.ts`

Two CSV outputs:

**Full Form 8938 CSV** — all assets with all fields, designed for import into tax software or preparer reference:
- Columns: Asset #, Category, Account/Asset Description, Institution/Issuer Name, Country, Account Number / Identifier, Currency, Max Value (USD), Year-End Value (USD), Exchange Rate, Income Type, Income Amount, Schedule, Joint with Spouse, Opened in Year, Closed/Disposed in Year

**Income Summary CSV** — aggregate income by type and schedule for Part III:
- Columns: Income Type, Total Amount, Primary Schedule

### 8b. Form 8938 PDF Workpaper

File: `src/lib/export/form8938-pdf.ts`

Structured PDF that mirrors the actual Form 8938 layout:
- Cover page with client info, threshold determination, and aggregate values
- Part I/II summary section
- Per-account detail pages (Part V)
- Per-asset detail pages (Part VI)
- Part III income summary
- Part IV excepted assets list

This is the highest-value export for preparers, as they will use it as a reference while completing Form 8938 in their tax software.

### 8c. Form 8938 IRS MeF XML (Future / Phase 3)

File: `src/lib/export/form8938-xml.ts`

The IRS MeF system uses XML schemas for e-filed forms. Form 8938 has a defined XML schema as part of the MeF individual return schemas. Generating this XML directly would allow tax software with import capabilities to ingest the data.

**This is a Phase 3 item.** It requires:
- Obtaining the official IRS MeF XML schema for Form 8938
- Understanding the schema namespace and validation rules
- Testing against the IRS schema validation service
- Working with specific tax software vendors to validate import

For Phase 1, CSV + PDF workpaper is sufficient.

---

## 9. Approval Workflow Changes

File: `src/lib/approval.ts` (extend) OR `src/lib/form8938-approval.ts` (new)

**Recommendation:** Create a parallel `form8938-approval.ts` module. The FBAR approval workflow is tightly coupled to FBAR-specific concepts (the $10K threshold, BSA E-Filing XML). Creating a separate module keeps the code clean and avoids conditional logic pollution.

### New Functions

```typescript
// Analogous to getFilingProgress for FBAR
export async function getForm8938Progress(form8938FilingId: string): Promise<Form8938Progress>

// Analogous to submitForReview
export async function submitForm8938ForReview(
  form8938FilingId: string, userId: string, practiceId: string
): Promise<Form8938Filing>

// Analogous to approveForExport
export async function approveForm8938ForExport(
  form8938FilingId: string, userId: string, practiceId: string
): Promise<Form8938Filing>

// Threshold calculation
export async function calculateForm8938Threshold(
  clientId: string, calendarYear: number
): Promise<{ exceeds: boolean; threshold: Form8938Threshold; totalMaxValue: number; totalYearEndValue: number }>

// Import accounts from FBAR data
export async function importFbarAccountsToForm8938(
  form8938FilingId: string, filingYearId: string
): Promise<Form8938Asset[]>

// Get the review summary for export
export async function getForm8938ReviewSummary(
  form8938FilingId: string
): Promise<Form8938FilingSummary>
```

### Shared Account Import Logic

The `importFbarAccountsToForm8938` function is critical. When a client has an FBAR filing year with reviewed accounts, those accounts should be importable into the Form 8938 filing:

1. Query all `ReviewedAccountYear` records for the FBAR filing year
2. For each, create a `Form8938Asset` with `category = DEPOSIT_ACCOUNT | CUSTODIAL_ACCOUNT`
3. Map FBAR account type to 8938 type (`BANK` -> `deposit`, `SECURITIES` -> `custodial`)
4. Copy `maxValueUsd`, `currencyCode`, `exchangeRate`, `exchangeRateSource`
5. Copy `yearEndValueLocal`/`yearEndValueUsd` if available (new fields on `ReviewedAccountYear`)
6. Link via `foreignAccountId` so updates propagate
7. Flag that income data and year-end values still need manual entry

---

## 10. API Routes

### New Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/form8938/[clientId]/filings` | GET, POST | List/create Form 8938 filings for a client |
| `/api/form8938/[filingId]` | GET, PATCH, DELETE | Get/update/delete a Form 8938 filing |
| `/api/form8938/[filingId]/assets` | GET, POST | List/create assets for a filing |
| `/api/form8938/[filingId]/assets/[assetId]` | GET, PATCH, DELETE | CRUD individual asset |
| `/api/form8938/[filingId]/assets/import-fbar` | POST | Import accounts from FBAR filing year |
| `/api/form8938/[filingId]/threshold` | GET | Calculate and return threshold determination |
| `/api/form8938/[filingId]/submit` | POST | Submit for review |
| `/api/form8938/[filingId]/approve` | POST | Approve for export |
| `/api/form8938/[filingId]/reopen` | POST | Reopen for corrections |
| `/api/export/form8938/[filingId]/csv` | GET | Download CSV export |
| `/api/export/form8938/[filingId]/pdf` | GET | Download PDF workpaper |

### Modified Routes

| Route | Change |
|---|---|
| `/api/clients/[clientId]` | Include 8938 filings in client detail response |
| `/api/clients/[clientId]/filing-years` | Also return associated 8938 filing status |

---

## 11. UI Pages and Components

### New Pages

**1. Form 8938 Filing List** — `src/app/(dashboard)/clients/[clientId]/form8938/page.tsx`
- Shows all Form 8938 filings for a client across years
- Status badges, quick actions (create new, view, export)
- Linked to the existing client detail page via a tab or sub-navigation

**2. Form 8938 Filing Detail** — `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/page.tsx`
- Filing header: calendar year, filing status, residency, threshold determination
- Threshold indicator: shows whether filing is required and which threshold applies
- Three-panel asset list:
  - Deposit accounts (Part V)
  - Custodial accounts (Part V)
  - Other foreign assets (Part VI)
- Each panel shows asset count, aggregate value, review status
- Actions: add asset, import from FBAR, submit for review, export

**3. Add/Edit Asset (Account)** — `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/add-account/page.tsx`
- Form for adding a deposit or custodial account
- Fields: institution name, country, account number, currency, max value, year-end value, exchange rate, income items
- If linked to a ForeignAccount, pre-fill from FBAR data

**4. Add/Edit Asset (Other)** — `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/add-asset/page.tsx`
- Form for adding Part VI assets
- Fields: asset type dropdown, description, identifier, issuer/counterparty info, acquisition date, disposition info, valuation, income items
- More manual data entry than accounts since these don't come from bank statements

**5. Form 8938 Review** — `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/review/page.tsx`
- Summary view of all assets with values
- Threshold determination display
- Part III income aggregate computed and shown
- Approve/flag individual assets
- Bulk approve
- Similar to existing FBAR review but adapted for 8938 fields

**6. Form 8938 Export** — `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/export/page.tsx`
- Summary table of all assets
- Threshold confirmation
- Export buttons: CSV, PDF workpaper
- Checklist: all assets reviewed, all values entered, income data complete

### Modified Pages

**Client Detail** — `src/app/(dashboard)/clients/[clientId]/page.tsx`
- Add a tab or section for "Form 8938" alongside the existing FBAR filing years
- Show 8938 filing status per year
- Quick link to create 8938 filing for a year

**Dashboard** — `src/app/(dashboard)/page.tsx`
- Add 8938 status summary alongside FBAR status
- Filter by form type (FBAR, 8938, both)

### New Components

| Component | Location | Purpose |
|---|---|---|
| `ThresholdIndicator` | `src/components/form8938/ThresholdIndicator.tsx` | Visual display of threshold determination with filing status / residency selectors |
| `AssetTypeSelector` | `src/components/form8938/AssetTypeSelector.tsx` | Dropdown for Part VI asset categories |
| `IncomeItemEditor` | `src/components/form8938/IncomeItemEditor.tsx` | Multi-row editor for income items per asset |
| `ImportFromFbarDialog` | `src/components/form8938/ImportFromFbarDialog.tsx` | Modal to select an FBAR filing year and import accounts |
| `Form8938AssetCard` | `src/components/form8938/Form8938AssetCard.tsx` | Display card for a single asset with review status |
| `Form8938Summary` | `src/components/form8938/Form8938Summary.tsx` | Aggregate summary matching Form 8938 Parts I-III |

---

## 12. File-by-File Implementation Breakdown

Each file is exclusively owned by one agent. No two agents edit the same file.

### Phase 1: Foundation (Schema + Types + Core Logic)

| # | File | Owner | Description | Dependencies |
|---|---|---|---|---|
| 1 | `prisma/schema.prisma` | Agent A | Add new enums, modify Client/ReviewedAccountYear, add Form8938Filing + Form8938Asset models | None |
| 2 | `src/types/form8938.ts` | Agent B | New type definitions, threshold constants, mapping types | None |
| 3 | `src/types/extraction.ts` | Agent C | Add `year_end_balance` and `income` optional fields to `ExtractedAccount` | None |
| 4 | `src/lib/prompts.ts` | Agent C | Extend extraction prompt for year-end balance + income | Types from #3 |
| 5 | `src/lib/validation.ts` | Agent D | Add `validateForm8938Asset`, `validateForm8938Threshold` | Types from #2 |

### Phase 2: Service Layer

| # | File | Owner | Description | Dependencies |
|---|---|---|---|---|
| 6 | `src/lib/form8938-approval.ts` | Agent E | New approval workflow module: progress, submit, approve, reopen, import FBAR, review summary, threshold calculation | Schema (#1), Types (#2) |
| 7 | `src/lib/export/form8938-csv.ts` | Agent F | CSV export for Form 8938 data | Types (#2), Approval (#6) |
| 8 | `src/lib/export/form8938-pdf.ts` | Agent G | PDF workpaper export for Form 8938 | Types (#2), Approval (#6) |

### Phase 3: API Routes

| # | File | Owner | Description | Dependencies |
|---|---|---|---|---|
| 9 | `src/app/api/form8938/[clientId]/filings/route.ts` | Agent H | GET/POST Form 8938 filings | Approval (#6) |
| 10 | `src/app/api/form8938/[filingId]/route.ts` | Agent H | GET/PATCH/DELETE filing | Approval (#6) |
| 11 | `src/app/api/form8938/[filingId]/assets/route.ts` | Agent I | GET/POST assets | Schema (#1) |
| 12 | `src/app/api/form8938/[filingId]/assets/[assetId]/route.ts` | Agent I | GET/PATCH/DELETE asset | Schema (#1) |
| 13 | `src/app/api/form8938/[filingId]/assets/import-fbar/route.ts` | Agent I | POST import from FBAR | Approval (#6) |
| 14 | `src/app/api/form8938/[filingId]/submit/route.ts` | Agent J | POST submit for review | Approval (#6) |
| 15 | `src/app/api/form8938/[filingId]/approve/route.ts` | Agent J | POST approve for export | Approval (#6) |
| 16 | `src/app/api/form8938/[filingId]/reopen/route.ts` | Agent J | POST reopen | Approval (#6) |
| 17 | `src/app/api/form8938/[filingId]/threshold/route.ts` | Agent J | GET threshold calculation | Approval (#6) |
| 18 | `src/app/api/export/form8938/[filingId]/csv/route.ts` | Agent K | GET CSV download | Export (#7) |
| 19 | `src/app/api/export/form8938/[filingId]/pdf/route.ts` | Agent K | GET PDF download | Export (#8) |

### Phase 4: UI

| # | File | Owner | Description | Dependencies |
|---|---|---|---|---|
| 20 | `src/components/form8938/ThresholdIndicator.tsx` | Agent L | Threshold display component | Types (#2) |
| 21 | `src/components/form8938/AssetTypeSelector.tsx` | Agent L | Asset category dropdown | Types (#2) |
| 22 | `src/components/form8938/IncomeItemEditor.tsx` | Agent L | Income multi-row editor | Types (#2) |
| 23 | `src/components/form8938/ImportFromFbarDialog.tsx` | Agent M | FBAR import dialog | APIs (#13) |
| 24 | `src/components/form8938/Form8938AssetCard.tsx` | Agent M | Asset display card | Types (#2) |
| 25 | `src/components/form8938/Form8938Summary.tsx` | Agent M | Aggregate summary component | Types (#2) |
| 26 | `src/app/(dashboard)/clients/[clientId]/form8938/page.tsx` | Agent N | Filing list page | APIs (#9), Components (#20-25) |
| 27 | `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/page.tsx` | Agent N | Filing detail page | APIs (#10-13), Components |
| 28 | `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/add-account/page.tsx` | Agent O | Add account form page | APIs (#11) |
| 29 | `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/add-asset/page.tsx` | Agent O | Add other asset form page | APIs (#11) |
| 30 | `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/review/page.tsx` | Agent P | Review page | APIs (#14-17), Components |
| 31 | `src/app/(dashboard)/clients/[clientId]/form8938/[filingId]/export/page.tsx` | Agent P | Export page | APIs (#18-19), Components |

### Phase 5: Integration + Modified Files

| # | File | Owner | Description | Dependencies |
|---|---|---|---|---|
| 32 | `src/app/(dashboard)/clients/[clientId]/page.tsx` | Agent Q | Add Form 8938 tab/section to client detail | All above |
| 33 | `src/app/(dashboard)/page.tsx` | Agent Q | Add 8938 summary to dashboard | All above |

---

## 13. Phasing and Priority

### Phase 1 (Recommended First Implementation)
**Form 8938 Part V — Financial Accounts Only**

Scope:
- Schema changes (all of them — design once)
- Types and validation
- Prompt extension for year-end balance + income
- Form8938Filing and Form8938Asset CRUD for deposit/custodial accounts
- Import accounts from existing FBAR data
- Threshold calculation and display
- CSV + PDF export for Part V accounts
- Basic UI for creating 8938 filing, importing accounts, reviewing, exporting

Rationale: This is where the overlap with existing FBAR data is highest. Most of the data for Part V accounts is already being captured. The incremental effort to also produce Form 8938 output for these accounts is moderate. This delivers immediate value to preparers who need both FBAR and 8938 for the same clients.

Estimated scope: ~30 files, ~2,500-3,500 lines of code

### Phase 2 (After Phase 1 validation)
**Form 8938 Part VI — Other Foreign Assets**

Scope:
- Full UI for adding/editing Part VI assets (stocks, partnerships, trusts, etc.)
- Manual entry workflow for non-account assets
- Income/gain/loss entry per asset
- Part III aggregate income summary computation
- Part IV excepted assets tracking
- Extended export including Part VI assets

Rationale: Part VI assets require entirely new data entry (no extraction pipeline). They are more complex and varied. Building this after Part V is validated ensures the foundation is solid.

Estimated scope: ~15 additional files, ~1,500-2,000 lines of code

### Phase 3 (Future)
**Advanced Export + Integration**

Scope:
- IRS MeF XML schema export
- Tax software integration investigation (Drake, CCH Axcess)
- Extraction pipeline for foreign entity documents (partnership agreements, share certificates)
- Multi-year 8938 history and carryforward

---

## 14. Open Questions and Risks

### Open Questions

1. **Tax software import capabilities for Form 8938 data.** Drake, Lacerte, and other platforms may have undocumented import paths for Form 8938. This would change the export strategy from "PDF workpaper for manual transcription" to "structured import file." Requires vendor outreach.

2. **Year-end balance extraction accuracy.** The extraction pipeline currently identifies the maximum balance. Identifying the specific December 31 balance requires the right statement (December monthly statement or year-end annual statement) to be uploaded. If a client only uploads Q3 statements, there is no year-end balance. The system should flag this gap clearly.

3. **Income reporting granularity.** Form 8938 requires income from each asset to be reported with the specific schedule/form where it appears on the return. This is tax return preparation data, not bank statement data. How much should this tool attempt to capture vs. leaving it to the preparer in their tax software? Recommendation: capture income amounts from statements where visible, but leave schedule/form references as manual entry.

4. **Interaction between FBAR and 8938 filing status.** If a preparer edits an account in the FBAR workflow after it has been imported into a Form 8938 filing, should the 8938 asset update automatically? Recommendation: no automatic sync — instead, show a "stale data" warning and let the preparer manually re-import or update.

5. **Specified domestic entities.** Form 8938 can also be filed by certain domestic corporations, partnerships, and trusts (not just individuals). The current app models clients as individuals or entities. Supporting entity filers for 8938 requires additional fields. Recommendation: defer entity 8938 support to Phase 3.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Year-end balance not extractable from uploaded statements | Medium | Medium | Clear UI messaging when year-end value is missing; allow manual entry |
| Income attribution data too complex for preparer workflow | Medium | Medium | Start with simple income type/amount; defer schedule/line mapping to preparer's tax software |
| Threshold calculation complexity confuses preparers | Low | Medium | ThresholdIndicator component with clear visual explanation |
| 8938 scope creep into full tax return preparation | High | High | Strict scope boundary: this tool prepares 8938 DATA, not the 8938 FORM itself. The preparer enters data into their tax software. |
| MeF XML schema complexity | Medium | Low (Phase 3) | Defer to Phase 3; CSV + PDF is sufficient for Phase 1-2 |

---

## Sources

- [IRS Form 8938 Instructions](https://www.irs.gov/instructions/i8938)
- [About Form 8938](https://www.irs.gov/forms-pubs/about-form-8938)
- [Comparison of Form 8938 and FBAR Requirements](https://www.irs.gov/businesses/comparison-of-form-8938-and-fbar-requirements)
- [Summary of FATCA Reporting for U.S. Taxpayers](https://www.irs.gov/businesses/corporations/summary-of-fatca-reporting-for-us-taxpayers)
- [Do I Need to File Form 8938?](https://www.irs.gov/businesses/corporations/do-i-need-to-file-form-8938-statement-of-specified-foreign-financial-assets)
- [FATCA Information for Individuals](https://www.irs.gov/businesses/corporations/fatca-information-for-individuals)
- [Basic Questions and Answers on Form 8938](https://www.irs.gov/businesses/corporations/basic-questions-and-answers-on-form-8938)
- [Form 8938 Penalties — Sherayzen Law Office](https://sherayzenlaw.com/form-8938-penalties/)
- [MeF XML Standardization](https://www.irs.gov/e-file-providers/modernized-e-file-mef-xml-standardization)
- [MeF Schemas and Business Rules](https://www.irs.gov/e-file-providers/modernized-e-file-mef-schemas-and-business-rules)
- [Form 8938 and FATCA Reporting Guide for Expats 2026](https://onlinetaxman.com/form-8938-fatca-reporting-guide-expats-2026)
- [FBAR vs Form 8938 Comparison — TaxesForExpats](https://www.taxesforexpats.com/articles/fbar-fatca/fbar-vs-form-8938.html)
- [Form 8938 Filing Requirements — Greenback Tax Services](https://www.greenbacktaxservices.com/knowledge-center/form-8938/)
