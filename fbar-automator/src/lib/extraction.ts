// ---------------------------------------------------------------------------
// Claude LLM Extraction Service
// ---------------------------------------------------------------------------
// Sends bank statement images/PDFs to Claude's vision API and returns
// structured extraction data.  This is the core intelligence layer for the
// FBAR Automator extraction pipeline.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk"
import { getFileBuffer } from "./s3"
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts"
import type { ExtractionResult, ExtractionResponse } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-5-20250929"
const MAX_TOKENS = 4096

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
  return MEDIA_TYPE_MAP[normalized]
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

    const base64Data = fileBuffer.toString("base64")

    // ----- Build content block -----------------------------------------------
    const isPdf = mediaType === "application/pdf"

    const documentContentBlock: Anthropic.Messages.ContentBlockParam = isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data,
          },
        }
      : {
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
