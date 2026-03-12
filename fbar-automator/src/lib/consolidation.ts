// ---------------------------------------------------------------------------
// Consolidation Service
// ---------------------------------------------------------------------------
// Groups extracted statement data by account number, merges balances across
// statements, computes the true max balance, and calculates month coverage.
// ---------------------------------------------------------------------------

import type { ExtractedAccount } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsolidatedBalance {
  date: string | null
  amount: number
  label: string
  isMaximum: boolean
  sourceStatementId: string
  sourceFileName: string
}

export interface ConsolidatedAccount {
  normalizedAccountNumber: string
  displayAccountNumber: string
  bankName: string | null
  bankAddress: {
    street: string | null
    city: string | null
    state_province: string | null
    country: string
    postal_code: string | null
  } | null
  accountType: "bank" | "securities" | "other"
  currency: string
  allBalances: ConsolidatedBalance[]
  maxBalance: { amount: number; date: string | null; sourceFileName: string }
  coverage: {
    monthsCovered: number[]
    monthsMissing: number[]
    isComplete: boolean
    totalStatements: number
  }
  sourceStatements: Array<{
    statementId: string
    fileName: string
    periodStart: string
    periodEnd: string
  }>
  overallConfidence: "high" | "medium" | "low"
  warnings: string[]
  categorizedWarnings: CategorizedWarnings
  foreignAccountId: string | null
}

export interface CategorizedWarnings {
  currency: string | null
  domestic: string | null
  methodology: string[]
  coverage: string[]
  other: string[]
}

