import Anthropic from "@anthropic-ai/sdk"
import ExcelJS from "exceljs"
import { downloadFile } from "./s3"
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompts"
import type { ExtractionResult, ExtractionResponse } from "@/types/extraction"

const MODEL = "claude-sonnet-4-5-20250929"
const MAX_TOKENS = 16384
const MAX_EXCEL_ROWS = 5000

const MEDIA_TYPE_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

let client: Anthropic | null = null

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

function resolveMediaType(fileType: string): string | undefined {
  const normalized = fileType.toLowerCase().replace(/^\./, "")
  if (MEDIA_TYPE_MAP[normalized]) return MEDIA_TYPE_MAP[normalized]
  const mimeValues = Object.values(MEDIA_TYPE_MAP)
  if (mimeValues.includes(normalized)) return normalized
  return undefined
}

function parseExtractionResponse(text: string): ExtractionResult {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/m)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  try {
    return JSON.parse(cleaned) as ExtractionResult
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown JSON parse error"
    throw new Error(
      `Failed to parse extraction response as JSON: ${message}. ` +
        `Raw response (first 500 chars): ${text.slice(0, 500)}`
    )
  }
}

function convertCsvToText(buffer: Buffer): string {
  return `CSV Bank Statement Data:\n\n${buffer.toString("utf-8")}`
}

export async function convertExcelToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  await workbook.xlsx.load(arrayBuffer)
  const sections: string[] = []
  let totalRows = 0
  let truncated = false
  for (const worksheet of workbook.worksheets) {
    const rows: string[] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (totalRows >= MAX_EXCEL_ROWS) {
        truncated = true
        return
      }
      const cells = row.values as (string | number | null | undefined)[]
      // row.values is 1-indexed (index 0 is undefined), so slice(1)
      rows.push(cells.slice(1).map(v => v != null ? String(v) : "").join(","))
      totalRows++
    })
    if (rows.length > 0) sections.push(`Sheet: ${worksheet.name}\n${rows.join("\n")}`)
  }
  let result = `Excel Bank Statement Data:\n\n${sections.join("\n\n")}`
  if (truncated) {
    result += `\n\n[Truncated: Excel file exceeded ${MAX_EXCEL_ROWS} rows. Some data may be missing.]`
  }
  return result
}

export async function extractFromStatement(
  filePath: string,
  fileType: string
): Promise<ExtractionResponse> {
  const startTime = Date.now()

  try {
    const mediaType = resolveMediaType(fileType)
    if (!mediaType) {
      return {
        success: false, result: null,
        error: `Unsupported file type: "${fileType}". Supported types: ${Object.keys(MEDIA_TYPE_MAP).join(", ")}`,
        model: MODEL, tokensUsed: 0,
      }
    }

    let fileBuffer: Buffer
    try {
      fileBuffer = await downloadFile(filePath)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown S3 error"
      return {
        success: false, result: null,
        error: `Failed to fetch file from S3 (key: ${filePath}): ${message}`,
        model: MODEL, tokensUsed: 0,
      }
    }

    const isPdf = mediaType === "application/pdf"
    const isTabular = mediaType === "text/csv" ||
      mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    let documentContentBlock: Anthropic.Messages.ContentBlockParam

    if (isTabular) {
      const textContent = mediaType === "text/csv"
        ? convertCsvToText(fileBuffer)
        : await convertExcelToText(fileBuffer)
      documentContentBlock = { type: "text", text: textContent }
    } else if (isPdf) {
      const base64Data = fileBuffer.toString("base64")
      documentContentBlock = {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64Data },
      }
    } else {
      const base64Data = fileBuffer.toString("base64")
      documentContentBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64Data,
        },
      }
    }

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
            { type: "text", text: EXTRACTION_USER_PROMPT },
          ],
        },
      ],
    })

    const wasResponseTruncated = response.stop_reason === "max_tokens"
    const textBlock = response.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return {
        success: false, result: null,
        error: "Claude returned no text content in the response.",
        model: MODEL,
        tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      }
    }

    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)
    const result = parseExtractionResponse(textBlock.text)

    if (wasResponseTruncated && result.accounts) {
      for (const account of result.accounts) {
        account.warnings = account.warnings || []
        account.warnings.push("Response may be incomplete due to document complexity. Some balances may be missing.")
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[Extraction] Completed in ${elapsed}ms | model=${MODEL} | tokens=${tokensUsed} | accounts=${result.accounts?.length ?? 0}`)

    return { success: true, result, model: MODEL, tokensUsed }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[Extraction] Anthropic API error: status=${err.status} message=${err.message}`)
      return { success: false, result: null, error: `Claude API error (HTTP ${err.status}): ${err.message}`, model: MODEL, tokensUsed: 0 }
    }
    if (err instanceof Error) {
      console.error(`[Extraction] Error: ${err.message}`)
      return { success: false, result: null, error: err.message, model: MODEL, tokensUsed: 0 }
    }
    console.error("[Extraction] Unexpected error:", err)
    return { success: false, result: null, error: "An unexpected error occurred during extraction.", model: MODEL, tokensUsed: 0 }
  }
}

export { parseExtractionResponse, getAnthropicClient, resolveMediaType }
