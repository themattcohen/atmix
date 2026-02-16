// src/lib/tabular-to-extraction.ts

import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"
import type { ParsedSheet } from "./tabular-parser"
import type { MappingResult, MappableField } from "./column-mapper"

interface TransformOptions {
  fileName: string
}

export function parseAmount(raw: string | number | null): number | null {
  if (raw == null) return null
  if (typeof raw === "number") return raw

  let cleaned = String(raw).trim()
  if (!cleaned) return null

  const isAccountingNegative = /^\(.*\)$/.test(cleaned)
  if (isAccountingNegative) {
    cleaned = cleaned.replace(/[()]/g, "")
  }

  cleaned = cleaned.replace(/[A-Za-z$\u20AC\u00A3\u00A5\u20B9]/g, "").trim()

  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")

  if (lastComma > lastDot && lastComma > -1) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (lastDot > lastComma && lastComma > -1) {
    cleaned = cleaned.replace(/,/g, "")
  } else if (lastComma > -1 && lastDot === -1) {
    const afterComma = cleaned.split(",")[1]
    if (afterComma && afterComma.length === 3) {
      cleaned = cleaned.replace(/,/g, "")
    } else {
      cleaned = cleaned.replace(",", ".")
    }
  }

  cleaned = cleaned.replace(/\s/g, "")
  cleaned = cleaned.replace(/[^0-9.\-]/g, "")

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  const result = isAccountingNegative ? -Math.abs(num) : num
  return result
}

export function parseDate(raw: string | number | null): string | null {
  if (raw == null) return null
  const str = String(raw).trim()
  if (!str) return null

  // ISO format YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // YYYY/MM/DD format
  const ymd = str.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // Single regex for p1/p2/YYYY — disambiguate by separator and values
  const parts = str.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{4})$/)
  if (parts) {
    const [, p1, sep, p2, y] = parts
    const n1 = parseInt(p1, 10)
    const n2 = parseInt(p2, 10)

    let day: string
    let month: string

    if (sep === ".") {
      // European convention: DD.MM.YYYY
      day = p1
      month = p2
    } else if (n1 > 12) {
      // p1 can't be a month → must be DMY
      day = p1
      month = p2
    } else if (n2 > 12) {
      // p2 can't be a month → must be MDY
      month = p1
      day = p2
    } else {
      // Ambiguous (both ≤ 12) — default MDY for / and - separators
      month = p1
      day = p2
    }

    return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0]
  }

  return null
}

