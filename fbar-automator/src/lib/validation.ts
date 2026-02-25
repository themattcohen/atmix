// ---------------------------------------------------------------------------
// Extraction Validation System
// ---------------------------------------------------------------------------
// Validates the structured output from Claude's bank statement extraction.
// Catches data quality issues, flags low-confidence fields, and ensures
// values are reasonable before they reach the human review interface.
//
// Validation rules are derived from PRD Section 6 "Validation Rules Applied
// to LLM Output" and FinCEN Form 114 field requirements.
// ---------------------------------------------------------------------------

import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"
import { COUNTRY_CODES } from "@/types/fincen"

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  accountIndex: number
  severity: "error" | "warning"
}

export interface ValidationWarning {
  field: string
  message: string
  accountIndex: number
}

// ---------------------------------------------------------------------------
// ISO 4217 currency codes
// ---------------------------------------------------------------------------
// Common currencies encountered in FBAR filings. A code not in this set
// triggers a warning (not an error) because uncommon but valid codes exist.
// ---------------------------------------------------------------------------

const VALID_CURRENCY_CODES = new Set<string>([
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "KRW",
  "ILS", "MXN", "BRL", "SGD", "HKD", "TWD", "THB", "SEK", "NOK", "DKK",
  "NZD", "ZAR", "RUB", "PLN", "CZK", "HUF", "RON", "TRY", "AED", "SAR",
  "QAR", "KWD", "BHD", "OMR", "JOD", "EGP", "NGN", "KES", "GHS", "PHP",
  "IDR", "MYR", "VND", "PKR", "BDT", "LKR", "MMK", "KHR", "LAK", "PEN",
  "COP", "CLP", "ARS", "UYU",
])

// Maximum balance threshold. Any single-account balance above this value
// is almost certainly an extraction error (misplaced decimal, extra digits).
const MAX_REASONABLE_BALANCE = 100_000_000_000 // 100 billion

// ---------------------------------------------------------------------------
// Date format regex: YYYY-MM-DD with basic range checks
// ---------------------------------------------------------------------------

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// Primary validation entry point
// ---------------------------------------------------------------------------

/**
 * Validates an entire extraction result across all accounts and metadata.
 * Returns a ValidationResult where isValid is true only when zero errors
 * are present. Warnings do not affect isValid.
 */
