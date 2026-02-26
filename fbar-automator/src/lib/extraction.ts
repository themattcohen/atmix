// ---------------------------------------------------------------------------
// Claude LLM Extraction Service
// ---------------------------------------------------------------------------
// Sends bank statement images/PDFs to Claude's vision API and returns
// structured extraction data.  This is the core intelligence layer for the
// FBAR Automator extraction pipeline.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk"
import * as XLSX from "xlsx"
import { getFileBuffer } from "./s3"
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts"
import type { ExtractionResult, ExtractionResponse } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-5-20250929"
const MAX_TOKENS = 16384

/**
 * Supported media types mapped from common file extensions.
 */
const MEDIA_TYPE_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  tiff: "image/tiff",
  tif: "image/tiff",
  bmp: "image/bmp",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let client: Anthropic | null = null

/**
 * Lazily creates and returns an Anthropic client.  Throws immediately if
 * ANTHROPIC_API_KEY is not set so callers get a clear error instead of a
 * cryptic 401 at request time.
 */
function getAnthropicClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
        "Add it to your .env file to enable document extraction."
    )
  }

  client = new Anthropic({ apiKey })
  return client
}

// ---------------------------------------------------------------------------
// Media type resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a file extension (e.g. "pdf", "jpeg") to the Anthropic-compatible
 * media type string.  Returns undefined for unsupported types.
 */
function resolveMediaType(fileType: string): string | undefined {
  const normalized = fileType.toLowerCase().replace(/^\./, "")

  // Direct match by extension (e.g. "pdf", "jpeg")
  if (MEDIA_TYPE_MAP[normalized]) {
    return MEDIA_TYPE_MAP[normalized]
  }

  // Match by MIME type (e.g. "application/pdf", "image/jpeg")
  const mimeValues = Object.values(MEDIA_TYPE_MAP)
  if (mimeValues.includes(normalized)) {
    return normalized
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Parses Claude's text response into an ExtractionResult.  Handles the common
 * case where the model wraps the JSON payload in markdown fenced code blocks.
 */
function parseExtractionResponse(text: string): ExtractionResult {
  let cleaned = text.trim()

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/m)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned) as ExtractionResult
    return parsed
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown JSON parse error"
    throw new Error(
      `Failed to parse extraction response as JSON: ${message}. ` +
        `Raw response (first 500 chars): ${text.slice(0, 500)}`
    )
  }
}

/**
 * Converts a CSV buffer to a labelled text representation for Claude.
 */
function convertCsvToText(buffer: Buffer): string {
  return `CSV Bank Statement Data:\n\n${buffer.toString("utf-8")}`
}

/**
 * Converts an Excel buffer to a labelled text representation for Claude.
 * Each sheet is converted to CSV format and included with a sheet name header.
 */
function convertExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sections: string[] = []
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })
    if (csv.trim()) sections.push(`Sheet: ${name}\n${csv}`)
  }
  return `Excel Bank Statement Data:\n\n${sections.join("\n\n")}`
}

// ---------------------------------------------------------------------------
// Programmatic CSV Extraction
// ---------------------------------------------------------------------------

/**
 * Parses a CSV bank statement buffer into an ExtractionResult without calling
 * the LLM.  Expects columns: Account Number, Date, Currency, Balance, Description.
 * Groups rows by account number, finds the maximum balance, and determines the
 * statement period from the earliest/latest dates.
 */
