/**
 * Consolidates MappedAccount[] by grouping on normalized account number + currency.
 * Ported from B2B src/lib/consolidation.ts, adapted for D2C's MappedAccount type.
 *
 * Given 24 raw extractions (12 months × 2 accounts), returns 2 consolidated
 * accounts with balance history and structured notes (no raw LLM warnings).
 */

import type { MappedAccount, BalanceHistoryEntry, StructuredNote } from "@/lib/extraction-mapper";

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Strip spaces, dashes, dots, slashes and uppercase — same as B2B normalizeAccountNumber. */
function normalizeAccountNumber(num: string): string {
  return num.replace(/[\s\-./]/g, "").toUpperCase();
}

/** Format "2025-01-01" → "Jan 2025" */
function formatPeriodLabel(startDate: string): string {
  const d = new Date(startDate + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Sort key for chronological ordering: "YYYY-MM" from startDate */
function periodSortKey(startDate: string): string {
  return startDate.slice(0, 7); // "YYYY-MM"
}

const NO_ACTIVITY_RE = /no.*(activity|transaction)|opening and closing.*identical/i;
const CURRENCY_INFERRED_RE = /currency.*inferred/i;
const OWNERSHIP_RE = /ownership/i;

function buildStructuredNotes(
  group: MappedAccount[],
  bestConfidence: MappedAccount["confidence"]
): StructuredNote[] {
  const notes: StructuredNote[] = [];

  // Count no-activity entries
  let noActivityCount = 0;
  for (const entry of group) {
    for (const w of entry.warnings) {
      if (NO_ACTIVITY_RE.test(w)) {
        noActivityCount++;
        break; // one per entry max
      }
    }
  }
  if (noActivityCount > 0) {
    notes.push({
      type: "no_activity",
      message: `${noActivityCount} of ${group.length} statement periods showed no account activity`,
    });
  }

  // Currency inferred
  let inferredCurrency: string | null = null;
  for (const entry of group) {
    for (const w of entry.warnings) {
      if (CURRENCY_INFERRED_RE.test(w)) {
        inferredCurrency = entry.account.currencyCode || "unknown";
        break;
      }
    }
    if (inferredCurrency) break;
  }
  if (inferredCurrency) {
    notes.push({
      type: "currency_inferred",
      message: `Currency inferred as ${inferredCurrency}`,
    });
  }

  // Ownership defaulted
  let ownershipDefaulted = false;
  for (const entry of group) {
    for (const w of entry.warnings) {
      if (OWNERSHIP_RE.test(w)) {
        ownershipDefaulted = true;
        break;
      }
    }
    if (ownershipDefaulted) break;
  }
  if (ownershipDefaulted) {
    notes.push({
      type: "ownership_defaulted",
      message: "Ownership type could not be determined — defaulted to Financial Interest",
    });
  }

  // Low confidence
  if (bestConfidence?.overall === "low") {
    notes.push({
      type: "low_confidence",
      message: "Low extraction confidence — review all fields carefully",
    });
  }

  return notes;
}

function buildBalanceHistory(
  group: MappedAccount[],
  yearMax: number
): BalanceHistoryEntry[] {
  const entries: BalanceHistoryEntry[] = [];

  for (const entry of group) {
    if (!entry.statementPeriod || !entry.maxBalanceDetail) continue;

    entries.push({
      periodLabel: formatPeriodLabel(entry.statementPeriod.startDate),
      maxAmount: entry.maxBalanceDetail.amount,
      maxDate: entry.maxBalanceDetail.date,
      isYearMax: false,
      _sortKey: periodSortKey(entry.statementPeriod.startDate),
    } as BalanceHistoryEntry & { _sortKey: string });
  }

  // Sort chronologically
  entries.sort((a, b) =>
    ((a as any)._sortKey as string).localeCompare((b as any)._sortKey as string)
  );

  // Mark year-max entry (first one matching the consolidated max)
  let marked = false;
  for (const entry of entries) {
    if (!marked && entry.maxAmount === yearMax) {
      entry.isYearMax = true;
      marked = true;
    }
    delete (entry as any)._sortKey;
  }

  return entries;
}

export function consolidateExtractedAccounts(
  accounts: MappedAccount[]
): MappedAccount[] {
  if (accounts.length <= 1) return accounts;

  // Group by normalized account number + currency
  const groups = new Map<string, MappedAccount[]>();

  for (const mapped of accounts) {
    const acctNum = mapped.account.accountNumber;
    if (!acctNum || acctNum.trim() === "") {
      // Can't group without an account number — pass through as-is
      const key = `__ungrouped_${groups.size}`;
      groups.set(key, [mapped]);
      continue;
    }

    const key =
      normalizeAccountNumber(acctNum) + "|" + (mapped.account.currencyCode || "");
    const group = groups.get(key);
    if (group) {
      group.push(mapped);
    } else {
      groups.set(key, [mapped]);
    }
  }

  // Build consolidated accounts
  const results: MappedAccount[] = [];
  let sourceIndex = 0;

  for (const group of Array.from(groups.values())) {
    if (group.length === 1) {
      // Single entry — still build structured notes + balance history
      const entry = group[0];
      const structuredNotes = buildStructuredNotes(group, entry.confidence);
      const balanceHistory = buildBalanceHistory(group, entry.account.maxValueLocal);

      results.push({
        ...entry,
        sourceIndex,
        warnings: [],
        structuredNotes,
        balanceHistory,
      } as MappedAccount);
      sourceIndex++;
      continue;
    }

    // Pick metadata from the highest-confidence entry
    let best = group[0];
    for (let i = 1; i < group.length; i++) {
      const current = group[i];
      const bestRank = CONFIDENCE_RANK[best.confidence?.overall] ?? 0;
      const currentRank = CONFIDENCE_RANK[current.confidence?.overall] ?? 0;
      if (currentRank > bestRank) {
        best = current;
      }
    }

    // Max value across all entries in the group
    const maxValue = Math.max(...group.map((a: MappedAccount) => a.account.maxValueLocal ?? 0));

    // Best (highest) confidence
    let bestConfidence = group[0].confidence;
    for (const entry of group) {
      const entryRank = CONFIDENCE_RANK[entry.confidence?.overall] ?? 0;
      const bestRank = CONFIDENCE_RANK[bestConfidence?.overall] ?? 0;
      if (entryRank > bestRank) {
        bestConfidence = entry.confidence;
      }
    }

    const structuredNotes = buildStructuredNotes(group, bestConfidence);
    const balanceHistory = buildBalanceHistory(group, maxValue);

    results.push({
      account: {
        ...best.account,
        maxValueLocal: maxValue,
      },
      confidence: bestConfidence,
      warnings: [],
      sourceIndex,
      statementId: best.statementId,
      structuredNotes,
      balanceHistory,
    } as MappedAccount);

    sourceIndex++;
  }

  return results;
}
