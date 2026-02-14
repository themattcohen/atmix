// ---------------------------------------------------------------------------
// Extraction Pipeline Types
// ---------------------------------------------------------------------------
// Defines the JSON schema Claude returns when extracting data from bank
// statements, along with the wrapper response type used by the service layer.
// ---------------------------------------------------------------------------

/**
 * Top-level extraction result returned by Claude for a single document.
 */
export interface ExtractionResult {
  accounts: ExtractedAccount[]
  document_language: string
  document_metadata: {
    page_count: number
    is_multi_account: boolean
    is_transaction_only: boolean
  }
}

/**
 * A single foreign bank account extracted from a statement document.
 */
export interface ExtractedAccount {
  bank_name: string | null
  bank_address: {
    street: string | null
    city: string | null
    state_province: string | null
    country: string // ISO 3166-1 alpha-2
    postal_code: string | null
  }
  account_number: string
  account_type: "bank" | "securities" | "other"
  account_type_description: string | null
  currency: string // ISO 4217
  statement_period: {
    start_date: string // YYYY-MM-DD
    end_date: string // YYYY-MM-DD
  }
  balances: {
    date: string | null // YYYY-MM-DD
    amount: number
    label: string
    is_maximum: boolean
  }[]
  max_balance: {
    amount: number
    date: string | null // YYYY-MM-DD
    label: string
  }
  confidence: {
    bank_name: "high" | "medium" | "low"
    account_number: "high" | "medium" | "low"
    currency: "high" | "medium" | "low"
    max_balance: "high" | "medium" | "low"
    overall: "high" | "medium" | "low"
  }
  warnings: string[]
}

/**
 * Service-level response wrapping the extraction result with metadata.
 */
export interface ExtractionResponse {
  success: boolean
  result: ExtractionResult | null
  error?: string
  model: string
  tokensUsed: number
}