function extractCsvProgrammatically(buffer: Buffer): ExtractionResult {
  const text = buffer.toString("utf-8").trim()
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  if (lines.length < 2) {
    throw new Error("CSV file has no data rows")
  }

  // Parse headers (case-insensitive, trimmed)
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const colIdx = {
    accountNumber: headers.findIndex((h) => h.includes("account") && h.includes("number")),
    date: headers.findIndex((h) => h === "date"),
    currency: headers.findIndex((h) => h === "currency"),
    balance: headers.findIndex((h) => h === "balance"),
    description: headers.findIndex((h) => h === "description"),
  }

  if (colIdx.accountNumber === -1 || colIdx.balance === -1) {
    throw new Error("CSV missing required columns: Account Number, Balance")
  }

  // Parse rows and group by account number
  const accountMap = new Map<string, { dates: string[]; balances: { date: string | null; amount: number; label: string }[]; currency: string }>()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim())
    const acctNum = cols[colIdx.accountNumber] || ""
    if (!acctNum) continue

    const date = colIdx.date >= 0 ? cols[colIdx.date] || null : null
    const amount = parseFloat(cols[colIdx.balance] || "0")
    const currency = colIdx.currency >= 0 ? cols[colIdx.currency] || "USD" : "USD"
    const description = colIdx.description >= 0 ? cols[colIdx.description] || "" : ""

    if (!accountMap.has(acctNum)) {
      accountMap.set(acctNum, { dates: [], balances: [], currency })
    }
    const entry = accountMap.get(acctNum)!
    if (date) entry.dates.push(date)
    entry.balances.push({ date, amount, label: description || `Row ${i}` })
  }

  // Build ExtractedAccount for each account
  const accounts: import("@/types/extraction").ExtractedAccount[] = []

  for (const [acctNum, data] of Array.from(accountMap.entries())) {
    // Find max balance
    let maxBal = data.balances[0]
    for (const b of data.balances) {
      if (b.amount > maxBal.amount) maxBal = b
    }

    // Determine statement period from date range
    const sortedDates = data.dates.filter(Boolean).sort()
    const startDate = sortedDates[0] || null
    const endDate = sortedDates[sortedDates.length - 1] || null

    accounts.push({
      bank_name: null,
      bank_address: {
        street: null,
        city: null,
        state_province: null,
        country: "XX",
        postal_code: null,
      },
      account_number: acctNum,
      account_type: "bank",
      account_type_description: null,
      currency: data.currency,
      statement_period: {
        start_date: startDate || "1970-01-01",
        end_date: endDate || "1970-01-01",
      },
      balances: data.balances.map((b: { date: string | null; amount: number; label: string }) => ({
        date: b.date,
        amount: b.amount,
        label: b.label,
        is_maximum: b.amount === maxBal.amount && b.date === maxBal.date,
      })),
      max_balance: {
        amount: maxBal.amount,
        date: maxBal.date,
        label: maxBal.label,
      },
      confidence: {
        bank_name: "low",
        account_number: "high",
        currency: "high",
        max_balance: "high",
        overall: "medium",
      },
      warnings: ["Extracted programmatically from CSV — bank name and address not available"],
    })
  }

  return {
    accounts,
    document_language: "en",
    document_metadata: {
      page_count: 1,
      is_multi_account: accounts.length > 1,
      is_transaction_only: false,
    },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts structured FBAR data from a bank statement stored in S3.
 *
 * @param filePath  S3 object key for the uploaded statement
 * @param fileType  File extension or MIME hint (e.g. "pdf", "jpeg")
 * @returns         ExtractionResponse with success/error state and token usage
 */
export async function extractFromStatement(
  filePath: string,
  fileType: string
): Promise<ExtractionResponse> {
  const startTime = Date.now()

  try {
    // ----- Resolve media type ------------------------------------------------
    const mediaType = resolveMediaType(fileType)
    if (!mediaType) {
      return {
        success: false,
        result: null,
        error: `Unsupported file type: "${fileType}". Supported types: ${Object.keys(MEDIA_TYPE_MAP).join(", ")}`,
        model: MODEL,
        tokensUsed: 0,
      }
    }

    // ----- Fetch file from S3 ------------------------------------------------
    let fileBuffer: Buffer
    try {
      fileBuffer = await getFileBuffer(filePath)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown S3 error"
      return {
        success: false,
        result: null,
        error: `Failed to fetch file from S3 (key: ${filePath}): ${message}`,
        model: MODEL,
        tokensUsed: 0,
      }
    }

    // ----- Programmatic CSV extraction (no LLM needed) -----------------------
    if (mediaType === "text/csv") {
      const result = extractCsvProgrammatically(fileBuffer)
      const elapsed = Date.now() - startTime
      console.log(
        `[Extraction] CSV parsed programmatically in ${elapsed}ms | accounts=${result.accounts.length}`
      )
      return {
        success: true,
        result,
        model: "csv-parser",
        tokensUsed: 0,
      }
    }

    // ----- Build content block -----------------------------------------------
    const isPdf = mediaType === "application/pdf"
    const isTabular =
      mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    let documentContentBlock: Anthropic.Messages.ContentBlockParam

    if (isTabular) {
      const textContent = convertExcelToText(fileBuffer)
      documentContentBlock = { type: "text", text: textContent }
    } else if (isPdf) {
      const base64Data = fileBuffer.toString("base64")
      documentContentBlock = {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      }
    } else {
      const base64Data = fileBuffer.toString("base64")
      documentContentBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: base64Data,
        },
      }
    }

    // ----- Call Claude API ---------------------------------------------------
    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            documentContentBlock,
            {
              type: "text",
              text: EXTRACTION_USER_PROMPT,
            },
          ],
        },
      ],
    })

    // ----- Check for truncated response --------------------------------------
    const wasResponseTruncated = response.stop_reason === "max_tokens"

    // ----- Extract text from response ----------------------------------------
    const textBlock = response.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return {
        success: false,
        result: null,
        error: "Claude returned no text content in the response.",
        model: MODEL,
        tokensUsed:
          (response.usage?.input_tokens ?? 0) +
          (response.usage?.output_tokens ?? 0),
      }
    }

    // ----- Parse and return --------------------------------------------------
    const tokensUsed =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0)

    const result = parseExtractionResponse(textBlock.text)

    if (wasResponseTruncated) {
      // Add truncation warning to each extracted account
      if (result.accounts) {
        for (const account of result.accounts) {
          account.warnings = account.warnings || []
          account.warnings.push(
            "Response may be incomplete due to document complexity. Some balances may be missing."
          )
        }
      }
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[Extraction] Completed in ${elapsed}ms | model=${MODEL} | tokens=${tokensUsed} | accounts=${result.accounts.length}`
    )

    return {
      success: true,
      result,
      model: MODEL,
      tokensUsed,
    }
  } catch (err) {
    // ----- Anthropic API errors ----------------------------------------------
    if (err instanceof Anthropic.APIError) {
      const statusCode = err.status
      const errorMessage = err.message

      console.error(
        `[Extraction] Anthropic API error: status=${statusCode} message=${errorMessage}`
      )

      return {
        success: false,
        result: null,
        error: `Claude API error (HTTP ${statusCode}): ${errorMessage}`,
        model: MODEL,
        tokensUsed: 0,
      }
    }

    // ----- JSON parse and other known errors ---------------------------------
    if (err instanceof Error) {
      console.error(`[Extraction] Error: ${err.message}`)
      return {
        success: false,
        result: null,
        error: err.message,
        model: MODEL,
        tokensUsed: 0,
      }
    }

    // ----- Truly unexpected --------------------------------------------------
    console.error("[Extraction] Unexpected error:", err)
    return {
      success: false,
      result: null,
      error: "An unexpected error occurred during extraction.",
      model: MODEL,
      tokensUsed: 0,
    }
  }
}

// Re-export for testing and direct use
export { parseExtractionResponse, getAnthropicClient, resolveMediaType }
