import { describe, it, expect, vi, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P6-4 will create d2c/src/lib/deploy.ts with:
//   export function parseLastDeploy(content: string): {
//     tag: string;
//     timestamp: string;
//     commitHash: string;
//   };
//   export function isValidImageTag(tag: string): boolean;
//   export async function checkHealth(url: string): Promise<boolean>;
//
// These are pure helper functions extracted from scripts/rollback.sh so that
// the core logic is testable in Vitest. The bash script itself calls these
// via a thin Node wrapper or duplicates the logic — either way, these
// functions are the source of truth for parsing and validation.
//
// parseLastDeploy reads a .last-deploy file with format:
//   IMAGE_TAG=<tag>
//   TIMESTAMP=<ISO 8601>
//   COMMIT_HASH=<40-char hex>
//
// isValidImageTag checks that a tag matches expected Docker image tag patterns
// (e.g., "sha-abc1234", "v1.2.3", "latest").
//
// checkHealth fetches a URL and returns true for HTTP 200, false otherwise.
import { parseLastDeploy, isValidImageTag, checkHealth } from "@/lib/deploy";

// ─── Fetch Mock ─────────────────────────────────────────────────────────────

const fetchSpy = vi.spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a well-formed .last-deploy file content string.
 */
function makeLastDeployContent(overrides: {
  tag?: string;
  timestamp?: string;
  commitHash?: string;
} = {}): string {
  const tag = overrides.tag ?? "sha-abc1234";
  const timestamp = overrides.timestamp ?? "2026-02-19T10:30:00Z";
  const commitHash = overrides.commitHash ?? "a".repeat(40);
  return [
    `IMAGE_TAG=${tag}`,
    `TIMESTAMP=${timestamp}`,
    `COMMIT_HASH=${commitHash}`,
  ].join("\n");
}

// ─── Tests: parseLastDeploy — Happy Path ────────────────────────────────────

describe("P6-4: .last-deploy file parsing — happy path", () => {
  it("P6-4: parses a well-formed .last-deploy file into tag, timestamp, commitHash", () => {
    const content = makeLastDeployContent({
      tag: "sha-abc1234",
      timestamp: "2026-02-19T10:30:00Z",
      commitHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    });

    const result = parseLastDeploy(content);

    expect(result.tag).toBe("sha-abc1234");
    expect(result.timestamp).toBe("2026-02-19T10:30:00Z");
    expect(result.commitHash).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
  });

  it("P6-4: parses file with version-style tag", () => {
    const content = makeLastDeployContent({ tag: "v1.2.3" });

    const result = parseLastDeploy(content);

    expect(result.tag).toBe("v1.2.3");
  });

  it("P6-4: parses file with 'latest' tag", () => {
    const content = makeLastDeployContent({ tag: "latest" });

    const result = parseLastDeploy(content);

    expect(result.tag).toBe("latest");
  });

  it("P6-4: handles trailing newline in file content", () => {
    const content = makeLastDeployContent() + "\n";

    const result = parseLastDeploy(content);

    expect(result.tag).toBe("sha-abc1234");
    expect(result.commitHash).toBe("a".repeat(40));
  });

  it("P6-4: handles Windows-style line endings (CRLF)", () => {
    const content = [
      "IMAGE_TAG=sha-abc1234",
      "TIMESTAMP=2026-02-19T10:30:00Z",
      `COMMIT_HASH=${"b".repeat(40)}`,
    ].join("\r\n");

    const result = parseLastDeploy(content);

    expect(result.tag).toBe("sha-abc1234");
    expect(result.commitHash).toBe("b".repeat(40));
  });
});

// ─── Tests: parseLastDeploy — Error Cases ───────────────────────────────────

describe("P6-4: .last-deploy file parsing — error cases", () => {
  it("P6-4: throws or returns error for empty file content", () => {
    expect(() => parseLastDeploy("")).toThrow();
  });

  it("P6-4: throws or returns error when IMAGE_TAG line is missing", () => {
    const content = [
      "TIMESTAMP=2026-02-19T10:30:00Z",
      `COMMIT_HASH=${"a".repeat(40)}`,
    ].join("\n");

    expect(() => parseLastDeploy(content)).toThrow();
  });

  it("P6-4: throws or returns error when TIMESTAMP line is missing", () => {
    const content = [
      "IMAGE_TAG=sha-abc1234",
      `COMMIT_HASH=${"a".repeat(40)}`,
    ].join("\n");

    expect(() => parseLastDeploy(content)).toThrow();
  });

  it("P6-4: throws or returns error when COMMIT_HASH line is missing", () => {
    const content = [
      "IMAGE_TAG=sha-abc1234",
      "TIMESTAMP=2026-02-19T10:30:00Z",
    ].join("\n");

    expect(() => parseLastDeploy(content)).toThrow();
  });

  it("P6-4: throws for corrupted content (random garbage)", () => {
    expect(() => parseLastDeploy("not-a-valid-format")).toThrow();
  });

  it("P6-4: throws when IMAGE_TAG value is empty", () => {
    const content = [
      "IMAGE_TAG=",
      "TIMESTAMP=2026-02-19T10:30:00Z",
      `COMMIT_HASH=${"a".repeat(40)}`,
    ].join("\n");

    expect(() => parseLastDeploy(content)).toThrow();
  });
});

// ─── Tests: isValidImageTag ─────────────────────────────────────────────────

describe("P6-4: Image tag validation", () => {
  it("P6-4: accepts sha-prefixed tags (e.g. sha-abc1234)", () => {
    expect(isValidImageTag("sha-abc1234")).toBe(true);
  });

  it("P6-4: accepts semver tags (e.g. v1.2.3)", () => {
    expect(isValidImageTag("v1.2.3")).toBe(true);
  });

  it("P6-4: accepts 'latest' tag", () => {
    expect(isValidImageTag("latest")).toBe(true);
  });

  it("P6-4: accepts tags with dots and hyphens (e.g. v1.2.3-beta.1)", () => {
    expect(isValidImageTag("v1.2.3-beta.1")).toBe(true);
  });

  it("P6-4: rejects empty string", () => {
    expect(isValidImageTag("")).toBe(false);
  });

  it("P6-4: rejects tags with spaces", () => {
    expect(isValidImageTag("sha abc1234")).toBe(false);
  });

  it("P6-4: rejects tags with special characters (shell injection vectors)", () => {
    expect(isValidImageTag("$(rm -rf /)")).toBe(false);
    expect(isValidImageTag("tag;echo pwned")).toBe(false);
    expect(isValidImageTag("tag`whoami`")).toBe(false);
  });

  it("P6-4: rejects tags containing path traversal", () => {
    expect(isValidImageTag("../../../etc/passwd")).toBe(false);
  });

  it("P6-4: rejects excessively long tags (>128 chars)", () => {
    expect(isValidImageTag("a".repeat(129))).toBe(false);
  });
});

// ─── Tests: checkHealth — HTTP 200 ──────────────────────────────────────────

describe("P6-4: Health check — success", () => {
  it("P6-4: returns true for HTTP 200 response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("OK", { status: 200 })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/health",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("P6-4: returns true for HTTP 200 regardless of body content", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{"status":"healthy"}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(true);
  });
});

// ─── Tests: checkHealth — Failure Cases ─────────────────────────────────────

describe("P6-4: Health check — failure cases", () => {
  it("P6-4: returns false for HTTP 500 response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(false);
  });

  it("P6-4: returns false for HTTP 503 response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(false);
  });

  it("P6-4: returns false for HTTP 404 response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Not Found", { status: 404 })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(false);
  });

  it("P6-4: returns false for network error (fetch rejects)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(false);
  });

  it("P6-4: returns false for timeout (AbortError)", async () => {
    fetchSpy.mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      })
    );

    const result = await checkHealth("http://localhost:3001/api/health");

    expect(result).toBe(false);
  });

  it("P6-4: returns false for DNS resolution failure", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));

    const result = await checkHealth("http://nonexistent.invalid/health");

    expect(result).toBe(false);
  });
});

