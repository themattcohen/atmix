// src/lib/tabular-extraction.ts

import { getFileBuffer } from "./s3"
import { parseTabularFile } from "./tabular-parser"
import { mapColumns } from "./column-mapper"
import { transformToExtractionResult } from "./tabular-to-extraction"
import type { ExtractionResponse } from "@/types/extraction"

const TABULAR_MIME_TYPES = new Set([
  "text/csv",
  "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "xlsx",
])

export function isTabularFileType(fileType: string): boolean {
  return TABULAR_MIME_TYPES.has(fileType.toLowerCase())
}

export async function extractFromTabularFile(
  filePath: string,
  fileType: string,
  fileName: string,
): Promise<ExtractionResponse> {
  const startTime = Date.now()

  try {
    // 1. Fetch file from S3
    const buffer = await getFileBuffer(filePath)

    // 2. Parse into tabular structure
    const parsed = parseTabularFile(buffer, fileType)

    // 3. Map columns for each sheet
    const mappings = await Promise.all(
      parsed.sheets.map((sheet) => mapColumns(sheet))
    )

    // 4. Transform to ExtractionResult
    const result = transformToExtractionResult(
      parsed.sheets,
      mappings,
      { fileName },
    )

    const elapsed = Date.now() - startTime
    const llmUsed = mappings.some(m => m.method === "llm" || m.method === "hybrid")

    console.log(
      `[TabularExtraction] Completed in ${elapsed}ms | ` +
      `format=${parsed.fileFormat} | ` +
      `sheets=${parsed.sheets.length} | ` +
      `accounts=${result.accounts.length} | ` +
      `llm_fallback=${llmUsed}`
    )

    return {
      success: true,
      result,
      model: llmUsed ? "claude-sonnet-4-5-20250929" : "programmatic",
      tokensUsed: 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown tabular extraction error"
    console.error(`[TabularExtraction] Failed: ${message}`)
    return {
      success: false,
      result: null,
      error: message,
      model: "programmatic",
      tokensUsed: 0,
    }
  }
}
