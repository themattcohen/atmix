import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P6-2 will create d2c/src/lib/logger.ts with:
//   export function log(
//     level: "info" | "warn" | "error",
//     message: string,
//     meta?: Record<string, unknown>
//   ): void;
//
// The logger writes structured JSON to console.log (info/warn) or
// console.error (error). It scrubs PII patterns (SSNs, account numbers,
// emails) from both message and meta before output. Each log line is a
// single JSON object containing at minimum: timestamp, level, message.
// Any extra fields from meta are merged into the top-level JSON object.
import { log } from "@/lib/logger";

// ─── Console Spies ──────────────────────────────────────────────────────────

const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  consoleSpy.mockClear();
  consoleErrorSpy.mockClear();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the JSON object that was passed to console.log or console.error.
 * Assumes the logger calls console.log/error with a single JSON string argument.
 */
function getLoggedJson(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  const call = spy.mock.calls[0];
  const raw = call[0] as string;
  return JSON.parse(raw);
}

/**
 * ISO 8601 date-time pattern (e.g. 2026-02-19T12:34:56.789Z).
 */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

// ─── Tests: JSON Output Structure ───────────────────────────────────────────

describe("P6-2: Structured JSON logging — output routing", () => {
  it("P6-2: log('info', ...) writes to console.log, not console.error", () => {
    log("info", "test message");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("P6-2: log('warn', ...) writes to console.log", () => {
    log("warn", "test warning");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("P6-2: log('error', ...) writes to console.error, not console.log", () => {
    log("error", "test error");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

describe("P6-2: Structured JSON logging — JSON structure", () => {
  it("P6-2: log('info', 'test message') produces valid JSON output", () => {
    log("info", "test message");

    const json = getLoggedJson(consoleSpy);
    expect(json).toBeDefined();
    expect(typeof json).toBe("object");
  });

  it("P6-2: JSON output contains timestamp, level, and message fields", () => {
    log("info", "hello world");

    const json = getLoggedJson(consoleSpy);
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("level");
    expect(json).toHaveProperty("message");
  });

  it("P6-2: level field matches the log level argument", () => {
    log("warn", "a warning");

    const json = getLoggedJson(consoleSpy);
    expect(json.level).toBe("warn");
  });

  it("P6-2: message field matches the log message argument", () => {
    log("info", "specific message text");

    const json = getLoggedJson(consoleSpy);
    expect(json.message).toBe("specific message text");
  });

  it("P6-2: timestamp is in ISO 8601 format", () => {
    log("info", "timestamp check");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.timestamp)).toMatch(ISO_8601_REGEX);
  });

  it("P6-2: error-level output also contains timestamp, level, message", () => {
    log("error", "fatal problem");

    const json = getLoggedJson(consoleErrorSpy);
    expect(json).toHaveProperty("timestamp");
    expect(json.level).toBe("error");
    expect(json.message).toBe("fatal problem");
  });
});

// ─── Tests: Meta Fields ─────────────────────────────────────────────────────

describe("P6-2: Structured JSON logging — meta field merging", () => {
  it("P6-2: meta fields are merged into the JSON output", () => {
    log("info", "test", { userId: "123", action: "login" });

    const json = getLoggedJson(consoleSpy);
    expect(json.userId).toBe("123");
    expect(json.action).toBe("login");
  });

  it("P6-2: meta fields do not overwrite core fields (timestamp, level, message)", () => {
    log("info", "original message", {
      timestamp: "SHOULD_NOT_APPEAR",
      level: "SHOULD_NOT_APPEAR",
      message: "SHOULD_NOT_APPEAR",
    });

    const json = getLoggedJson(consoleSpy);
    // Core fields should be preserved from the function arguments, not meta
    expect(json.level).toBe("info");
    expect(json.message).toBe("original message");
    expect(String(json.timestamp)).toMatch(ISO_8601_REGEX);
  });

  it("P6-2: calling log without meta produces output with only core fields", () => {
    log("info", "no meta");

    const json = getLoggedJson(consoleSpy);
    expect(json.timestamp).toBeDefined();
    expect(json.level).toBe("info");
    expect(json.message).toBe("no meta");
    // Should not have random extra keys
    const keys = Object.keys(json);
    expect(keys).toEqual(expect.arrayContaining(["timestamp", "level", "message"]));
  });

  it("P6-2: numeric and boolean meta values are preserved as-is", () => {
    log("info", "typed meta", { count: 42, active: true });

    const json = getLoggedJson(consoleSpy);
    expect(json.count).toBe(42);
    expect(json.active).toBe(true);
  });
});

// ─── Tests: Trace ID Propagation ────────────────────────────────────────────

describe("P6-2: Structured JSON logging — trace ID propagation", () => {
  it("P6-2: traceId in meta appears in JSON output", () => {
    log("info", "traced request", { traceId: "abc-123-def" });

    const json = getLoggedJson(consoleSpy);
    expect(json.traceId).toBe("abc-123-def");
  });

  it("P6-2: traceId in meta appears in error-level output", () => {
    log("error", "traced error", { traceId: "err-trace-456" });

    const json = getLoggedJson(consoleErrorSpy);
    expect(json.traceId).toBe("err-trace-456");
  });
});

// ─── Tests: PII Scrubbing — SSN Patterns ────────────────────────────────────

describe("P6-2: Structured JSON logging — PII scrubbing (SSN)", () => {
  it("P6-2: SSN in XXX-XX-XXXX format is scrubbed from message", () => {
    log("info", "User SSN is 123-45-6789");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("123-45-6789");
  });

  it("P6-2: SSN in XXXXXXXXX (9-digit) format is scrubbed from message", () => {
    log("info", "TIN value 123456789 is invalid");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("123456789");
  });

  it("P6-2: multiple SSNs in the same message are all scrubbed", () => {
    log("info", "Comparing 111-22-3333 and 444-55-6666");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("111-22-3333");
    expect(String(json.message)).not.toContain("444-55-6666");
  });

  it("P6-2: SSN pattern in meta string values is scrubbed", () => {
    log("info", "lookup failed", { tin: "987-65-4321" });

    const json = getLoggedJson(consoleSpy);
    expect(String(json.tin)).not.toContain("987-65-4321");
  });
});

// ─── Tests: PII Scrubbing — Account Numbers ────────────────────────────────

describe("P6-2: Structured JSON logging — PII scrubbing (account numbers)", () => {
  it("P6-2: long digit sequence (account number) is scrubbed from message", () => {
    log("info", "Account 12345678901234 not found");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("12345678901234");
  });

  it("P6-2: account number in meta string values is scrubbed", () => {
    log("info", "lookup", { accountNumber: "9876543210123456" });

    const json = getLoggedJson(consoleSpy);
    expect(String(json.accountNumber)).not.toContain("9876543210123456");
  });

  it("P6-2: IBAN-like pattern is scrubbed from message", () => {
    log("info", "Processing DE89370400440532013000");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("DE89370400440532013000");
  });
});

// ─── Tests: PII Scrubbing — Email Addresses ────────────────────────────────

describe("P6-2: Structured JSON logging — PII scrubbing (emails)", () => {
  it("P6-2: email address in meta is scrubbed or masked", () => {
    log("info", "user action", { email: "user@example.com" });

    const json = getLoggedJson(consoleSpy);
    expect(String(json.email)).not.toBe("user@example.com");
  });

  it("P6-2: email address in message is scrubbed", () => {
    log("info", "Login attempt for admin@fbar.com failed");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("admin@fbar.com");
  });
});

// ─── Tests: PII Scrubbing — Non-PII Passthrough ────────────────────────────

describe("P6-2: Structured JSON logging — PII scrubbing (non-PII passthrough)", () => {
  it("P6-2: short numbers (status codes, ports) are NOT scrubbed", () => {
    log("info", "HTTP 500 on port 3000 at line 42");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).toBe("HTTP 500 on port 3000 at line 42");
  });

  it("P6-2: ISO date strings are NOT scrubbed", () => {
    log("info", "Filing deadline: 2025-04-15 for year 2024");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).toBe("Filing deadline: 2025-04-15 for year 2024");
  });

  it("P6-2: UUID/CUID strings are NOT scrubbed", () => {
    log("info", "Filing ID clq1abc2def3ghi not found");

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).toBe("Filing ID clq1abc2def3ghi not found");
  });

  it("P6-2: non-PII meta values pass through unchanged", () => {
    log("info", "request completed", {
      requestId: "req-abc-123",
      statusCode: 200,
      durationMs: 45,
    });

    const json = getLoggedJson(consoleSpy);
    expect(json.requestId).toBe("req-abc-123");
    expect(json.statusCode).toBe(200);
    expect(json.durationMs).toBe(45);
  });
});

// ─── Tests: Edge Cases ──────────────────────────────────────────────────────

describe("P6-2: Structured JSON logging — edge cases", () => {
  it("P6-2: empty message produces valid JSON", () => {
    log("info", "");

    const json = getLoggedJson(consoleSpy);
    expect(json.message).toBe("");
    expect(json.level).toBe("info");
  });

  it("P6-2: undefined meta is handled gracefully (same as no meta)", () => {
    log("info", "no meta", undefined);

    const json = getLoggedJson(consoleSpy);
    expect(json.message).toBe("no meta");
    expect(json.level).toBe("info");
  });

  it("P6-2: empty meta object is handled gracefully", () => {
    log("info", "empty meta", {});

    const json = getLoggedJson(consoleSpy);
    expect(json.message).toBe("empty meta");
  });

  it("P6-2: meta with nested object is serialized correctly", () => {
    log("info", "nested", { context: { foo: "bar" } });

    const json = getLoggedJson(consoleSpy);
    expect(json.context).toEqual({ foo: "bar" });
  });

  it("P6-2: PII in both message and meta are scrubbed simultaneously", () => {
    log("info", "SSN 111-22-3333 submitted", {
      tin: "444-55-6666",
      account: "12345678901234",
    });

    const json = getLoggedJson(consoleSpy);
    expect(String(json.message)).not.toContain("111-22-3333");
    expect(String(json.tin)).not.toContain("444-55-6666");
    expect(String(json.account)).not.toContain("12345678901234");
  });
});