function detectCurrency(
  rows: Record<string, string | number | null>[],
  mappings: MappingResult,
): string {
  const currencyMapping = mappings.mappings.find(m => m.targetField === "currency")
  if (currencyMapping) {
    const values = rows
      .map(r => r[currencyMapping.sourceColumn])
      .filter(v => v != null)
      .map(v => String(v).trim().toUpperCase())

    if (values.length > 0) {
      const counts = new Map<string, number>()
      for (const v of values) {
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const [mostCommon] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
      return mostCommon
    }
  }

  const amountMapping = mappings.mappings.find(
    m => m.targetField === "amount" || m.targetField === "balance"
  )
  if (amountMapping) {
    const sampleValue = String(rows[0]?.[amountMapping.sourceColumn] ?? "")
    if (sampleValue.includes("$") || sampleValue.includes("USD")) return "USD"
    if (sampleValue.includes("\u20AC") || sampleValue.includes("EUR")) return "EUR"
    if (sampleValue.includes("\u00A3") || sampleValue.includes("GBP")) return "GBP"
    if (sampleValue.includes("\u00A5") || sampleValue.includes("JPY")) return "JPY"
    if (sampleValue.includes("CHF")) return "CHF"
    if (sampleValue.includes("CAD")) return "CAD"
  }

  return "UNKNOWN"
}

function getFieldValue(
  row: Record<string, string | number | null>,
  mappings: MappingResult,
  targetField: MappableField,
): string | number | null {
  const mapping = mappings.mappings.find(m => m.targetField === targetField)
  if (!mapping) return null
  return row[mapping.sourceColumn] ?? null
}

function transformSheet(
  sheet: ParsedSheet,
  mappings: MappingResult,
  options: TransformOptions,
): ExtractedAccount | null {
  if (sheet.rows.length === 0) return null

  let accountNumber: string | null = null
  for (const row of sheet.rows) {
    const val = getFieldValue(row, mappings, "account_number")
    if (val != null && String(val).trim()) {
      accountNumber = String(val).trim()
      break
    }
  }

  if (!accountNumber) {
    accountNumber = sheet.sheetName !== "Sheet1"
      ? sheet.sheetName
      : options.fileName.replace(/\.[^.]+$/, "")
  }

  const currency = detectCurrency(sheet.rows, mappings)
  const warnings: string[] = []

  const balances: ExtractedAccount["balances"] = []
  let maxBalance = -Infinity
  let maxBalanceDate: string | null = null
  let maxBalanceLabel = ""

  const hasBalanceColumn = mappings.mappings.some(
    m => m.targetField === "balance" || m.targetField === "closing_balance"
  )

  if (hasBalanceColumn) {
    for (const row of sheet.rows) {
      const balanceVal = getFieldValue(row, mappings, "balance")
        ?? getFieldValue(row, mappings, "closing_balance")
      const dateVal = getFieldValue(row, mappings, "date")

      const amount = parseAmount(balanceVal)
      const date = parseDate(dateVal)

      if (amount != null) {
        const label = date ? `Balance on ${date}` : "Balance"
        const absAmount = Math.abs(amount)
        balances.push({
          date,
          amount: absAmount,
          label,
          is_maximum: false,
        })
        if (absAmount > maxBalance) {
          maxBalance = absAmount
          maxBalanceDate = date
          maxBalanceLabel = label
        }
      }
    }
  }

  if (balances.length === 0) {
    const openingBalanceMapping = mappings.mappings.find(m => m.targetField === "opening_balance")
    let runningBalance = 0

    if (openingBalanceMapping) {
      const openVal = parseAmount(sheet.rows[0]?.[openingBalanceMapping.sourceColumn])
      if (openVal != null) {
        runningBalance = openVal
        balances.push({
          date: parseDate(getFieldValue(sheet.rows[0], mappings, "date")),
          amount: Math.abs(runningBalance),
          label: "Opening balance",
          is_maximum: false,
        })
        if (Math.abs(runningBalance) > maxBalance) {
          maxBalance = Math.abs(runningBalance)
          maxBalanceDate = parseDate(getFieldValue(sheet.rows[0], mappings, "date"))
          maxBalanceLabel = "Opening balance"
        }
      }
    }

    for (const row of sheet.rows) {
      const amountVal = getFieldValue(row, mappings, "amount")
      const amount = parseAmount(amountVal)
      if (amount != null) {
        runningBalance += amount
        const date = parseDate(getFieldValue(row, mappings, "date"))
        if (Math.abs(runningBalance) > maxBalance) {
          maxBalance = Math.abs(runningBalance)
          maxBalanceDate = date
          maxBalanceLabel = `Computed balance on ${date ?? "unknown date"}`
        }
      }
    }

    if (runningBalance !== 0 || balances.length > 0) {
      warnings.push(
        "Balance was computed from transaction amounts. " +
        "Verify the maximum balance figure is correct."
      )
      const lastDate = parseDate(
        getFieldValue(sheet.rows[sheet.rows.length - 1], mappings, "date")
      )
      balances.push({
        date: lastDate,
        amount: Math.abs(runningBalance),
        label: "Computed closing balance",
        is_maximum: false,
      })
    }
  }

  for (const b of balances) {
    if (b.amount === maxBalance && !balances.some(x => x.is_maximum)) {
      b.is_maximum = true
    }
  }

  const dates = sheet.rows
    .map(r => parseDate(getFieldValue(r, mappings, "date")))
    .filter((d): d is string => d != null)
    .sort()

  const startDate = dates[0] ?? null
  const endDate = dates[dates.length - 1] ?? null

  const hasExplicitBalance = hasBalanceColumn && balances.length > 0
  const confidence: ExtractedAccount["confidence"] = {
    bank_name: "low",
    account_number: accountNumber ? "high" : "low",
    currency: currency !== "UNKNOWN" ? "high" : "low",
    max_balance: hasExplicitBalance ? "high" : "medium",
    overall: hasExplicitBalance ? "high" : "medium",
  }

  if (currency === "UNKNOWN") {
    warnings.push("Currency could not be detected. Please set it manually during review.")
  }

  if (!mappings.hasCriticalFields) {
    warnings.push(
      "Column mapping was incomplete. Some fields may be missing or incorrect. " +
      `Mapping method: ${mappings.method}.`
    )
  }

  return {
    bank_name: null,
    bank_address: {
      street: null,
      city: null,
      state_province: null,
      country: ((): string => {
        const v = getFieldValue(sheet.rows[0], mappings, "country")
        return v != null && String(v).trim() ? String(v).trim().toUpperCase() : "XX"
      })(),
      postal_code: null,
    },
    account_number: accountNumber ?? "UNKNOWN",
    account_type: ((): "bank" | "securities" | "other" => {
      const v = getFieldValue(sheet.rows[0], mappings, "account_type")
      if (v == null) return "bank"
      const normalized = String(v).trim().toLowerCase()
      if (normalized === "securities" || normalized === "brokerage" || normalized === "investment") return "securities"
      if (normalized === "other") return "other"
      return "bank"
    })(),
    account_type_description: null,
    currency,
    statement_period: {
      start_date: startDate ?? "1970-01-01",
      end_date: endDate ?? "1970-01-01",
    },
    balances,
    max_balance: {
      amount: maxBalance === -Infinity ? 0 : maxBalance,
      date: maxBalanceDate,
      label: maxBalanceLabel || "No balance data found",
    },
    confidence,
    warnings,
  }
}

export function transformToExtractionResult(
  sheets: ParsedSheet[],
  mappingsPerSheet: MappingResult[],
  options: TransformOptions,
): ExtractionResult {
  const accounts: ExtractedAccount[] = []

  for (let i = 0; i < sheets.length; i++) {
    const account = transformSheet(sheets[i], mappingsPerSheet[i], options)
    if (account) {
      accounts.push(account)
    }
  }

  return {
    accounts,
    document_language: "en",
    document_metadata: {
      page_count: sheets.length,
      is_multi_account: accounts.length > 1,
      is_transaction_only: accounts.every(
        a => a.warnings.some(w => w.includes("computed from transaction"))
      ),
    },
  }
}
