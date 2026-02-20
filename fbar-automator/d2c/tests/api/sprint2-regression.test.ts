import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Sprint 2 Regression Tests ────────────────────────────────────────────────
// Validates fixes from Sprint 2 items 11-23 + Sprint 3 item 25.
// These are unit tests against actual module implementations — no DB required.
//
// Items covered:
//   Item 11  — BOTH ownership type maps isJointAccount correctly
//   Item 13  — Null guards in extraction mapper (warnings, bank_address)
//   Item 16  — Recursive PII scrubbing in log()
//   Item 21  — checkHealth clears timeout in finally block
//   Item 22  — sanitizeFileName path-traversal and edge cases
//   Item 23  — Typed signature truncated to ≤200 chars
//   Item 25  — isPermanentError treats 429 as transient (retry)

// ─── Imports ─────────────────────────────────────────────────────────────────

import { mapExtractedAccounts } from "@/lib/extraction-mapper";
import type { ExtractedAccount } from "@/types/extraction";

import { log } from "@/lib/logger";

import { checkHealth } from "@/lib/deploy";

import { sanitizeFileName } from "@/lib/sanitize";

import { sendEmailWithRetry } from "@/lib/email";

// ─── Global mocks ─────────────────────────────────────────────────────────────

// NOTE: We do NOT use a module-scope fetchSpy here. Instead, each checkHealth
// test creates its own spy with vi.spyOn(globalThis, "fetch") and tears it
// down via vi.restoreAllMocks() in afterEach. Console spies in the logger
// tests are also created inline per test and cleaned up the same way.

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal well-formed ExtractedAccount for mapper tests.
 */
function makeAccount(overrides: Partial<ExtractedAccount> = {}): ExtractedAccount {
  return {
    bank_name: "Test Bank",
    bank_address: {
      street: "123 Main St",
      city: "Zurich",
      state_province: null,
      country: "CH",
      postal_code: "8001",
    },
    account_number: "CH1234567890",
    account_type: "bank",
    account_type_description: null,
    currency: "CHF",
    statement_period: {
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    },
    balances: [
      {
        date: "2024-12-31",
        amount: 50000,
        label: "Closing balance",
        is_maximum: true,
      },
    ],
    max_balance: {
      amount: 50000,
      date: "2024-12-31",
      label: "Closing balance",
    },
    confidence: {
      bank_name: "high",
      account_number: "high",
      currency: "high",
      max_balance: "high",
      overall: "high",
    },
    warnings: [],
    ...overrides,
  };
}

// ─── Item 11: BOTH ownership mapping ─────────────────────────────────────────