export interface StatementWithExtraction {
  id: string
  fileName: string
  fileType: string
  filePath: string
  presignedUrl: string
  accounts: ExtractedAccount[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

/**
 * Strips spaces, dashes, dots, and slashes then uppercases.
 * Used as the grouping key for account consolidation.
 */
export function normalizeAccountNumber(num: string): string {
  return num.replace(/[\s\-./]/g, "").toUpperCase()
}

/**
 * Returns the account with the highest confidence.overall.
 * Ties broken by number of balances (more = richer data).
 */
export function pickHighestConfidence(
  accounts: ExtractedAccount[]
): ExtractedAccount {
  let best = accounts[0]
  for (let i = 1; i < accounts.length; i++) {
    const current = accounts[i]
    const bestRank = CONFIDENCE_RANK[best.confidence.overall] ?? 0
    const currentRank = CONFIDENCE_RANK[current.confidence.overall] ?? 0
    if (
      currentRank > bestRank ||
      (currentRank === bestRank &&
        current.balances.length > best.balances.length)
    ) {
      best = current
    }
  }
  return best
}

/**
 * Computes which months of calendarYear are covered by the given statement
 * periods, and which are missing.
 */
export function computeMonthsCovered(
  statementPeriods: Array<{ start_date: string; end_date: string }>,
  calendarYear: number
): { monthsCovered: number[]; monthsMissing: number[] } {
  const covered = new Set<number>()

  for (const period of statementPeriods) {
    const start = new Date(period.start_date + "T00:00:00")
    const end = new Date(period.end_date + "T00:00:00")

    // Walk from start month to end month
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (cursor <= endMonth) {
      if (cursor.getFullYear() === calendarYear) {
        covered.add(cursor.getMonth() + 1) // 1-indexed
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  const monthsCovered = Array.from(covered).sort((a, b) => a - b)
  const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const monthsMissing = allMonths.filter((m) => !covered.has(m))

  return { monthsCovered, monthsMissing }
}

/**
 * Categorizes raw LLM warning strings into typed buckets for standardized rendering.
 */
export function categorizeWarnings(warnings: string[], bankName: string | null): CategorizedWarnings {
  const result: CategorizedWarnings = {
    currency: null,
    domestic: null,
    methodology: [],
    coverage: [],
    other: [],
  }

  for (const w of warnings) {
    const lower = w.toLowerCase()
    if (lower.includes("currency") || lower.includes("inferred") || lower.includes("cad") || lower.includes("usd") || lower.includes("iso 4217")) {
      // Take the first currency warning only
      if (!result.currency) {
        result.currency = w
      }
    } else if (lower.includes("domestic") || lower.includes("not a foreign") || lower.includes("not foreign")) {
      if (!result.domestic) {
        result.domestic = w
      }
    } else if (lower.includes("maximum balance") || lower.includes("highest balance") || lower.includes("max balance")) {
      result.methodology.push(w)
    } else if (lower.includes("missing") || lower.includes("partial") || lower.includes("coverage") || lower.includes("incomplete")) {
      result.coverage.push(w)
    } else {
      result.other.push(w)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Main consolidation
// ---------------------------------------------------------------------------

/**
 * Consolidates extracted accounts across multiple statements into grouped,
 * deduplicated account records with merged balances and coverage analysis.
 */
export function consolidateAccounts(
  statements: StatementWithExtraction[],
  foreignAccounts: { id: string; accountNumber: string; institutionName: string }[],
  calendarYear: number
): ConsolidatedAccount[] {
  // Flatten all extracted accounts with source metadata
  const flatEntries: Array<{
    account: ExtractedAccount
    statementId: string
    fileName: string
  }> = []

  for (const stmt of statements) {
    for (const account of stmt.accounts) {
      flatEntries.push({
        account,
        statementId: stmt.id,
        fileName: stmt.fileName,
      })
    }
  }

  // Group by normalizedAccountNumber + currency
  const groups = new Map<
    string,
    Array<{
      account: ExtractedAccount
      statementId: string
      fileName: string
    }>
  >()

  for (const entry of flatEntries) {
    const acctNum = entry.account.account_number
    if (!acctNum || acctNum.trim() === "") continue

    const key =
      normalizeAccountNumber(acctNum) + "|" + entry.account.currency
    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  // Build normalized foreign account lookup
  const normalizedForeignAccounts = foreignAccounts.map((fa) => ({
    ...fa,
    normalized: normalizeAccountNumber(fa.accountNumber),
  }))

  // Process each group
  const results: ConsolidatedAccount[] = []

  for (const [key, entries] of Array.from(groups.entries())) {
    const normalizedAcctNum = key.split("|")[0]
    const allAccounts = entries.map((e) => e.account)

    // Pick metadata from highest-confidence source
    const bestSource = pickHighestConfidence(allAccounts)

    // Merge all balances
    const allBalances: ConsolidatedBalance[] = []
    for (const entry of entries) {
      for (const bal of entry.account.balances) {
        allBalances.push({
          date: bal.date,
          amount: bal.amount,
          label: bal.label,
          isMaximum: false, // will be set below
          sourceStatementId: entry.statementId,
          sourceFileName: entry.fileName,
        })
      }
    }

    // Find the true max balance across all balances
    let maxIdx = -1
    let maxAmount = -Infinity
    for (let i = 0; i < allBalances.length; i++) {
      if (allBalances[i].amount > maxAmount) {
        maxAmount = allBalances[i].amount
        maxIdx = i
      }
    }

    if (maxIdx >= 0) {
      allBalances[maxIdx].isMaximum = true
    }

    const maxBalance =
      maxIdx >= 0
        ? {
            amount: allBalances[maxIdx].amount,
            date: allBalances[maxIdx].date,
            sourceFileName: allBalances[maxIdx].sourceFileName,
          }
        : { amount: 0, date: null, sourceFileName: entries[0].fileName }

    // Compute month coverage
    const statementPeriods = allAccounts.map((a) => a.statement_period)
    const { monthsCovered, monthsMissing } = computeMonthsCovered(
      statementPeriods,
      calendarYear
    )

    // Build source statements list (deduplicated by statementId)
    const seenStatementIds = new Set<string>()
    const sourceStatements: ConsolidatedAccount["sourceStatements"] = []
    for (const entry of entries) {
      if (!seenStatementIds.has(entry.statementId)) {
        seenStatementIds.add(entry.statementId)
        sourceStatements.push({
          statementId: entry.statementId,
          fileName: entry.fileName,
          periodStart: entry.account.statement_period.start_date,
          periodEnd: entry.account.statement_period.end_date,
        })
      }
    }

    // Match to foreign accounts
    let foreignAccountId: string | null = null
    // Full match first
    const fullMatch = normalizedForeignAccounts.find(
      (fa) => fa.normalized === normalizedAcctNum
    )
    if (fullMatch) {
      foreignAccountId = fullMatch.id
    } else {
      // Last-4-digits fallback
      const last4 = normalizedAcctNum.slice(-4)
      if (last4.length === 4) {
        const partialMatch = normalizedForeignAccounts.find(
          (fa) => fa.normalized.slice(-4) === last4
        )
        if (partialMatch) {
          foreignAccountId = partialMatch.id
        }
      }
    }

    // Aggregate warnings — collapse "no activity" variants into one summary
    const allWarnings: string[] = []
    const noActivityPeriods: string[] = []

    for (const entry of entries) {
      for (const w of entry.account.warnings) {
        const lower = w.toLowerCase()
        if (
          lower.includes("no account activity") ||
          lower.includes("no activity during") ||
          lower.includes("no transaction activity") ||
          (lower.includes("opening and closing balances") &&
            lower.includes("identical"))
        ) {
          // Track the statement period instead of keeping each paraphrase
          const start = entry.account.statement_period.start_date
          if (start) {
            const month = new Date(start + "T00:00:00").toLocaleDateString(
              "en-US",
              { month: "short", year: "numeric" }
            )
            if (!noActivityPeriods.includes(month)) {
              noActivityPeriods.push(month)
            }
          }
        } else if (!allWarnings.includes(w)) {
          allWarnings.push(w)
        }
      }
    }

    // Add a single collapsed "no activity" warning with month attribution
    if (noActivityPeriods.length > 0) {
      noActivityPeriods.sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      )
      allWarnings.push(
        `No account activity in ${noActivityPeriods.length} statement period${noActivityPeriods.length !== 1 ? "s" : ""} — opening and closing balances are identical: ${noActivityPeriods.join(", ")}`
      )
    }

    const categorizedWarnings = categorizeWarnings(allWarnings, bestSource.bank_name)

    // Compute overall confidence
    let overallConfidence: "high" | "medium" | "low" = "low"
    for (const account of allAccounts) {
      const rank = CONFIDENCE_RANK[account.confidence.overall] ?? 0
      if (rank > (CONFIDENCE_RANK[overallConfidence] ?? 0)) {
        overallConfidence = account.confidence.overall
      }
    }

    results.push({
      normalizedAccountNumber: normalizedAcctNum,
      displayAccountNumber: bestSource.account_number,
      bankName: bestSource.bank_name,
      bankAddress: bestSource.bank_address,
      accountType: bestSource.account_type,
      currency: bestSource.currency,
      allBalances,
      maxBalance,
      coverage: {
        monthsCovered,
        monthsMissing,
        isComplete: monthsMissing.length === 0,
        totalStatements: sourceStatements.length,
      },
      sourceStatements,
      overallConfidence,
      warnings: allWarnings,
      categorizedWarnings,
      foreignAccountId,
    })
  }

  return results
}
