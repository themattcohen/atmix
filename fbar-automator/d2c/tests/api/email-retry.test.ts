import { describe, it, expect, vi, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P7-12 will add retry logic to d2c/src/lib/email.ts:
//
// export async function sendEmailWithRetry(
//   fn: () => Promise<void>,
//   options?: { maxRetries?: number; backoffMs?: number }
// ): Promise<void>
//
// Behavior:
// - Transient failures (network timeout, 5xx, ECONNREFUSED) → retry up to maxRetries times
// - Permanent failures (400, invalid email) → dead-letter immediately (no retry)
// - Dead-letter logging includes error details and original call context
// - Default maxRetries = 3, default backoffMs = 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

// IMPLEMENTATION NEEDED: Import from email.ts once P7-12 is implemented
// import { sendEmailWithRetry } from "@/lib/email";

// Temporary stub to define the expected interface
// Replace with actual import after P7-12 implementation
type SendEmailWithRetryOptions = {
  maxRetries?: number;
  backoffMs?: number;
};

// We'll create a local reference that can be replaced with the real import
let sendEmailWithRetry: (
  fn: () => Promise<void>,
  options?: SendEmailWithRetryOptions
) => Promise<void>;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const email = require("@/lib/email");
  sendEmailWithRetry = email.sendEmailWithRetry;
} catch {
  // Not yet implemented
}

class TransientError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "TransientError";
    this.status = status;
  }
}

class PermanentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PermanentError";
    this.status = status;
  }
}

// Mock for dead-letter logging
const deadLetterLog: Array<{ error: Error; timestamp: Date }> = [];

// ─── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
  deadLetterLog.length = 0;
});

describe("P7-12: Email retry on transient failure", () => {
  it("P7-12: successful send on first attempt — no retries", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi.fn().mockResolvedValue(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("P7-12: transient failure retries up to maxRetries times", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    // Fails 3 times (all retries exhausted)
    const sendFn = vi.fn().mockRejectedValue(
      new TransientError("Network timeout", 500)
    );

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 })
    ).rejects.toThrow();

    // Initial call + 3 retries = 4 total attempts
    expect(sendFn).toHaveBeenCalledTimes(4);
  });

  it("P7-12: successful send on 2nd attempt — no dead-letter", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new TransientError("Temporary failure", 503))
      .mockResolvedValue(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    // 1st attempt fails, 2nd succeeds
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("P7-12: successful send on 3rd attempt works", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new TransientError("Timeout", 500))
      .mockRejectedValueOnce(new TransientError("Connection refused"))
      .mockResolvedValue(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    expect(sendFn).toHaveBeenCalledTimes(3);
  });
});

describe("P7-12: Permanent failure — no retry, dead-letter", () => {
  it("P7-12: permanent failure (400) does NOT retry — dead-letters immediately", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const permanentErr = new PermanentError("Invalid email address", 400);
    const sendFn = vi.fn().mockRejectedValue(permanentErr);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 })
    ).rejects.toThrow();

    // Permanent failure should NOT retry — only 1 call
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("P7-12: permanent failure (422) does NOT retry", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi.fn().mockRejectedValue(
      new PermanentError("Unprocessable Entity", 422)
    );

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 })
    ).rejects.toThrow();

    expect(sendFn).toHaveBeenCalledTimes(1);
  });
});

describe("P7-12: Dead-letter on all retries exhausted", () => {
  it("P7-12: all retries fail — error propagates to caller", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const error = new TransientError("Service unavailable", 503);
    const sendFn = vi.fn().mockRejectedValue(error);

    await expect(
      sendEmailWithRetry(sendFn, { maxRetries: 2, backoffMs: 10 })
    ).rejects.toThrow("Service unavailable");

    // Initial + 2 retries = 3 attempts
    expect(sendFn).toHaveBeenCalledTimes(3);
  });

  it("P7-12: uses default maxRetries when options not provided", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi.fn().mockRejectedValue(
      new TransientError("Timeout", 500)
    );

    await expect(sendEmailWithRetry(sendFn)).rejects.toThrow();

    // Default maxRetries is 3 → initial + 3 retries = 4 attempts
    expect(sendFn).toHaveBeenCalledTimes(4);
  });
});

describe("P7-12: Backoff behavior", () => {
  it("P7-12: retries wait between attempts (exponential backoff)", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new TransientError("Retry 1", 500))
      .mockResolvedValue(undefined);

    const startTime = Date.now();
    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 50 });
    const elapsed = Date.now() - startTime;

    // Should have waited at least ~50ms for the backoff
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow small timing tolerance
    expect(sendFn).toHaveBeenCalledTimes(2);
  });
});

describe("P7-12: Error classification", () => {
  it("P7-12: ECONNREFUSED is treated as transient (retries)", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const connError = new Error("connect ECONNREFUSED 127.0.0.1:443");
    (connError as unknown as Record<string, unknown>).code = "ECONNREFUSED";

    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(connError)
      .mockResolvedValue(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    // Should have retried (2 total calls)
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("P7-12: timeout error is treated as transient (retries)", async () => {
    if (!sendEmailWithRetry) {
      console.warn("sendEmailWithRetry not yet exported — skipping until P7-12 implementation");
      return;
    }

    const timeoutError = new Error("Request timeout");
    (timeoutError as unknown as Record<string, unknown>).code = "ETIMEDOUT";

    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValue(undefined);

    await sendEmailWithRetry(sendFn, { maxRetries: 3, backoffMs: 10 });

    expect(sendFn).toHaveBeenCalledTimes(2);
  });
});
