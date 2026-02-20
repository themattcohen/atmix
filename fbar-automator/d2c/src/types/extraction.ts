// ---------------------------------------------------------------------------
// Extraction Pipeline Types
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  accounts: ExtractedAccount[]
  document_language: string
  document_metadata: {
    page_count: number
    is_multi_account: boolean
    is_transaction_only: boolean
  }
}

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
  ownership_type?: "financial_interest" | "signature_authority" | "both" | null
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

export interface ExtractionResponse {
  success: boolean
  result: ExtractionResult | null
  error?: string
  model: string
  tokensUsed: number
}
