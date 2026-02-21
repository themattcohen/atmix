import { describe, it, expect, beforeEach, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P3-2 will add a `validateSdtmConfig()` exported function
// to d2c/src/lib/sdtm.ts that throws if !isSandbox() && !process.env.SDTM_HOST_KEY.
// Until that function exists, these tests will fail with an import error.
import { validateSdtmConfig } from "@/lib/sdtm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Snapshot of env vars we manipulate, so we can restore them. */
let envSnapshot: Record<string, string | undefined>;

const SDTM_ENV_KEYS = [
  "SDTM_SANDBOX_MODE",
  "SDTM_HOST_KEY",
  "SDTM_HOST",
  "SDTM_PORT",
  "SDTM_USERNAME",
  "SDTM_PRIVATE_KEY_PATH",
] as const;

function snapshotEnv() {
  envSnapshot = {};
  for (const key of SDTM_ENV_KEYS) {
    envSnapshot[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of SDTM_ENV_KEYS) {
    if (envSnapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envSnapshot[key];
    }
  }
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  snapshotEnv();
});

afterEach(() => {
  restoreEnv();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("P3-2: SDTM startup config validation", () => {
  // ── Production mode (SDTM_SANDBOX_MODE=false) ─────────────────────────────

  it("P3-2: rejects startup when SDTM_SANDBOX_MODE=false and SDTM_HOST_KEY is missing", () => {
    process.env.SDTM_SANDBOX_MODE = "false";
    delete process.env.SDTM_HOST_KEY;

    expect(() => validateSdtmConfig()).toThrow(/SDTM_HOST_KEY/i);
  });

  it("P3-2: rejects startup when SDTM_SANDBOX_MODE=false and SDTM_HOST_KEY is empty string", () => {
    process.env.SDTM_SANDBOX_MODE = "false";
    process.env.SDTM_HOST_KEY = "";

    expect(() => validateSdtmConfig()).toThrow(/SDTM_HOST_KEY/i);
  });

  it("P3-2: accepts startup when SDTM_SANDBOX_MODE=false and SDTM_HOST_KEY is set", () => {
    process.env.SDTM_SANDBOX_MODE = "false";
    process.env.SDTM_HOST_KEY = "c3NoLXJzYSBBQUFBQjNOemFDMXljMkU=";
    process.env.SDTM_HOST = "sftp.fincen.gov";
    process.env.SDTM_PORT = "22";
    process.env.SDTM_USERNAME = "fbar-filer";

    expect(() => validateSdtmConfig()).not.toThrow();
  });

  // ── Sandbox mode (SDTM_SANDBOX_MODE=true) ─────────────────────────────────

  it("P3-2: accepts startup in sandbox mode even when SDTM_HOST_KEY is missing", () => {
    process.env.SDTM_SANDBOX_MODE = "true";
    delete process.env.SDTM_HOST_KEY;

    expect(() => validateSdtmConfig()).not.toThrow();
  });

  it("P3-2: accepts startup in sandbox mode even when all SDTM env vars are missing", () => {
    process.env.SDTM_SANDBOX_MODE = "true";
    delete process.env.SDTM_HOST_KEY;
    delete process.env.SDTM_HOST;
    delete process.env.SDTM_USERNAME;
    delete process.env.SDTM_PRIVATE_KEY_PATH;

    expect(() => validateSdtmConfig()).not.toThrow();
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("P3-2: treats missing SDTM_SANDBOX_MODE as non-sandbox (rejects without host key)", () => {
    // When SDTM_SANDBOX_MODE is not set, isSandbox() returns false
    // because process.env.SDTM_SANDBOX_MODE !== "true"
    delete process.env.SDTM_SANDBOX_MODE;
    delete process.env.SDTM_HOST_KEY;

    expect(() => validateSdtmConfig()).toThrow(/SDTM_HOST_KEY/i);
  });

  it("P3-2: treats SDTM_SANDBOX_MODE=TRUE (uppercase) as non-sandbox", () => {
    // isSandbox() checks === "true" (lowercase), so "TRUE" should NOT match
    process.env.SDTM_SANDBOX_MODE = "TRUE";
    delete process.env.SDTM_HOST_KEY;

    expect(() => validateSdtmConfig()).toThrow(/SDTM_HOST_KEY/i);
  });
});
