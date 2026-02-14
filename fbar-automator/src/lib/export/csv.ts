// ---------------------------------------------------------------------------
// CSV Export Module
// ---------------------------------------------------------------------------
// Generates CSV exports of FBAR filing data for download. Two export formats:
//   1. Full FBAR CSV — all reviewed account data with filer info (for filing)
//   2. Accounts CSV — simplified account details (for tax preparer workpapers)
//
// Security: TINs are always masked in exports (last 4 digits only).
// ---------------------------------------------------------------------------

import Papa from "papaparse"
import { getReviewSummary, type ReviewSummary } from "@/lib/approval"
import { safeDecrypt } from "@/lib/encryption"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Masks a TIN to show only the last 4 digits.
 * e.g. "123456789" -> "***-**-6789", null -> ""
 */
function maskTin(tin: string | null): string {
  if (!tin) return ""
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  const last4 = digits.slice(-4)
  return `***-**-${last4}`
}

/**
 * Formats a value for CSV output: null/undefined become empty string,
 * booleans become "Yes"/"No", Dates become ISO strings.
 */
function fmt(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

// ---------------------------------------------------------------------------
// 1. generateFBARCsv
// ---------------------------------------------------------------------------

/**
 * Generates a full FBAR CSV for a filing year containing filer info,
 * per-account review data, and an aggregate summary row.
 *
 * Columns:
 *   Filing Year, Filer Last Name, Filer First Name, Filer TIN (masked),
 *   Account Number, Institution Name, Account Type, Country, Currency Code,
 *   Max Value (Local Currency), Exchange Rate, Max Value (USD),
 *   Value Unknown, Reviewed By, Reviewed At
 *
 * @param filingYearId - The filing year to export
 * @param prefetchedSummary - Optional pre-fetched review data (avoids redundant DB queries)
 */
export async function generateFBARCsv(
  filingYearId: string,
  prefetchedSummary?: ReviewSummary
): Promise<string> {
  const summary = prefetchedSummary ?? await getReviewSummary(filingYearId)

  const { filingYear, client, accounts, aggregateMaxValueUSD } = summary
  // Decrypt TIN before masking (TINs are now encrypted in DB)
  const decryptedTin = client.tin ? safeDecrypt(client.tin) : null
  const maskedTin = maskTin(decryptedTin)

  // Build data rows — one per account
  const rows: Record<string, string>[] = accounts.map((acct) => ({
    "Filing Year": String(filingYear.calendarYear),
    "Filer Last Name": client.lastName,
    "Filer First Name": fmt(client.firstName),
    "Filer TIN": maskedTin,
    "Account Number": acct.accountNumber,
    "Institution Name": acct.institutionName,
    "Account Type": acct.accountType,
    "Country": fmt(acct.country),
    "Currency Code": fmt(acct.currencyCode),
    "Max Value (Local Currency)": fmt(acct.maxValueLocal),
    "Exchange Rate": fmt(acct.exchangeRate),
    "Max Value (USD)": fmt(acct.maxValueUsd),
    "Value Unknown": fmt(acct.isValueUnknown),
    "Reviewed By": fmt(acct.reviewedBy),
    "Reviewed At": fmt(acct.reviewedAt),
  }))

  // Summary row — empty fields except aggregate max value in the USD column
  const summaryRow: Record<string, string> = {
    "Filing Year": "",
    "Filer Last Name": "",
    "Filer First Name": "",
    "Filer TIN": "",
    "Account Number": "",
    "Institution Name": "",
    "Account Type": "",
    "Country": "",
    "Currency Code": "",
    "Max Value (Local Currency)": "",
    "Exchange Rate": "",
    "Max Value (USD)": String(aggregateMaxValueUSD),
    "Value Unknown": "",
    "Reviewed By": "",
    "Reviewed At": "Aggregate Max Value (USD)",
  }
  rows.push(summaryRow)

  return Papa.unparse(rows)
}

// ---------------------------------------------------------------------------
// 2. generateAccountsCsv
// ---------------------------------------------------------------------------

/**
 * Generates a simplified accounts CSV for tax preparer workpapers.
 *
 * Columns:
 *   Account Number, Institution Name, Account Type, Country, City,
 *   Currency, Max Balance Local, Max Balance USD
 *
 * @param filingYearId - The filing year to export
 * @param prefetchedSummary - Optional pre-fetched review data (avoids redundant DB queries)
 */
export async function generateAccountsCsv(
  filingYearId: string,
  prefetchedSummary?: ReviewSummary
): Promise<string> {
  const summary = prefetchedSummary ?? await getReviewSummary(filingYearId)

  const rows: Record<string, string>[] = summary.accounts.map((acct) => ({
    "Account Number": acct.accountNumber,
    "Institution Name": acct.institutionName,
    "Account Type": acct.accountType,
    "Country": fmt(acct.country),
    "City": "", // City not available in ReviewSummary; included for workpaper template compatibility
    "Currency": fmt(acct.currencyCode),
    "Max Balance Local": fmt(acct.maxValueLocal),
    "Max Balance USD": fmt(acct.maxValueUsd),
  }))

  return Papa.unparse(rows)
}