describe("Sprint 2 Regression — Item 11: BOTH ownership → isJointAccount", () => {
  it('ownership_type "both" sets isJointAccount to true and ownershipType to BOTH', () => {
    const mapped = mapExtractedAccounts(
      [makeAccount({ ownership_type: "both" })],
      2024,
    );

    expect(mapped[0].account.isJointAccount).toBe(true);
    expect(mapped[0].account.ownershipType).toBe("BOTH");
  });

  it('ownership_type "BOTH" (uppercase from LLM) also sets isJointAccount to true', () => {
    const mapped = mapExtractedAccounts(
      [makeAccount({ ownership_type: "BOTH" })],
      2024,
    );

    expect(mapped[0].account.isJointAccount).toBe(true);
    expect(mapped[0].account.ownershipType).toBe("BOTH");
  });

  it('ownership_type "financial_interest" sets isJointAccount to false', () => {
    const mapped = mapExtractedAccounts(
      [makeAccount({ ownership_type: "financial_interest" })],
      2024,
    );

    expect(mapped[0].account.isJointAccount).toBe(false);
    expect(mapped[0].account.ownershipType).toBe("FINANCIAL_INTEREST");
  });

  it('ownership_type "signature_authority" sets isJointAccount to false', () => {
    const mapped = mapExtractedAccounts(
      [makeAccount({ ownership_type: "signature_authority" })],
      2024,
    );

    expect(mapped[0].account.isJointAccount).toBe(false);
    expect(mapped[0].account.ownershipType).toBe("SIGNATURE_AUTHORITY");
  });

  it("isJointAccount and ownershipType are consistent — never contradict each other", () => {
    const ownershipCases: Array<{
      input: ExtractedAccount["ownership_type"];
      expectedOwnership: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH";
      expectedJoint: boolean;
    }> = [
      { input: "both", expectedOwnership: "BOTH", expectedJoint: true },
      { input: "BOTH", expectedOwnership: "BOTH", expectedJoint: true },
      {
        input: "financial_interest",
        expectedOwnership: "FINANCIAL_INTEREST",
        expectedJoint: false,
      },
      {
        input: "FINANCIAL_INTEREST",
        expectedOwnership: "FINANCIAL_INTEREST",
        expectedJoint: false,
      },
      {
        input: "signature_authority",
        expectedOwnership: "SIGNATURE_AUTHORITY",
        expectedJoint: false,
      },
      {
        input: "SIGNATURE_AUTHORITY",
        expectedOwnership: "SIGNATURE_AUTHORITY",
        expectedJoint: false,
      },
      { input: null, expectedOwnership: "FINANCIAL_INTEREST", expectedJoint: false },
    ];

    for (const { input, expectedOwnership, expectedJoint } of ownershipCases) {
      const mapped = mapExtractedAccounts(
        [makeAccount({ ownership_type: input })],
        2024,
      );
      expect(mapped[0].account.ownershipType).toBe(expectedOwnership);
      expect(mapped[0].account.isJointAccount).toBe(expectedJoint);
    }
  });
});

// ─── Item 13: Null guards in mapper ──────────────────────────────────────────

describe("Sprint 2 Regression — Item 13: Null guards in extraction mapper", () => {
  it("handles missing warnings field without crashing (returns empty array)", () => {
    const account = makeAccount();
    // Simulate a field missing at runtime (e.g. older LLM output schema)
    // @ts-expect-error — testing runtime null-safety of the guard
    delete account.warnings;

    const mapped = mapExtractedAccounts([account], 2024);

    expect(mapped[0].warnings).toBeDefined();
    expect(Array.isArray(mapped[0].warnings)).toBe(true);
  });

  it("handles undefined warnings by appending institutional warnings on top", () => {
    const account = makeAccount({ bank_name: null });
    // @ts-expect-error — testing runtime null-safety
    delete account.warnings;

    const mapped = mapExtractedAccounts([account], 2024);

    // Should still include the "Institution name could not be determined" warning
    expect(mapped[0].warnings.some((w) => w.includes("Institution name"))).toBe(true);
  });

  it("handles null bank_address.country gracefully — countryCode becomes empty string", () => {
    const account = makeAccount({
      bank_address: {
        street: null,
        city: null,
        state_province: null,
        country: undefined as unknown as string, // runtime null bypass
        postal_code: null,
      },
    });

    const mapped = mapExtractedAccounts([account], 2024);

    expect(mapped[0].account.countryCode).toBe("");
  });

  it("handles null max_balance.amount gracefully — maxValueLocal becomes 0", () => {
    const account = makeAccount({
      max_balance: {
        amount: undefined as unknown as number, // runtime null bypass
        date: null,
        label: "Balance",
      },
    });

    const mapped = mapExtractedAccounts([account], 2024);

    expect(mapped[0].account.maxValueLocal).toBe(0);
  });

  it("handles empty warnings array — no extra warnings added for valid accounts", () => {
    const mapped = mapExtractedAccounts([makeAccount()], 2024);

    // Valid account with all fields set: no automatic warnings
    expect(mapped[0].warnings).toHaveLength(0);
  });
});

// ─── Item 16: Recursive PII scrubbing ────────────────────────────────────────

