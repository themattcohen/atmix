import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  validateExtractionResult,
  validateAccount,
  validateCurrencyCode,
  validateCountryCode,
  validateDateString,
} from "@/lib/validation"
import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createValidAccount(overrides: Partial<ExtractedAccount> = {}): ExtractedAccount {
  return {
    bank_name: "Test International Bank",
    bank_address: {
      street: "123 Main St",
      city: "Zurich",
      state_province: "ZH",
      country: "CH",
      postal_code: "8001",
    },
    account_number: "CH93-0076-2011-6238-5295-7",
    account_type: "bank",
    account_type_description: null,
    currency: "CHF",
    statement_period: {
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    },
    balances: [
      { date: "2024-06-30", amount: 50000, label: "Mid-year balance", is_maximum: false },
      { date: "2024-09-30", amount: 75000, label: "Q3 balance", is_maximum: true },
    ],
    max_balance: {
      amount: 75000,
      date: "2024-09-30",
      label: "Q3 balance",
    },
    confidence: {
      bank_name: "high",
      account_number: "high",
      currency: "high",
      max_balance: "high",
      overall: "high",
    },
    warnings: [],
    ...overrides,
  }
}

function createValidExtractionResult(
  overrides: Partial<ExtractionResult> = {},
  accountOverrides: Partial<ExtractedAccount>[] = []
): ExtractionResult {
  const accounts =
    accountOverrides.length > 0
      ? accountOverrides.map((o) => createValidAccount(o))
      : [createValidAccount()]

  return {
    accounts,
    document_language: "en",
    document_metadata: {
      page_count: 2,
      is_multi_account: false,
      is_transaction_only: false,
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validateExtractionResult
// ---------------------------------------------------------------------------

describe("validateExtractionResult", () => {
  it("returns isValid=true for a valid extraction result", () => {
    const result = validateExtractionResult(createValidExtractionResult())
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("returns error when account number is missing", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [{ account_number: "" }])
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "account_number")).toBe(true)
  })

  it("returns error when max balance is negative", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        { max_balance: { amount: -500, date: "2024-12-31", label: "Negative" } },
      ])
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.field === "max_balance.amount")).toBe(true)
  })

  it("returns warning when balance exceeds 100 billion", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        {
          max_balance: {
            amount: 200_000_000_000,
            date: "2024-12-31",
            label: "Unreasonable",
          },
        },
      ])
    )
    expect(result.isValid).toBe(true) // warnings do not fail validation
    expect(result.warnings.some((w) => w.field === "max_balance.amount")).toBe(true)
  })

  it("returns warning for invalid currency code", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [{ currency: "XYZ" }])
    )
    expect(result.isValid).toBe(true)
    expect(result.warnings.some((w) => w.field === "currency")).toBe(true)
  })

  it("returns warning for invalid country code", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        {
          bank_address: {
            street: "123 St",
            city: "Nowhere",
            state_province: null,
            country: "XX",
            postal_code: null,
          },
        },
      ])
    )
    expect(result.isValid).toBe(true)
    expect(result.warnings.some((w) => w.field === "bank_address.country")).toBe(true)
  })

  it("returns warning for invalid date format in statement period", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        {
          statement_period: {
            start_date: "01/01/2024",
            end_date: "2024-12-31",
          },
        },
      ])
    )
    expect(result.isValid).toBe(true)
    expect(
      result.warnings.some((w) => w.field === "statement_period.start_date")
    ).toBe(true)
  })

  it("detects duplicate balances", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        {
          balances: [
            { date: "2024-06-30", amount: 50000, label: "Balance A", is_maximum: false },
            { date: "2024-06-30", amount: 50000, label: "Balance B", is_maximum: false },
          ],
        },
      ])
    )
    expect(result.warnings.some((w) => w.field === "balances")).toBe(true)
  })

  it("flags low confidence fields", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({}, [
        {
          confidence: {
            bank_name: "low",
            account_number: "high",
            currency: "low",
            max_balance: "high",
            overall: "medium",
          },
        },
      ])
    )
    expect(result.warnings.some((w) => w.field === "confidence")).toBe(true)
    const confidenceWarning = result.warnings.find((w) => w.field === "confidence")
    expect(confidenceWarning?.message).toContain("bank_name")
    expect(confidenceWarning?.message).toContain("currency")
  })

  it("returns warning for transaction-only document", () => {
    const result = validateExtractionResult(
      createValidExtractionResult({
        document_metadata: {
          page_count: 3,
          is_multi_account: false,
          is_transaction_only: true,
        },
      })
    )
    expect(result.isValid).toBe(true)
    expect(
      result.warnings.some((w) =>
        w.field === "document_metadata.is_transaction_only"
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateAccount
// ---------------------------------------------------------------------------

describe("validateAccount", () => {
  it("returns empty errors and warnings for a valid account", () => {
    const { errors, warnings } = validateAccount(createValidAccount(), 0)
    expect(errors).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it("sets the correct accountIndex on errors and warnings", () => {
    const account = createValidAccount({ account_number: "" })
    const { errors } = validateAccount(account, 5)
    expect(errors[0].accountIndex).toBe(5)
  })

  it("returns error for zero max balance", () => {
    const account = createValidAccount({
      max_balance: { amount: 0, date: null, label: "Zero" },
    })
    const { errors } = validateAccount(account, 0)
    expect(errors.some((e) => e.field === "max_balance.amount")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateCurrencyCode
// ---------------------------------------------------------------------------

describe("validateCurrencyCode", () => {
  it("returns true for valid currency codes", () => {
    expect(validateCurrencyCode("USD")).toBe(true)
    expect(validateCurrencyCode("EUR")).toBe(true)
    expect(validateCurrencyCode("JPY")).toBe(true)
    expect(validateCurrencyCode("GBP")).toBe(true)
    expect(validateCurrencyCode("CHF")).toBe(true)
  })

  it("handles case-insensitive input", () => {
    expect(validateCurrencyCode("usd")).toBe(true)
    expect(validateCurrencyCode("eur")).toBe(true)
  })

  it("returns false for invalid currency codes", () => {
    expect(validateCurrencyCode("XYZ")).toBe(false)
    expect(validateCurrencyCode("INVALID")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(validateCurrencyCode("")).toBe(false)
  })

  it("returns false for null/undefined passed as any", () => {
    expect(validateCurrencyCode(null as unknown as string)).toBe(false)
    expect(validateCurrencyCode(undefined as unknown as string)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateCountryCode
// ---------------------------------------------------------------------------

describe("validateCountryCode", () => {
  it("returns true for valid country codes", () => {
    expect(validateCountryCode("US")).toBe(true)
    expect(validateCountryCode("GB")).toBe(true)
    expect(validateCountryCode("JP")).toBe(true)
    expect(validateCountryCode("CH")).toBe(true)
    expect(validateCountryCode("DE")).toBe(true)
  })

  it("handles case-insensitive input", () => {
    expect(validateCountryCode("us")).toBe(true)
    expect(validateCountryCode("gb")).toBe(true)
  })

  it("returns false for invalid country codes", () => {
    expect(validateCountryCode("XX")).toBe(false)
    expect(validateCountryCode("ZZ")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(validateCountryCode("")).toBe(false)
  })

  it("returns false for null/undefined passed as any", () => {
    expect(validateCountryCode(null as unknown as string)).toBe(false)
    expect(validateCountryCode(undefined as unknown as string)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateDateString
// ---------------------------------------------------------------------------

describe("validateDateString", () => {
  it("returns true for valid YYYY-MM-DD dates", () => {
    expect(validateDateString("2024-01-01")).toBe(true)
    expect(validateDateString("2024-06-15")).toBe(true)
    expect(validateDateString("2024-12-31")).toBe(true)
    expect(validateDateString("2000-02-29")).toBe(true) // leap year
  })

  it("returns false for invalid date formats", () => {
    expect(validateDateString("01/01/2024")).toBe(false)
    expect(validateDateString("2024/01/01")).toBe(false)
    expect(validateDateString("Jan 1, 2024")).toBe(false)
    expect(validateDateString("20240101")).toBe(false)
  })

  it("returns false for impossible dates", () => {
    expect(validateDateString("2024-02-30")).toBe(false) // Feb 30 does not exist
    expect(validateDateString("2024-13-01")).toBe(false) // month 13
    expect(validateDateString("2024-00-15")).toBe(false) // month 0
    expect(validateDateString("2024-04-31")).toBe(false) // April has 30 days
  })

  it("returns false for non-leap year Feb 29", () => {
    expect(validateDateString("2023-02-29")).toBe(false) // 2023 is not a leap year
  })

  it("returns false for years outside 1900-2100 range", () => {
    expect(validateDateString("1899-06-15")).toBe(false)
    expect(validateDateString("2101-06-15")).toBe(false)
  })

  it("returns false for empty or null values", () => {
    expect(validateDateString("")).toBe(false)
    expect(validateDateString(null as unknown as string)).toBe(false)
    expect(validateDateString(undefined as unknown as string)).toBe(false)
  })
})