export function validateExtractionResult(
  result: ExtractionResult,
  calendarYear?: number
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Validate each account
  for (let i = 0; i < result.accounts.length; i++) {
    const accountValidation = validateAccount(result.accounts[i], i, calendarYear)
    errors.push(...accountValidation.errors)
    warnings.push(...accountValidation.warnings)
  }

  // Document-level: transaction-only check
  if (result.document_metadata.is_transaction_only) {
    warnings.push({
      field: "document_metadata.is_transaction_only",
      message:
        "Statement contains only transactions, no explicit balance. Manual review required.",
      accountIndex: -1,
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Per-account validation
// ---------------------------------------------------------------------------

/**
 * Validates a single extracted account against all quality rules.
 * The index parameter is used to identify which account generated
 * each error or warning in the aggregated results.
 */
export function validateAccount(
  account: ExtractedAccount,
  index: number,
  calendarYear?: number
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // -----------------------------------------------------------------------
  // Rule 1: Currency code valid (warning if not in known set)
  // -----------------------------------------------------------------------
  if (!validateCurrencyCode(account.currency)) {
    warnings.push({
      field: "currency",
      message: `Currency code "${account.currency}" is not in the common ISO 4217 set. Verify this is correct.`,
      accountIndex: index,
    })
  }

  // -----------------------------------------------------------------------
  // Rule 2: Account number present (error if missing)
  // -----------------------------------------------------------------------
  if (!account.account_number || account.account_number.trim() === "") {
    errors.push({
      field: "account_number",
      message: "Account number is missing. This field is required for FBAR filing.",
      accountIndex: index,
      severity: "error",
    })
  }

  // -----------------------------------------------------------------------
  // Rule 3: Max balance positive (error if <= 0)
  // -----------------------------------------------------------------------
  if (account.max_balance.amount <= 0) {
    errors.push({
      field: "max_balance.amount",
      message: `Max balance is ${account.max_balance.amount}. Must be greater than zero.`,
      accountIndex: index,
      severity: "error",
    })
  }

  // -----------------------------------------------------------------------
  // Rule 4: Balance reasonableness (warning if > 100 billion)
  // -----------------------------------------------------------------------
  if (account.max_balance.amount > MAX_REASONABLE_BALANCE) {
    warnings.push({
      field: "max_balance.amount",
      message: `Balance exceeds $100B (${account.max_balance.amount}) - likely extraction error.`,
      accountIndex: index,
    })
  }

  // -----------------------------------------------------------------------
  // Rule 5: Country code valid (warning if not recognized)
  // -----------------------------------------------------------------------
  if (!validateCountryCode(account.bank_address.country)) {
    warnings.push({
      field: "bank_address.country",
      message: `Country code "${account.bank_address.country}" is not a recognized ISO 3166-1 alpha-2 code.`,
      accountIndex: index,
    })
  }

  // -----------------------------------------------------------------------
  // Rule 6: Date format valid for statement period
  // -----------------------------------------------------------------------
  if (!validateDateString(account.statement_period.start_date)) {
    warnings.push({
      field: "statement_period.start_date",
      message: `Start date "${account.statement_period.start_date}" is not a valid YYYY-MM-DD date.`,
      accountIndex: index,
    })
  }

  if (!validateDateString(account.statement_period.end_date)) {
    warnings.push({
      field: "statement_period.end_date",
      message: `End date "${account.statement_period.end_date}" is not a valid YYYY-MM-DD date.`,
      accountIndex: index,
    })
  }

  // -----------------------------------------------------------------------
  // Rule 6b: Statement period coverage (soft warnings)
  // -----------------------------------------------------------------------
  if (calendarYear != null) {
    const startDate = account.statement_period.start_date
    const endDate = account.statement_period.end_date

    if (validateDateString(startDate)) {
      const [yearStr, monthStr] = startDate.split("-")
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      if (year === calendarYear && month > 1) {
        warnings.push({
          field: "statement_period.start_date",
          message: `Statement starts on ${startDate}, which is after January 31 of the filing year (${calendarYear}). Verify full-year coverage.`,
          accountIndex: index,
        })
      } else if (year > calendarYear) {
        warnings.push({
          field: "statement_period.start_date",
          message: `Statement start date ${startDate} is after the filing year ${calendarYear}.`,
          accountIndex: index,
        })
      }
    }

    if (validateDateString(endDate)) {
      const [yearStr, monthStr] = endDate.split("-")
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      if (year === calendarYear && month < 12) {
        warnings.push({
          field: "statement_period.end_date",
          message: `Statement ends on ${endDate}, which is before December 1 of the filing year (${calendarYear}). Verify full-year coverage.`,
          accountIndex: index,
        })
      } else if (year < calendarYear) {
        warnings.push({
          field: "statement_period.end_date",
          message: `Statement end date ${endDate} is before the filing year ${calendarYear}.`,
          accountIndex: index,
        })
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rule 7: Duplicate balance detection
  // -----------------------------------------------------------------------
  const seen = new Map<string, number>()
  for (let i = 0; i < account.balances.length; i++) {
    const balance = account.balances[i]
    const key = `${balance.date ?? "null"}|${balance.amount}`
    const previousIndex = seen.get(key)
    if (previousIndex !== undefined) {
      warnings.push({
        field: "balances",
        message:
          `Possible duplicate balance: entries at positions ${previousIndex} and ${i} ` +
          `both have date "${balance.date}" and amount ${balance.amount}.`,
        accountIndex: index,
      })
    } else {
      seen.set(key, i)
    }
  }

  // -----------------------------------------------------------------------
  // Rule 8: Low confidence flagging
  // -----------------------------------------------------------------------
  const lowConfidenceFields: string[] = []
  const confidenceEntries = Object.entries(account.confidence) as [
    string,
    "high" | "medium" | "low",
  ][]

  for (const [field, level] of confidenceEntries) {
    if (level === "low") {
      lowConfidenceFields.push(field)
    }
  }

  if (lowConfidenceFields.length > 0) {
    warnings.push({
      field: "confidence",
      message: `Low confidence on fields: ${lowConfidenceFields.join(", ")}. Manual review required.`,
      accountIndex: index,
    })
  }

  return { errors, warnings }
}

// ---------------------------------------------------------------------------
// Field-level validators
// ---------------------------------------------------------------------------

/**
 * Checks whether a currency code is in the known set of common ISO 4217 codes.
 * Returns false for uncommon or invalid codes, but callers should treat this
 * as a warning rather than a hard error since valid uncommon codes exist.
 */
export function validateCurrencyCode(code: string): boolean {
  if (!code || typeof code !== "string") return false
  return VALID_CURRENCY_CODES.has(code.toUpperCase())
}

/**
 * Checks whether a country code exists in the FBAR-relevant country code map.
 * Returns false for codes not in COUNTRY_CODES.
 */
export function validateCountryCode(code: string): boolean {
  if (!code || typeof code !== "string") return false
  return code.toUpperCase() in COUNTRY_CODES
}

/**
 * Validates that a date string conforms to YYYY-MM-DD format and represents
 * a real calendar date (month 01-12, day 01-31, and parseable by Date).
 */
export function validateDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false
  if (!DATE_REGEX.test(dateStr)) return false

  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Basic range checks
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Verify the date is real by round-tripping through Date
  const parsed = new Date(year, month - 1, day)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

/**
 * Formats a ValidationResult into a human-readable summary string suitable
 * for display in the review interface or logging.
 */
export function formatValidationSummary(result: ValidationResult): string {
  const lines: string[] = []

  if (result.isValid && result.warnings.length === 0) {
    lines.push("Validation passed with no issues.")
    return lines.join("\n")
  }

  if (result.isValid) {
    lines.push(
      `Validation passed with ${result.warnings.length} warning(s).`
    )
  } else {
    lines.push(
      `Validation failed with ${result.errors.length} error(s) and ${result.warnings.length} warning(s).`
    )
  }

  lines.push("")

  if (result.errors.length > 0) {
    lines.push("ERRORS:")
    for (const error of result.errors) {
      const accountLabel =
        error.accountIndex >= 0
          ? `Account ${error.accountIndex + 1}`
          : "Document"
      lines.push(`  [${accountLabel}] ${error.field}: ${error.message}`)
    }
    lines.push("")
  }

  if (result.warnings.length > 0) {
    lines.push("WARNINGS:")
    for (const warning of result.warnings) {
      const accountLabel =
        warning.accountIndex >= 0
          ? `Account ${warning.accountIndex + 1}`
          : "Document"
      lines.push(`  [${accountLabel}] ${warning.field}: ${warning.message}`)
    }
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// TIN format validation
// ---------------------------------------------------------------------------

/**
 * Validates a TIN (Taxpayer Identification Number) format based on its type.
 * Returns an error message string if invalid, or null if valid.
 *
 * - SSN: 9 digits, cannot start with "9" or "000"
 * - EIN: 9 digits
 * - ITIN: 9 digits, must start with "9"
 * - FOREIGN_TIN: no format constraint (any non-empty string)
 */
export function validateTinFormat(tin: string, tinType: string): string | null {
  if (!tin || !tinType) return null

  // Strip non-digit characters for format checking
  const digits = tin.replace(/\D/g, "")

  switch (tinType) {
    case "SSN":
      if (digits.length !== 9) {
        return "SSN must be exactly 9 digits."
      }
      if (digits.startsWith("9")) {
        return "SSN cannot start with 9 (that indicates an ITIN)."
      }
      if (digits.startsWith("000")) {
        return "SSN cannot start with 000."
      }
      return null

    case "EIN":
      if (digits.length !== 9) {
        return "EIN must be exactly 9 digits."
      }
      return null

    case "ITIN":
      if (digits.length !== 9) {
        return "ITIN must be exactly 9 digits."
      }
      if (!digits.startsWith("9")) {
        return "ITIN must start with 9."
      }
      return null

    case "FOREIGN_TIN":
      // No format constraint for foreign TINs
      return null

    default:
      return `Unknown TIN type: ${tinType}`
  }
}