// ─── Tests: checkHealth — Timeout Behavior ──────────────────────────────────

describe("P6-4: Health check — timeout handling", () => {
  it("P6-4: passes an AbortSignal to fetch for timeout enforcement", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("OK", { status: 200 })
    );

    await checkHealth("http://localhost:3001/api/health");

    // Verify that an AbortSignal was passed (timeout enforcement)
    const callArgs = fetchSpy.mock.calls[0];
    const options = callArgs[1] as RequestInit;
    expect(options.signal).toBeDefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

// ─── Tests: Integration — parseLastDeploy + isValidImageTag ─────────────────

describe("P6-4: Rollback flow — parse then validate", () => {
  it("P6-4: parsed tag from .last-deploy passes validation", () => {
    const content = makeLastDeployContent({ tag: "sha-abc1234" });

    const { tag } = parseLastDeploy(content);

    expect(isValidImageTag(tag)).toBe(true);
  });

  it("P6-4: invalid tag caught by validation after parsing", () => {
    // Simulate a manually corrupted .last-deploy (tag has shell chars)
    // parseLastDeploy should still parse it (it reads the file), but
    // isValidImageTag should reject it before it's used in a shell command.
    const content = [
      "IMAGE_TAG=$(echo pwned)",
      "TIMESTAMP=2026-02-19T10:30:00Z",
      `COMMIT_HASH=${"a".repeat(40)}`,
    ].join("\n");

    // This may throw during parse (if validation is built-in) or succeed
    // and fail at the validation step. Either behavior is acceptable:
    try {
      const { tag } = parseLastDeploy(content);
      expect(isValidImageTag(tag)).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
