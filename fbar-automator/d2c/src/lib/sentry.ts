/**
 * Sentry PII scrubbing utilities.
 *
 * scrubPii() is used as a Sentry beforeSend hook to strip SSNs and account
 * numbers from error events before they leave the server.
 *
 * Regex ordering matters:
 *   1. SSN with dashes (XXX-XX-XXXX) — applied first so the 9-digit no-dash
 *      rule does not catch the digit pairs inside a dashed SSN.
 *   2. SSN without dashes (exactly 9 consecutive digits with word boundaries).
 *   3. Account numbers (10+ consecutive digits with word boundaries).
 *   4. IBAN patterns (CC + digits/alphanum, 12-34 chars total).
 */

export interface SentryEvent {
  message?: string;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          function?: string;
          context_line?: string;
        }>;
      };
    }>;
  };
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
  }>;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

// SSN in XXX-XX-XXXX format.
// Does NOT match YYYY-MM-DD dates because those start with 4 digits, not 3.
const RE_SSN_DASHES = /\b\d{3}-\d{2}-\d{4}\b/g;

// SSN as 9 consecutive digits (no dashes).
// \b ensures it does not match a substring of a longer digit sequence
// or an alphanumeric CUID (word boundary stops at alpha chars).
const RE_SSN_DIGITS = /\b\d{9}\b/g;

// Account numbers: 10 or more consecutive digits.
const RE_ACCOUNT_DIGITS = /\b\d{10,}\b/g;

// IBAN: 2 uppercase letters + 2 digits + 8-30 alphanumeric chars.
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{8,30}\b/g;

/**
 * Scrub a single string value, replacing PII patterns.
 * Returns the original value if it is not a string.
 */
function scrubString(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;

  return value
    // 1. SSN with dashes first (prevent the 9-digit rule from partially
    //    matching the middle portion of a dashed SSN).
    .replace(RE_SSN_DASHES, "[SSN_REDACTED]")
    // 2. SSN without dashes (exactly 9 digits).
    .replace(RE_SSN_DIGITS, "[SSN_REDACTED]")
    // 3. Account numbers (10+ digits).
    .replace(RE_ACCOUNT_DIGITS, "[ACCOUNT_REDACTED]")
    // 4. IBAN-style patterns.
    .replace(RE_IBAN, "[ACCOUNT_REDACTED]");
}

/**
 * Sentry beforeSend hook — scrubs SSN and account number patterns from:
 *   - event.message
 *   - event.exception.values[].value
 *   - event.breadcrumbs[].message
 *
 * All other fields are left untouched. The function never throws.
 */
export function scrubPii(event: SentryEvent): SentryEvent {
  // Clone shallowly so we do not mutate the original.
  const result: SentryEvent = { ...event };

  // Scrub top-level message.
  if (result.message !== undefined) {
    result.message = scrubString(result.message);
  }

  // Scrub exception values.
  if (result.exception?.values) {
    result.exception = {
      ...result.exception,
      values: result.exception.values.map((ev) => {
        if (ev.value === undefined) return ev;
        return { ...ev, value: scrubString(ev.value) };
      }),
    };
  }

  // Scrub breadcrumb messages.
  if (result.breadcrumbs) {
    result.breadcrumbs = result.breadcrumbs.map((crumb) => {
      if (crumb.message === undefined) return crumb;
      return { ...crumb, message: scrubString(crumb.message) };
    });
  }

  return result;
}
