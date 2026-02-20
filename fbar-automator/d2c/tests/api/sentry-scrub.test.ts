import { describe, it, expect } from "vitest";

// IMPLEMENTATION NEEDED: P3-9 will create d2c/src/lib/sentry.ts with:
//   export function scrubPii(event: SentryEvent): SentryEvent
// This is a pure function that scrubs SSN and account number patterns from
// Sentry error events before they are sent. Until that file exists, these
// tests will fail with an import error.
import { scrubPii, type SentryEvent } from "@/lib/sentry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<SentryEvent> = {}): SentryEvent {
  return {
    message: overrides.message ?? "Something went wrong",
    ...overrides,
  };
}

function makeExceptionEvent(value: string): SentryEvent {
  return {
    exception: {
      values: [
        {
          type: "Error",
          value,
        },
      ],
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("P3-9: Sentry PII scrubbing — SSN patterns", () => {
  it("P3-9: scrubs SSN in XXX-XX-XXXX format from event message", () => {
    const event = makeEvent({
      message: "Failed to validate TIN: 123-45-6789 is invalid",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).not.toContain("123-45-6789");
    expect(scrubbed.message).toContain("[SSN_REDACTED]");
  });

  it("P3-9: scrubs SSN in XXXXXXXXX (9-digit no dash) format from event message", () => {
    const event = makeEvent({
      message: "Decryption error for TIN 123456789",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).not.toContain("123456789");
    expect(scrubbed.message).toContain("[SSN_REDACTED]");
  });

  it("P3-9: scrubs multiple SSNs in the same message", () => {
    const event = makeEvent({
      message: "Mismatch: 111-22-3333 vs 444-55-6666",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).not.toContain("111-22-3333");
    expect(scrubbed.message).not.toContain("444-55-6666");
  });

  it("P3-9: scrubs SSN from exception value", () => {
    const event = makeExceptionEvent(
      "Invalid SSN format: 987-65-4321 does not match expected pattern"
    );

    const scrubbed = scrubPii(event);

    const exValue = scrubbed.exception?.values?.[0]?.value ?? "";
    expect(exValue).not.toContain("987-65-4321");
    expect(exValue).toContain("[SSN_REDACTED]");
  });
});

describe("P3-9: Sentry PII scrubbing — Account number patterns", () => {
  it("P3-9: scrubs account numbers (long digit sequences) from event message", () => {
    const event = makeEvent({
      message: "Account lookup failed for 12345678901234",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).not.toContain("12345678901234");
    expect(scrubbed.message).toContain("[ACCOUNT_REDACTED]");
  });

  it("P3-9: scrubs IBAN-like patterns from event message", () => {
    const event = makeEvent({
      message: "Failed to parse: DE89370400440532013000",
    });

    const scrubbed = scrubPii(event);

    // The IBAN should be scrubbed (either as account number or IBAN pattern)
    expect(scrubbed.message).not.toContain("DE89370400440532013000");
  });

  it("P3-9: scrubs account numbers from exception value", () => {
    const event = makeExceptionEvent(
      "Duplicate account: 9876543210123456 already exists"
    );

    const scrubbed = scrubPii(event);

    const exValue = scrubbed.exception?.values?.[0]?.value ?? "";
    expect(exValue).not.toContain("9876543210123456");
    expect(exValue).toContain("[ACCOUNT_REDACTED]");
  });
});

describe("P3-9: Sentry PII scrubbing — Non-PII passthrough", () => {
  it("P3-9: non-PII error messages pass through unchanged", () => {
    const event = makeEvent({
      message: "Database connection timeout after 30000ms",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).toBe("Database connection timeout after 30000ms");
  });

  it("P3-9: error messages with short numbers are not scrubbed", () => {
    // Numbers like status codes, ports, line numbers should NOT be scrubbed
    const event = makeEvent({
      message: "HTTP 500 on port 3000 at line 42",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).toBe("HTTP 500 on port 3000 at line 42");
  });

  it("P3-9: null/undefined messages are handled gracefully", () => {
    const event = makeEvent({ message: undefined });

    const scrubbed = scrubPii(event);

    // Should not throw — message stays undefined
    expect(scrubbed.message).toBeUndefined();
  });

  it("P3-9: event without exception or message passes through", () => {
    const event: SentryEvent = {
      extra: { requestId: "req-abc-123", statusCode: 404 },
    };

    const scrubbed = scrubPii(event);

    expect(scrubbed.extra).toEqual({ requestId: "req-abc-123", statusCode: 404 });
  });
});

describe("P3-9: Sentry PII scrubbing — Nested exception data", () => {
  it("P3-9: scrubs PII from multiple exception values", () => {
    const event: SentryEvent = {
      exception: {
        values: [
          {
            type: "ValidationError",
            value: "SSN 111-22-3333 failed checksum",
          },
          {
            type: "DatabaseError",
            value: "Duplicate key for account 55667788990011",
          },
        ],
      },
    };

    const scrubbed = scrubPii(event);

    const values = scrubbed.exception?.values ?? [];
    expect(values).toHaveLength(2);

    expect(values[0].value).not.toContain("111-22-3333");
    expect(values[0].value).toContain("[SSN_REDACTED]");

    expect(values[1].value).not.toContain("55667788990011");
    expect(values[1].value).toContain("[ACCOUNT_REDACTED]");
  });

  it("P3-9: scrubs PII from breadcrumb messages", () => {
    const event: SentryEvent = {
      message: "Request failed",
      breadcrumbs: [
        { message: "User submitted TIN: 222-33-4444" },
        { message: "Looked up account 11223344556677" },
        { message: "Response returned 200 OK" },
      ],
    };

    const scrubbed = scrubPii(event);

    const crumbs = scrubbed.breadcrumbs ?? [];
    expect(crumbs[0].message).not.toContain("222-33-4444");
    expect(crumbs[0].message).toContain("[SSN_REDACTED]");

    expect(crumbs[1].message).not.toContain("11223344556677");
    expect(crumbs[1].message).toContain("[ACCOUNT_REDACTED]");

    // Non-PII breadcrumb should be untouched
    expect(crumbs[2].message).toBe("Response returned 200 OK");
  });

  it("P3-9: handles exception with empty values array", () => {
    const event: SentryEvent = {
      exception: { values: [] },
    };

    const scrubbed = scrubPii(event);

    expect(scrubbed.exception?.values).toEqual([]);
  });

  it("P3-9: handles exception value with undefined value field", () => {
    const event: SentryEvent = {
      exception: {
        values: [
          {
            type: "Error",
            value: undefined,
          },
        ],
      },
    };

    const scrubbed = scrubPii(event);

    expect(scrubbed.exception?.values?.[0]?.value).toBeUndefined();
  });
});

describe("P3-9: Sentry PII scrubbing — Edge cases", () => {
  it("P3-9: preserves event structure (does not strip unknown fields)", () => {
    const event = makeEvent({
      message: "Error with SSN 999-88-7777",
      extra: {
        requestId: "req-xyz",
        userId: "usr_abc123",
      },
    });

    const scrubbed = scrubPii(event);

    // PII in message is scrubbed
    expect(scrubbed.message).not.toContain("999-88-7777");
    // Non-PII extra data is preserved
    expect(scrubbed.extra).toEqual({
      requestId: "req-xyz",
      userId: "usr_abc123",
    });
  });

  it("P3-9: does not false-positive on date strings", () => {
    const event = makeEvent({
      message: "Filing deadline: 2025-04-15 for year 2024",
    });

    const scrubbed = scrubPii(event);

    // Dates should not be treated as SSNs (different format: YYYY-MM-DD)
    expect(scrubbed.message).toBe("Filing deadline: 2025-04-15 for year 2024");
  });

  it("P3-9: does not false-positive on CUID/UUID strings", () => {
    const event = makeEvent({
      message: "Filing ID clq1abc2def3ghi not found",
    });

    const scrubbed = scrubPii(event);

    expect(scrubbed.message).toBe("Filing ID clq1abc2def3ghi not found");
  });
});
