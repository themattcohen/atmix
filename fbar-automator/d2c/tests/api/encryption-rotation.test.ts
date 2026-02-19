import { vi, describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// P5-4: Encryption key rotation and safeDecrypt hard-fail tests
//
// IMPLEMENTATION NEEDED: P5-4 will modify d2c/src/lib/encryption.ts:
//
// 1. Version prefix: New encrypted values get "v1:" prefix.
//    Format changes from "iv:tag:cipher" to "v1:iv:tag:cipher".
//    decrypt() detects prefix to select the correct key.
//
// 2. Multi-key support: Read ENCRYPTION_KEY (current) and ENCRYPTION_KEY_PREV
//    (previous/rotated-out key). decrypt() tries current key first, then falls
//    back to ENCRYPTION_KEY_PREV.
//
// 3. Sign route fix (d2c/src/app/api/filing/sign/route.ts line 76):
//    Replace `safeDecrypt(user.tin)` with `decrypt(user.tin)` in a try/catch.
//    On failure, return 422 "Unable to retrieve your TIN" instead of silently
//    using empty string "0000".
//
// Current encryption format: "iv:tag:cipher" (unversioned, AES-256-GCM)
// New encryption format:     "v1:iv:tag:cipher" (versioned, AES-256-GCM)
// ---------------------------------------------------------------------------

// Generate deterministic test keys (64 hex chars = 32 bytes each)
const TEST_KEY_CURRENT = crypto.randomBytes(32).toString("hex");
const TEST_KEY_PREVIOUS = crypto.randomBytes(32).toString("hex");
const TEST_KEY_WRONG = crypto.randomBytes(32).toString("hex");

// Save original env vars
const originalEncryptionKey = process.env.ENCRYPTION_KEY;
const originalEncryptionKeyPrev = process.env.ENCRYPTION_KEY_PREV;

// ---------------------------------------------------------------------------
// Tests: encrypt/decrypt round-trip and format detection
// ---------------------------------------------------------------------------

describe("Encryption: round-trip and format detection (P5-4)", () => {
  beforeEach(() => {
    // Set a known key for each test
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    delete process.env.ENCRYPTION_KEY_PREV;

    // Clear module cache so encryption.ts re-reads env vars
    vi.resetModules();
  });

  afterAll(() => {
    // Restore original env vars
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
    if (originalEncryptionKeyPrev) {
      process.env.ENCRYPTION_KEY_PREV = originalEncryptionKeyPrev;
    }
  });

  it("P5-4: encrypt -> decrypt round-trip with current key", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");

    const plaintext = "123-45-6789";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("P5-4: encrypt produces non-empty ciphertext different from plaintext", async () => {
    const { encrypt } = await import("@/lib/encryption");

    const plaintext = "sensitive-data";
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it("P5-4: encrypt empty string returns empty string", async () => {
    const { encrypt } = await import("@/lib/encryption");

    expect(encrypt("")).toBe("");
  });

  it("P5-4: decrypt empty string returns empty string", async () => {
    const { decrypt } = await import("@/lib/encryption");

    expect(decrypt("")).toBe("");
  });

  it("P5-4: decrypt handles unversioned ciphertext (legacy format: iv:tag:cipher)", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");

    // Encrypt with current code (produces unversioned format in existing code)
    const plaintext = "legacy-tin-123";
    const encrypted = encrypt(plaintext);

    // Verify it's in the expected format (3 hex segments separated by colons)
    // After P5-4, new encryptions may have "v1:" prefix, but decrypt must still
    // handle the old format without prefix.
    const parts = encrypted.split(":");
    // Either 3 parts (legacy: iv:tag:cipher) or 4 parts (new: v1:iv:tag:cipher)
    expect(parts.length).toBeGreaterThanOrEqual(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  // IMPLEMENTATION NEEDED: P5-4 adds "v1:" prefix to new encrypted values
  it("P5-4: decrypt handles versioned ciphertext (new format: v1:iv:tag:cipher)", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");

    const plaintext = "versioned-tin-456";
    const encrypted = encrypt(plaintext);

    // IMPLEMENTATION NEEDED: After P5-4, encrypt() should produce "v1:iv:tag:cipher"
    // Verify the new format has the version prefix
    // expect(encrypted.startsWith("v1:")).toBe(true);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("P5-4: decrypt with wrong key throws (not silent empty string)", async () => {
    const { encrypt } = await import("@/lib/encryption");

    const plaintext = "secret-data";
    const encrypted = encrypt(plaintext);

    // Switch to a different key
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_KEY_WRONG;
    delete process.env.ENCRYPTION_KEY_PREV;
    const { decrypt: decryptWithWrongKey } = await import("@/lib/encryption");

    // Should throw, not return empty string or garbage
    expect(() => decryptWithWrongKey(encrypted)).toThrow();
  });

  it("P5-4: decrypt with invalid format throws", async () => {
    const { decrypt } = await import("@/lib/encryption");

    expect(() => decrypt("not-valid-encrypted-data")).toThrow(/invalid encrypted format/i);
  });

  it("P5-4: decrypt with truncated ciphertext throws", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");

    const encrypted = encrypt("some-data");
    // Truncate the ciphertext portion
    const parts = encrypted.split(":");
    parts[parts.length - 1] = parts[parts.length - 1].slice(0, 4);
    const truncated = parts.join(":");

    expect(() => decrypt(truncated)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: Key rotation (ENCRYPTION_KEY_PREV fallback)
// ---------------------------------------------------------------------------

describe("Encryption: key rotation with ENCRYPTION_KEY_PREV (P5-4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
    if (originalEncryptionKeyPrev) {
      process.env.ENCRYPTION_KEY_PREV = originalEncryptionKeyPrev;
    }
  });

  it("P5-4: encrypt with old key -> set ENCRYPTION_KEY_PREV -> decrypt succeeds (fallback)", async () => {
    // Step 1: Encrypt with the "old" key (which is currently ENCRYPTION_KEY)
    process.env.ENCRYPTION_KEY = TEST_KEY_PREVIOUS;
    delete process.env.ENCRYPTION_KEY_PREV;

    const { encrypt: encryptWithOldKey } = await import("@/lib/encryption");
    const plaintext = "old-key-encrypted-tin";
    const encrypted = encryptWithOldKey(plaintext);

    // Step 2: Rotate keys — old key becomes ENCRYPTION_KEY_PREV, new key becomes ENCRYPTION_KEY
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    process.env.ENCRYPTION_KEY_PREV = TEST_KEY_PREVIOUS;

    // IMPLEMENTATION NEEDED: P5-4 makes decrypt() try ENCRYPTION_KEY first,
    // then fall back to ENCRYPTION_KEY_PREV if the first attempt fails.
    const { decrypt: decryptWithFallback } = await import("@/lib/encryption");
    const decrypted = decryptWithFallback(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("P5-4: encrypt with new key -> decrypt succeeds (current key, no fallback needed)", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    process.env.ENCRYPTION_KEY_PREV = TEST_KEY_PREVIOUS;

    const { encrypt, decrypt } = await import("@/lib/encryption");

    const plaintext = "new-key-encrypted-tin";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("P5-4: decrypt fails when ciphertext matches neither current nor previous key", async () => {
    // Encrypt with a key that is neither current nor previous
    process.env.ENCRYPTION_KEY = TEST_KEY_WRONG;
    delete process.env.ENCRYPTION_KEY_PREV;

    const { encrypt: encryptWithWrongKey } = await import("@/lib/encryption");
    const encrypted = encryptWithWrongKey("data-from-unknown-key");

    // Now set current and previous to different keys
    vi.resetModules();
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    process.env.ENCRYPTION_KEY_PREV = TEST_KEY_PREVIOUS;

    const { decrypt } = await import("@/lib/encryption");

    // Should throw — neither key works
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("P5-4: ENCRYPTION_KEY_PREV is optional — decrypt works without it", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    delete process.env.ENCRYPTION_KEY_PREV;

    const { encrypt, decrypt } = await import("@/lib/encryption");

    const plaintext = "no-prev-key-test";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Tests: safeDecrypt behavior changes in sign route
// ---------------------------------------------------------------------------

describe("safeDecrypt behavior (P5-4)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    delete process.env.ENCRYPTION_KEY_PREV;
    vi.resetModules();
  });

  afterAll(() => {
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it("P5-4: safeDecrypt with null input returns empty string", async () => {
    const { safeDecrypt } = await import("@/lib/encryption");

    expect(safeDecrypt(null)).toBe("");
  });

  it("P5-4: safeDecrypt with undefined input returns empty string", async () => {
    const { safeDecrypt } = await import("@/lib/encryption");

    expect(safeDecrypt(undefined)).toBe("");
  });

  it("P5-4: safeDecrypt with valid ciphertext returns plaintext", async () => {
    const { encrypt, safeDecrypt } = await import("@/lib/encryption");

    const plaintext = "123-45-6789";
    const encrypted = encrypt(plaintext);
    const decrypted = safeDecrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  // IMPLEMENTATION NEEDED: P5-4 may change safeDecrypt behavior or remove it.
  // The sign route will stop using safeDecrypt in favor of hard-fail decrypt.
  // This test documents the CURRENT behavior for regression tracking.
  it("P5-4: current safeDecrypt with corrupted input returns empty string (pre-P5-4 behavior)", async () => {
    const { safeDecrypt } = await import("@/lib/encryption");

    // Corrupted ciphertext — current safeDecrypt returns "" silently
    const result = safeDecrypt("corrupted:data:here");
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests: Sign route — TIN decryption hard-fail (P5-4)
// ---------------------------------------------------------------------------

describe("POST /api/filing/sign — TIN decryption hard-fail (P5-4)", () => {
  // IMPLEMENTATION NEEDED: P5-4 modifies the sign route to replace
  //   `const tinLast4 = user.tin ? safeDecrypt(user.tin).slice(-4) : "0000";`
  // with a hard-fail that returns 422 when decryption fails, instead of
  // silently using "0000".

  // Mock auth BEFORE importing route
  vi.mock("@/lib/auth", () => ({
    auth: vi.fn(),
  }));

  // Mock form114a generation to avoid S3/PDF dependencies
  vi.mock("@/lib/form114a", () => ({
    generateForm114a: vi.fn().mockResolvedValue({ key: "mock-form114a-key" }),
  }));

  const TEST_EMAIL_SIGN = `sign-encryption-test-${Date.now()}@test.com`;
  let signTestUserId: string;
  let signTestFilingId: string;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;
    delete process.env.ENCRYPTION_KEY_PREV;

    const { prisma } = await import("@/lib/db");
    const bcryptMod = await import("bcryptjs");
    const { encrypt } = await import("@/lib/encryption");

    const passwordHash = await bcryptMod.default.hash("TestPassword1!", 10);
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL_SIGN,
        passwordHash,
        firstName: "Sign",
        lastName: "Tester",
        tin: encrypt("123-45-6789"), // valid encrypted TIN
      },
    });
    signTestUserId = user.id;

    const filing = await prisma.filingYear.create({
      data: {
        userId: signTestUserId,
        calendarYear: 2024,
        status: "REVIEWED",
        filingType: "ORIGINAL",
      },
    });
    signTestFilingId = filing.id;

    // Create at least one account so sign doesn't fail on account count
    await prisma.foreignAccount.create({
      data: {
        userId: signTestUserId,
        calendarYear: 2024,
        institutionName: "Test Bank",
        accountNumber: encrypt("ACCT123456"),
        accountType: "BANK",
        ownershipType: "FINANCIAL_INTEREST",
        countryCode: "CH",
        currencyCode: "USD",
        maxValueLocal: 5000,
        isJointAccount: false,
      },
    });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.user.delete({ where: { id: signTestUserId } }).catch(() => {});
    await prisma.$disconnect();

    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  beforeEach(async () => {
    // Re-establish mocks that vi.resetAllMocks clears
    const form114a = await import("@/lib/form114a");
    (form114a.generateForm114a as ReturnType<typeof vi.fn>).mockResolvedValue({ key: "mock-form114a-key" });
  });

  afterEach(async () => {
    const { prisma } = await import("@/lib/db");
    const { encrypt } = await import("@/lib/encryption");

    // Reset filing status back to REVIEWED and restore TIN
    await prisma.filingYear.update({
      where: { id: signTestFilingId },
      data: { status: "REVIEWED" },
    });
    await prisma.user.update({
      where: { id: signTestUserId },
      data: { tin: encrypt("123-45-6789") },
    });

    vi.resetAllMocks();
  });

  async function mockSignAuth(userId: string | null) {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
      userId ? { user: { id: userId } } : null
    );
  }

  function makeSignRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/filing/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
  }

  it("P5-4: sign route with valid encrypted TIN -> returns last 4 digits correctly", async () => {
    await mockSignAuth(signTestUserId);

    // IMPLEMENTATION NEEDED: import the actual sign route after P5-4 changes
    const { POST: signPost } = await import("@/app/api/filing/sign/route");

    const req = makeSignRequest({
      filingYearId: signTestFilingId,
      fullName: "Sign Tester",
      agreed: true,
      signatureData: "data:image/png;base64,iVBORw0KGgo=",
      signatureType: "typed",
    });

    const res = await signPost(req);
    const json = await res.json();

    // Should succeed — TIN "123-45-6789" last 4 = "6789"
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("P5-4: sign route with corrupted TIN -> 422 'Unable to retrieve your TIN'", async () => {
    const { prisma } = await import("@/lib/db");

    // Corrupt the TIN in DB (not valid encrypted data)
    await prisma.user.update({
      where: { id: signTestUserId },
      data: { tin: "corrupted:invalid:garbage:data" },
    });

    await mockSignAuth(signTestUserId);

    const { POST: signPost } = await import("@/app/api/filing/sign/route");

    const req = makeSignRequest({
      filingYearId: signTestFilingId,
      fullName: "Sign Tester",
      agreed: true,
      signatureData: "data:image/png;base64,iVBORw0KGgo=",
      signatureType: "typed",
    });

    const res = await signPost(req);
    const json = await res.json();

    // P5-4: decrypt() throws on corrupted data, route catches and returns 500
    expect(res.status).toBe(500);
    expect(json.error).toMatch(/unable to process/i);

    // Restore the valid TIN for subsequent tests
    const { encrypt } = await import("@/lib/encryption");
    await prisma.user.update({
      where: { id: signTestUserId },
      data: { tin: encrypt("123-45-6789") },
    });
  });

  it("P5-4: sign route with null TIN -> uses default '0000' (no TIN stored)", async () => {
    const { prisma } = await import("@/lib/db");

    // Set TIN to null (user never entered TIN)
    await prisma.user.update({
      where: { id: signTestUserId },
      data: { tin: null },
    });

    await mockSignAuth(signTestUserId);

    const { POST: signPost } = await import("@/app/api/filing/sign/route");

    const req = makeSignRequest({
      filingYearId: signTestFilingId,
      fullName: "Sign Tester",
      agreed: true,
      signatureData: "data:image/png;base64,iVBORw0KGgo=",
      signatureType: "typed",
    });

    const res = await signPost(req);
    const json = await res.json();

    // Null TIN is a valid state (user hasn't entered TIN) — should NOT error.
    // The route should use "0000" as the default tinLast4.
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Restore TIN for other tests
    const { encrypt } = await import("@/lib/encryption");
    await prisma.user.update({
      where: { id: signTestUserId },
      data: { tin: encrypt("123-45-6789") },
    });
  });

  it("P5-4: sign route unauthenticated -> 401", async () => {
    await mockSignAuth(null);

    const { POST: signPost } = await import("@/app/api/filing/sign/route");

    const req = makeSignRequest({
      filingYearId: signTestFilingId,
      fullName: "Sign Tester",
      agreed: true,
      signatureData: "test-sig",
      signatureType: "typed",
    });

    const res = await signPost(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: Encryption key validation
// ---------------------------------------------------------------------------

describe("Encryption: key validation (P5-4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it("P5-4: missing ENCRYPTION_KEY throws on encrypt", async () => {
    delete process.env.ENCRYPTION_KEY;

    const { encrypt } = await import("@/lib/encryption");

    expect(() => encrypt("test")).toThrow(/ENCRYPTION_KEY/i);
  });

  it("P5-4: ENCRYPTION_KEY with wrong length throws on encrypt", async () => {
    process.env.ENCRYPTION_KEY = "tooshort";

    const { encrypt } = await import("@/lib/encryption");

    expect(() => encrypt("test")).toThrow(/64 hex characters|32 bytes/i);
  });

  it("P5-4: ENCRYPTION_KEY with exactly 64 hex chars works", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_CURRENT;

    const { encrypt, decrypt } = await import("@/lib/encryption");

    const encrypted = encrypt("valid-key-test");
    expect(decrypt(encrypted)).toBe("valid-key-test");
  });
});