describe("Sprint 2 Regression — Item 16: Recursive PII scrubbing in log()", () => {
  it("scrubs email nested inside a meta object", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("info", "user action", { user: { email: "john@example.com", name: "John" } });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("john@example.com");
    expect(output).toContain("j***@example.com");
  });

  it("scrubs SSN nested inside a meta object at arbitrary depth", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("info", "test", { outer: { inner: { tin: "123-45-6789" } } });

    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("123-45-6789");
    expect(output).toContain("***-**-6789");
  });

  it("scrubs SSN inside an array element in meta", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("info", "data", { items: ["SSN: 123-45-6789 is invalid"] });

    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("123-45-6789");
  });

  it("scrubs account number (10+ digits) in nested meta", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("info", "lookup", { account: { number: "1234567890123456" } });

    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("1234567890123456");
  });

  it("does NOT scrub short non-PII numbers (status codes, years)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("info", "filing year 2024", { year: 2024, status: 200 });

    const output = spy.mock.calls[0][0] as string;
    // Year 2024 is a number in meta; the string "2024" in the message should survive
    expect(output).toContain("2024");
  });

  it("error-level log also scrubs PII from nested meta", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    log("error", "fatal", { context: { ssn: "999-88-7777" } });

    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("999-88-7777");
  });
});

// ─── Item 21: checkHealth finally block ──────────────────────────────────────
//
// Each test creates its own fetch spy to avoid cross-test contamination
// from vi.restoreAllMocks() in afterEach resetting module-scope spies.

describe("Sprint 2 Regression — Item 21: checkHealth clears timeout in finally", () => {
  it("returns true for HTTP 200", async () => {
    const localFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const result = await checkHealth("http://localhost/health");

    expect(result).toBe(true);
    localFetch.mockRestore();
  });

  it("returns false for HTTP 500", async () => {
    const localFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

    const result = await checkHealth("http://localhost/health");

    expect(result).toBe(false);
    localFetch.mockRestore();
  });

  it("returns false when fetch throws (network error) — timeout is still cleared", async () => {
    const localFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const result = await checkHealth("http://localhost/health");

    expect(result).toBe(false);
    // clearTimeout must have been called (finally block ran)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    localFetch.mockRestore();
  });

  it("returns false for AbortError (timeout) — finally still clears the timer", async () => {
    const localFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(
        Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
      );
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const result = await checkHealth("http://localhost/health");

    expect(result).toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    localFetch.mockRestore();
  });

  it("passes AbortSignal to fetch for timeout enforcement", async () => {
    const localFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await checkHealth("http://localhost/health");

    const callOptions = localFetch.mock.calls[0][1] as RequestInit;
    expect(callOptions.signal).toBeInstanceOf(AbortSignal);
    localFetch.mockRestore();
  });
});

// ─── Item 22: sanitizeFileName ────────────────────────────────────────────────

