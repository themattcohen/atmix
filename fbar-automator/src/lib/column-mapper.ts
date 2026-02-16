// src/lib/column-mapper.ts

import type { ParsedSheet } from "./tabular-parser"

export type MappableField =
  | "bank_name"
  | "account_number"
  | "currency"
  | "date"
  | "balance"
  | "amount"
  | "description"
  | "country"
  | "account_type"
  | "opening_balance"
  | "closing_balance"
  | "unmapped"

export interface ColumnMapping {
  sourceColumn: string
  targetField: MappableField
  confidence: "high" | "medium" | "low"
}

export interface MappingResult {
  mappings: ColumnMapping[]
  method: "heuristic" | "llm" | "hybrid"
  unmappedColumns: string[]
  hasCriticalFields: boolean
}

const HEURISTIC_PATTERNS: { field: MappableField; patterns: RegExp[] }[] = [
  {
    field: "account_number",
    patterns: [
      /^account\s*(?:no|num|number|#|id)?$/i,
      /^acct\s*(?:no|num|number|#)?$/i,
      /^konto(?:nummer)?$/i,
      /^numero?\s*(?:de\s*)?(?:cuenta|compte)$/i,
      /^IBAN$/i,
    ],
  },
  {
    field: "bank_name",
    patterns: [
      /^(?:bank|institution)\s*(?:name)?$/i,
      /^(?:financial\s*institution)$/i,
    ],
  },
  {
    field: "currency",
    patterns: [
      /^(?:currency|curr|ccy|devise|w[aä]hrung)$/i,
      /^currency\s*code$/i,
    ],
  },
  {
    field: "date",
    patterns: [
      /^(?:date|datum|fecha|data)$/i,
      /^(?:transaction|txn|posting|value|booking)\s*date$/i,
      /^(?:trade|settlement)\s*date$/i,
    ],
  },
  {
    field: "balance",
    patterns: [
      /^(?:balance|saldo|solde)$/i,
      /^(?:running|available|current|closing|ledger)\s*balance$/i,
      /^(?:end|ending)\s*(?:of\s*day\s*)?balance$/i,
    ],
  },
  {
    field: "amount",
    patterns: [
      /^(?:amount|amt|betrag|montant|importe|monto)$/i,
      /^(?:transaction|txn|debit|credit)\s*(?:amount|amt)?$/i,
      /^(?:debit|credit)$/i,
    ],
  },
  {
    field: "opening_balance",
    patterns: [
      /^(?:opening|begin(?:ning)?|start(?:ing)?|initial)\s*balance$/i,
    ],
  },
  {
    field: "closing_balance",
    patterns: [
      /^(?:closing|end(?:ing)?|final)\s*balance$/i,
    ],
  },
  {
    field: "description",
    patterns: [
      /^(?:description|desc|narrative|details?|memo|reference|ref|text|verwendungszweck)$/i,
      /^(?:transaction|txn)\s*(?:description|details?|type)$/i,
      /^(?:payee|beneficiary|recipient)$/i,
    ],
  },
  {
    field: "country",
    patterns: [
      /^(?:country|country\s*code|land|pa[iy]s)$/i,
    ],
  },
  {
    field: "account_type",
    patterns: [
      /^(?:account\s*type|type\s*(?:of\s*)?account|kontotyp)$/i,
    ],
  },
]

export function mapColumnsHeuristic(headers: string[]): MappingResult {
  const mappings: ColumnMapping[] = []
  const unmapped: string[] = []

  for (const header of headers) {
    let matched = false
    for (const { field, patterns } of HEURISTIC_PATTERNS) {
      if (patterns.some((p) => p.test(header.trim()))) {
        mappings.push({
          sourceColumn: header,
          targetField: field,
          confidence: "high",
        })
        matched = true
        break
      }
    }
    if (!matched) {
      unmapped.push(header)
    }
  }

  const mappedFields = new Set(mappings.map((m) => m.targetField))
  const hasCriticalFields =
    mappedFields.has("account_number") &&
    (mappedFields.has("balance") || mappedFields.has("amount") ||
     mappedFields.has("closing_balance") || mappedFields.has("opening_balance"))

  return {
    mappings,
    method: "heuristic",
    unmappedColumns: unmapped,
    hasCriticalFields,
  }
}

export async function mapColumnsWithLlm(
  headers: string[],
  sampleRows: Record<string, string | number | null>[],
): Promise<MappingResult> {
  const { getAnthropicClient } = await import("./extraction")

  const client = getAnthropicClient()

  const sampleData = sampleRows.slice(0, 5).map((row) =>
    headers.map((h) => row[h] ?? "").join(" | ")
  ).join("\n")

  const prompt = `You are mapping CSV/Excel column headers from a bank statement export to a standard schema.

Column headers: ${JSON.stringify(headers)}

Sample data (first 5 rows, pipe-separated):
${sampleData}

Map each column header to ONE of these target fields:
- account_number: Bank account number or IBAN
- bank_name: Name of the financial institution
- currency: Currency code (e.g., EUR, USD, GBP)
- date: Transaction or statement date
- balance: Account balance (running, closing, or available)
- amount: Transaction amount
- opening_balance: Opening/beginning balance
- closing_balance: Closing/ending balance
- description: Transaction description or narrative
- country: Country code or name
- account_type: Type of account (savings, checking, securities)
- unmapped: Column is not relevant to FBAR reporting

Return JSON array: [{"source": "column_name", "target": "field_name", "confidence": "high|medium|low"}]
Return ONLY the JSON array, no explanation.`

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("LLM returned no text for column mapping")
  }

  let cleaned = textBlock.text.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/m)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  const parsed = JSON.parse(cleaned) as Array<{
    source: string
    target: string
    confidence: string
  }>

  const VALID_FIELDS: Set<string> = new Set<string>([
    "bank_name",
    "account_number",
    "currency",
    "date",
    "balance",
    "amount",
    "description",
    "country",
    "account_type",
    "opening_balance",
    "closing_balance",
    "unmapped",
  ])

  const mappings: ColumnMapping[] = parsed
    .filter((m) => {
      if (m.target === "unmapped") return false
      if (!VALID_FIELDS.has(m.target)) {
        console.warn(
          `[ColumnMapper] LLM returned invalid field name "${m.target}" for column "${m.source}" — skipping`
        )
        return false
      }
      return true
    })
    .map((m) => ({
      sourceColumn: m.source,
      targetField: m.target as MappableField,
      confidence: (m.confidence as "high" | "medium" | "low") || "medium",
    }))

  const mappedSources = new Set(mappings.map((m) => m.sourceColumn))
  const unmappedColumns = headers.filter((h) => !mappedSources.has(h))

  const mappedFields = new Set(mappings.map((m) => m.targetField))
  const hasCriticalFields =
    mappedFields.has("account_number") &&
    (mappedFields.has("balance") || mappedFields.has("amount") ||
     mappedFields.has("closing_balance") || mappedFields.has("opening_balance"))

  return {
    mappings,
    method: "llm",
    unmappedColumns,
    hasCriticalFields,
  }
}

export async function mapColumns(
  sheet: ParsedSheet,
): Promise<MappingResult> {
  const heuristicResult = mapColumnsHeuristic(sheet.headers)

  if (heuristicResult.hasCriticalFields) {
    return heuristicResult
  }

  console.log(
    `[ColumnMapper] Heuristic mapping insufficient for sheet "${sheet.sheetName}". ` +
    `Mapped: ${heuristicResult.mappings.map(m => m.targetField).join(", ")}. ` +
    `Falling back to LLM.`
  )

  try {
    const llmResult = await mapColumnsWithLlm(sheet.headers, sheet.rows)
    return { ...llmResult, method: "hybrid" }
  } catch (err) {
    console.error("[ColumnMapper] LLM mapping failed, using heuristic only:", err)
    return heuristicResult
  }
}
