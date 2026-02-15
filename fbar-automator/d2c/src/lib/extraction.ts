/**
 * STUB MODULE — Will be replaced with B2B fbar-automator code when production-ready.
 * See: /Users/matt/atmix/fbar-automator/src/lib/extraction.ts
 *
 * This stub exports the same interface for seamless future integration.
 */

// ---------------------------------------------------------------------------
// Public types (matching B2B module)
// ---------------------------------------------------------------------------

/**
 * Placeholder for the full ExtractionResult structure.
 * The actual B2B module returns detailed account data with confidence scores.
 */
export interface ExtractionResult {
  accounts: Array<{
    institutionName: string
    accountNumber: string
    accountType: string
    currency: string
    maxValue: number
    confidence: number
  }>
  metadata?: {
    documentDate?: string
    institutionName?: string
  }
}

export interface ExtractionResponse {
  success: boolean
  result: ExtractionResult | null
  error?: string
  model: string
  tokensUsed: number
}

// ---------------------------------------------------------------------------
// Public API (stub implementation)
// ---------------------------------------------------------------------------

/**
 * Extracts structured FBAR data from a bank statement stored in S3.
 *
 * @param filePath - S3 object key for the uploaded statement
 * @param fileType - File extension or MIME hint (e.g. "pdf", "jpeg")
 * @returns ExtractionResponse with success/error state and token usage
 *
 * @stub Returns failure response until B2B module is integrated
 */
export async function extractFromStatement(
  filePath: string,
  fileType: string
): Promise<ExtractionResponse> {
  console.warn(
    `[STUB] extractFromStatement called with filePath=${filePath}, fileType=${fileType}. B2B integration pending.`
  )

  // @TODO: Replace with actual B2B fbar-automator/src/lib/extraction.ts implementation
  return {
    success: false,
    result: null,
    error: 'STUB: Claude LLM extraction not yet integrated from B2B codebase',
    model: 'stub',
    tokensUsed: 0,
  }
}
