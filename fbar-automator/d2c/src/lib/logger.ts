// src/lib/logger.ts — Structured JSON logger with PII scrubbing

const PII_PATTERNS: [RegExp, (...args: string[]) => string][] = [
  // SSN: XXX-XX-XXXX (dashed format)
  [
    /\b(\d{3})-(\d{2})-(\d{4})\b/g,
    (_match, _p1, _p2, p3) => `***-**-${p3}`,
  ],
  // SSN: 9 consecutive digits not adjacent to other alphanumerics
  [
    /(?<![a-zA-Z0-9])(\d{5})(\d{4})(?![a-zA-Z0-9])/g,
    (_match, _p1, p2) => `*****${p2}`,
  ],
  // IBAN: 2 uppercase letters + 2 digits + 8+ alphanumerics (keep last 4)
  [
    /\b[A-Z]{2}\d{2}[A-Za-z0-9]{8,}([A-Za-z0-9]{4})\b/g,
    (_match, last4) => `****${last4}`,
  ],
  // Long digit sequences: 10+ digits (account numbers) — keep last 4
  [
    /(?<![a-zA-Z0-9])\d{6,}(\d{4})(?![a-zA-Z0-9])/g,
    (_match, last4) => `****${last4}`,
  ],
  // Email addresses: keep first char + mask + @domain
  [
    /\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    (_match, first, domain) => `${first}***@${domain}`,
  ],
];

function scrubPii(value: string): string {
  let result = value;
  for (const [pattern, replacer] of PII_PATTERNS) {
    // Reset regex lastIndex since we reuse global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacer);
  }
  return result;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return scrubPii(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value !== null && typeof value === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      scrubbed[key] = scrubValue(val);
    }
    return scrubbed;
  }
  return value;
}

export function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const scrubbedMeta = meta ? scrubValue(meta) as Record<string, unknown> : {};

  // Core fields CANNOT be overwritten by meta
  const entry = {
    ...scrubbedMeta,
    timestamp: new Date().toISOString(),
    level,
    message: scrubPii(message),
  };

  const json = JSON.stringify(entry);
  if (level === "error") {
    console.error(json);
  } else {
    console.log(json);
  }
}
