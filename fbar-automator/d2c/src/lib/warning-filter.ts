/**
 * Filters and deduplicates extraction warnings before returning to client.
 * Raw warnings are preserved in the DB (rawExtraction / extractedAccounts).
 * This only affects what the user sees in the UI.
 */

const SUPPRESS_PATTERNS = [
  /max value updated from/i,
  /maximum balance (determined|identified)/i,
  /ownership type (cannot|could not|not explicitly|not indicated|defaulting to)/i,
];

const DEDUP_PATTERNS = [
  /currency .* inferred/i,
];

export function deduplicateWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const warning of warnings) {
    // Strip "Account N: " prefix for pattern matching
    const text = warning.replace(/^Account \d+:\s*/, "");

    // Suppress entirely
    if (SUPPRESS_PATTERNS.some((p) => p.test(text))) continue;

    // Deduplicate by pattern — keep first occurrence
    const dedupKey = DEDUP_PATTERNS.find((p) => p.test(text));
    if (dedupKey) {
      const key = dedupKey.source;
      if (seen.has(key)) continue;
      seen.add(key);
    }

    result.push(warning);
  }

  return result;
}