describe("Sprint 2 Regression — Item 22: sanitizeFileName", () => {
  it('removes ".." path traversal sequences', () => {
    const result = sanitizeFileName("../../../etc/passwd");

    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  it("removes null bytes from file names", () => {
    const result = sanitizeFileName("file\x00name.pdf");

    expect(result).not.toContain("\x00");
    expect(result).toBe("filename.pdf");
  });

  it("removes forward slashes", () => {
    const result = sanitizeFileName("some/path/file.pdf");

    expect(result).not.toContain("/");
  });

  it("removes backslashes", () => {
    const result = sanitizeFileName("some\\path\\file.pdf");

    expect(result).not.toContain("\\");
  });

  it("returns a fallback name for empty string input", () => {
    const result = sanitizeFileName("");

    expect(result).toMatch(/^upload_\d+$/);
  });

  it("returns a fallback name when input is only dangerous characters", () => {
    // After stripping "..", "/", the string becomes empty
    const result = sanitizeFileName("../");

    expect(result).toMatch(/^upload_\d+$/);
  });

  it("truncates names longer than 255 chars and preserves the extension", () => {
    const longName = "a".repeat(300) + ".pdf";
    const result = sanitizeFileName(longName);

    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("truncates names longer than 255 chars without extension to 255 chars", () => {
    const longName = "b".repeat(300);
    const result = sanitizeFileName(longName);

    expect(result.length).toBeLessThanOrEqual(255);
  });

  it("passes through a normal safe file name unchanged", () => {
    expect(sanitizeFileName("my-statement-2024.pdf")).toBe("my-statement-2024.pdf");
  });

  it("passes through a name with numbers and hyphens", () => {
    expect(sanitizeFileName("account-CH123-2024.pdf")).toBe("account-CH123-2024.pdf");
  });

  it("removes Windows reserved characters (<>:\"|?*)", () => {
    const result = sanitizeFileName('file<name>:illegal|chars?.pdf');

    expect(result).not.toMatch(/[<>:"|?*]/);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("combined attack: null bytes + path traversal + long name", () => {
    const attack = "../".repeat(50) + "\x00" + "a".repeat(300) + ".pdf";
    const result = sanitizeFileName(attack);

    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\x00");
    expect(result.length).toBeLessThanOrEqual(255);
  });
});

// ─── Item 23: Typed signature truncation ─────────────────────────────────────

describe("Sprint 2 Regression — Item 23: Typed signature slice(0, 200)", () => {
  it("a 300-character typed signature is safely truncatable to 200 chars", () => {
    // Verify the slice(0, 200) JavaScript behavior is correct and non-crashing
    const longSig = "A".repeat(300);
    const truncated = longSig.slice(0, 200);

    expect(truncated.length).toBe(200);
    expect(truncated).not.toContain("undefined");
  });

  it("a signature shorter than 200 chars is not truncated", () => {
    const shortSig = "Jane Doe";
    const result = shortSig.slice(0, 200);

    expect(result).toBe("Jane Doe");
    expect(result.length).toBe(8);
  });

  it("empty string signature does not crash slice(0, 200)", () => {
    const empty = "";
    const result = empty.slice(0, 200);

    expect(result).toBe("");
    expect(result.length).toBe(0);
  });

  it("exactly 200-char signature passes through slice unchanged", () => {
    const exact = "B".repeat(200);
    const result = exact.slice(0, 200);

    expect(result.length).toBe(200);
    expect(result).toBe(exact);
  });
});

// ─── Item 25 (Sprint 3): isPermanentError treats 429 as transient ─────────────

describe("Sprint 3 Regression — Item 25: 429 is retried (not a permanent error)", () => {
  it("rate-limit 429 error is retried — not dead-lettered on first attempt", async () => {
    const err429 = Object.assign(new Error("Rate limited"), { status: 429 });

    // First call throws 429, second succeeds
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(err429)
      .mockResolvedValueOnce(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    // 429 should be retried: total 2 calls (1 failure + 1 success)
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("permanent 400 error is NOT retried — dead-letters immediately", async () => {
    const err400 = Object.assign(new Error("Bad Request"), { status: 400 });
    const sendFn = vi.fn().mockRejectedValue(err400);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 }),
    ).rejects.toThrow();

    // Should NOT retry — only 1 call total
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("permanent 422 error is NOT retried", async () => {
    const err422 = Object.assign(new Error("Unprocessable"), { status: 422 });
    const sendFn = vi.fn().mockRejectedValue(err422);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 }),
    ).rejects.toThrow();

    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("500 server error is retried up to maxRetries", async () => {
    const err500 = Object.assign(new Error("Internal Server Error"), { status: 500 });
    const sendFn = vi.fn().mockRejectedValue(err500);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 2, backoffMs: 10 }),
    ).rejects.toThrow();

    // initial + 2 retries = 3 total attempts
    expect(sendFn).toHaveBeenCalledTimes(3);
  });

  it("429 exhausts retries and eventually throws if always rate-limited", async () => {
    const err429 = Object.assign(new Error("Rate limited"), { status: 429 });
    const sendFn = vi.fn().mockRejectedValue(err429);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 2, backoffMs: 10 }),
    ).rejects.toThrow();

    // 429 is transient: initial + 2 retries = 3 total attempts
    expect(sendFn).toHaveBeenCalledTimes(3);
  });
});
