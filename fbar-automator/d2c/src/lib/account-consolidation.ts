/**
 * Consolidates MappedAccount[] by grouping on normalized account number + currency.
 * Ported from B2B src/lib/consolidation.ts, adapted for D2C's MappedAccount type.
 *
 * Given 24 raw extractions (12 months × 2 accounts), returns 2 consolidated
 * accounts with the correct year-high max values and deduplicated warnings.
 */

import type { MappedAccount } from "@/lib/extraction-mapper";

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Strip spaces, dashes, dots, slashes and uppercase — same as B2B normalizeAccountNumber. */
function normalizeAccountNumber(num: string): string {
  return num.replace(/[\s\-./]/g, "").toUpperCase();
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
      results.push({ ...group[0], sourceIndex });
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

    // Deduplicate warnings — collapse "no activity" variants into one summary
    const uniqueWarnings: string[] = [];
    const noActivityMonths: string[] = [];

    for (const entry of group) {
      for (const w of entry.warnings) {
        const lower = w.toLowerCase();

        // Collapse "no activity" variants
        if (
          lower.includes("no account activity") ||
          lower.includes("no activity during") ||
          lower.includes("no transaction activity") ||
          (lower.includes("opening and closing balances") &&
            lower.includes("identical"))
        ) {
          // We don't have statement_period on MappedAccount, so just track that
          // there were no-activity warnings without duplicating them
          if (noActivityMonths.length === 0) {
            noActivityMonths.push("detected");
          }
          continue;
        }

        // Skip "max value updated" noise
        if (lower.includes("max value updated from")) continue;

        // Keep unique warnings only
        if (!uniqueWarnings.includes(w)) {
          uniqueWarnings.push(w);
        }
      }
    }

    if (noActivityMonths.length > 0) {
      uniqueWarnings.push(
        "Some statement periods showed no account activity (opening and closing balances were identical)."
      );
    }

    results.push({
      account: {
        ...best.account,
        maxValueLocal: maxValue,
      },
      confidence: bestConfidence,
      warnings: uniqueWarnings,
      sourceIndex,
    });

    sourceIndex++;
  }

  return results;
}
