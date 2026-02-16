// src/lib/tabular-parser.ts

import Papa from "papaparse"
import * as XLSX from "xlsx"

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  rows: Record<string, string | number | null>[]
  rowCount: number
}

export interface TabularParseResult {
  sheets: ParsedSheet[]
  fileFormat: "csv" | "xlsx"
  encoding?: string
}

/**
 * Parse a CSV buffer into normalized sheet data.
 */
export function parseCsv(buffer: Buffer): TabularParseResult {
  const text = buffer.toString("utf-8")

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header: string) => header.trim(),
  })

  if (result.errors.length > 0) {
    const criticalErrors = result.errors.filter(e => e.type === "Delimiter" || e.type === "FieldMismatch")
    if (criticalErrors.length > 0) {
      throw new Error(
        `CSV parsing failed: ${criticalErrors.map(e => e.message).join("; ")}`
      )
    }
  }

  return {
    sheets: [{
      sheetName: "Sheet1",
      headers: result.meta.fields ?? [],
      rows: result.data,
      rowCount: result.data.length,
    }],
    fileFormat: "csv",
    encoding: "utf-8",
  }
}

/**
 * Parse an Excel buffer into normalized sheet data.
 * Processes all sheets -- each may represent a different account.
 */
export function parseExcel(buffer: Buffer): TabularParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })

  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    }) as unknown[][]

    if (jsonData.length === 0) {
      return { sheetName: name, headers: [], rows: [], rowCount: 0 }
    }

    // First non-empty row is treated as headers
    const headerRow = jsonData[0] as unknown[]
    const headers = headerRow.map((h, i) =>
      h != null ? String(h).trim() : `Column_${i + 1}`
    )

    const rows = jsonData.slice(1).map((row) => {
      const rowArr = row as unknown[]
      const obj: Record<string, string | number | null> = {}
      headers.forEach((header, i) => {
        const val = rowArr[i]
        obj[header] = val != null ? (typeof val === "number" ? val : String(val)) : null
      })
      return obj
    })

    return { sheetName: name, headers, rows, rowCount: rows.length }
  }).filter(s => s.rowCount > 0)

  if (sheets.length === 0) {
    throw new Error("Excel file contains no data rows")
  }

  return { sheets, fileFormat: "xlsx" }
}

/**
 * Route to the correct parser based on file type.
 */
export function parseTabularFile(buffer: Buffer, fileType: string): TabularParseResult {
  const normalized = fileType.toLowerCase()
  if (normalized === "text/csv" || normalized === "csv") {
    return parseCsv(buffer)
  }
  if (
    normalized === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    normalized === "xlsx"
  ) {
    return parseExcel(buffer)
  }
  throw new Error(`Unsupported tabular file type: ${fileType}`)
}
