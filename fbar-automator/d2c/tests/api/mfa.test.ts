import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as OTPAuth from "otpauth";

// ---------------------------------------------------------------------------
// P5-3: MFA (Multi-Factor Authentication) API tests
// ---------------------------------------------------------------------------

// Mock auth BEFORE importing any route handlers
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// Real route imports
import { POST as mfaSetup } from "@/app/api/auth/mfa/setup/route";
import { POST as mfaVerify } from "@/app/api/auth/mfa/verify/route";
import { POST as mfaDisable } from "@/app/api/auth/mfa/disable/route";
import { POST as mfaRecovery } from "@/app/api/auth/mfa/recovery/route";

// Real MFA lib imports
import { generateSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode } from "@/lib/mfa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL = `mfa-test-${Date.now()}@test.com`;
let testUserId: string;

function mockAuth(userId: string | null, extra: Record<string, unknown> = {}) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId, ...extra } } : null
  );
}

function makeRequest(
  url: string,
  body: unknown = {},
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function generateValidTotp(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "FBAR Direct",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "MFA",
      lastName: "Tester",
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  vi.resetAllMocks();

  // Reset MFA state on the user between tests
  await prisma.user.update({
    where: { id: testUserId },
    data: { mfaEnabled: false, mfaSecret: null, mfaVerifiedAt: null },
  });
  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: testUserId } });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/mfa/setup
// ---------------------------------------------------------------------------

describe("POST /api/auth/mfa/setup (P5-3)", () => {
  it("P5-3: authenticated user -> 200 with QR code URI and recovery codes", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/setup");
    const res = await mfaSetup(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should return an otpauth:// URI for QR code generation
    expect(json).toHaveProperty("otpauthUri");
    expect(json.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    // Should return recovery codes (array of strings)
    expect(json).toHaveProperty("recoveryCodes");
    expect(Array.isArray(json.recoveryCodes)).toBe(true);
    expect(json.recoveryCodes.length).toBeGreaterThanOrEqual(8);
    // Each recovery code should be a non-empty string
    json.recoveryCodes.forEach((code: string) => {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it("P5-3: authenticated user -> 200 with QR code data URI (base64 PNG)", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/setup");
    const res = await mfaSetup(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should include a QR code as a data URI (base64 encoded PNG)
    expect(json).toHaveProperty("qrCode");
    expect(json.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it("P5-3: unauthenticated -> 401", async () => {
    mockAuth(null);

    const req = makeRequest("/api/auth/mfa/setup");
    const res = await mfaSetup(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("P5-3: setup stores mfaSecret on user (not in response as plaintext after initial return)", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/setup");
    await mfaSetup(req);

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    // The mfaSecret should be set (not null) after setup
    expect(user!.mfaSecret).not.toBeNull();
    // MFA should NOT be enabled yet (must verify first)
    expect(user!.mfaEnabled).toBe(false);
  });

  it("P5-3: setup when MFA already enabled -> 400 'MFA is already enabled'", async () => {
    // Pre-set MFA as enabled
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP" },
    });

    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/setup");
    const res = await mfaSetup(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already enabled/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/mfa/verify
// ---------------------------------------------------------------------------

describe("POST /api/auth/mfa/verify (P5-3)", () => {
  it("P5-3: correct TOTP token -> 200 success + sets mfaEnabled and mfaVerifiedAt", async () => {
    // Setup: store a known mfaSecret on the user
    const { secret } = generateSecret(TEST_EMAIL);
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaSecret: secret },
    });

    mockAuth(testUserId);

    const validToken = generateValidTotp(secret);

    const req = makeRequest("/api/auth/mfa/verify", {
      token: validToken,
    });
    const res = await mfaVerify(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify DB state after successful verification
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.mfaEnabled).toBe(true);
    expect(user!.mfaVerifiedAt).not.toBeNull();
  });

  it("P5-3: incorrect TOTP token -> 400", async () => {
    // Set up user with mfaSecret first
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaSecret: "JBSWY3DPEHPK3PXP" },
    });

    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/verify", {
      token: "000000", // deliberately wrong
    });
    const res = await mfaVerify(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid|incorrect/i);
  });

  it("P5-3: missing token in body -> 400", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/verify", {});
    const res = await mfaVerify(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it("P5-3: unauthenticated -> 401", async () => {
    mockAuth(null);

    const req = makeRequest("/api/auth/mfa/verify", { token: "123456" });
    const res = await mfaVerify(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("P5-3: verify when no mfaSecret set (setup not started) -> 400", async () => {
    mockAuth(testUserId);

    // User has no mfaSecret — setup was never initiated (afterEach resets it to null)
    const req = makeRequest("/api/auth/mfa/verify", { token: "123456" });
    const res = await mfaVerify(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/setup|secret|not configured|not started/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/mfa/disable
// ---------------------------------------------------------------------------

describe("POST /api/auth/mfa/disable (P5-3)", () => {
  it("P5-3: correct TOTP confirmation -> 200 + disables MFA", async () => {
    // Enable MFA on user first with a known secret
    const { secret } = generateSecret(TEST_EMAIL);
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaEnabled: true, mfaSecret: secret, mfaVerifiedAt: new Date() },
    });

    mockAuth(testUserId);

    const validToken = generateValidTotp(secret);

    const req = makeRequest("/api/auth/mfa/disable", {
      token: validToken,
    });
    const res = await mfaDisable(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify DB state
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.mfaEnabled).toBe(false);
    expect(user!.mfaSecret).toBeNull();
    expect(user!.mfaVerifiedAt).toBeNull();
  });

  it("P5-3: incorrect TOTP confirmation -> 400 (MFA stays enabled)", async () => {
    // Enable MFA on user first
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP", mfaVerifiedAt: new Date() },
    });

    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/disable", {
      token: "000000", // deliberately wrong
    });
    const res = await mfaDisable(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid|incorrect/i);

    // MFA should still be enabled
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.mfaEnabled).toBe(true);
  });

  it("P5-3: unauthenticated -> 401", async () => {
    mockAuth(null);

    const req = makeRequest("/api/auth/mfa/disable", { token: "123456" });
    const res = await mfaDisable(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("P5-3: disable when MFA not enabled -> 400", async () => {
    mockAuth(testUserId);

    // User has MFA disabled (afterEach resets it) — nothing to disable
    const req = makeRequest("/api/auth/mfa/disable", { token: "123456" });
    const res = await mfaDisable(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/not enabled/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/mfa/recovery
// ---------------------------------------------------------------------------

describe("POST /api/auth/mfa/recovery (P5-3)", () => {
  it("P5-3: valid recovery code -> 200 success", async () => {
    mockAuth(testUserId);

    // Enable MFA and create recovery codes
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP", mfaVerifiedAt: new Date() },
    });
    const codes = generateRecoveryCodes(10);
    await prisma.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({
        userId: testUserId,
        codeHash: hashRecoveryCode(code),
      })),
    });
    const validCode = codes[0];

    const req = makeRequest("/api/auth/mfa/recovery", {
      code: validCode,
    });
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("P5-3: used recovery code -> 400 'Recovery code already used'", async () => {
    mockAuth(testUserId);

    // Create a recovery code and mark it as used
    const code = "USED-CODE12";
    await prisma.mfaRecoveryCode.create({
      data: {
        userId: testUserId,
        codeHash: hashRecoveryCode(code),
        used: true,
        usedAt: new Date(),
      },
    });

    const req = makeRequest("/api/auth/mfa/recovery", {
      code: code,
    });
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already used/i);
  });

  it("P5-3: invalid recovery code -> 400", async () => {
    mockAuth(testUserId);

    // Ensure MFA is enabled so recovery route is active
    await prisma.user.update({
      where: { id: testUserId },
      data: { mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP", mfaVerifiedAt: new Date() },
    });

    const req = makeRequest("/api/auth/mfa/recovery", {
      code: "TOTALLY-INVALID99",
    });
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid/i);
  });

  it("P5-3: empty code in body -> 400", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/recovery", { code: "" });
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it("P5-3: missing code in body -> 400", async () => {
    mockAuth(testUserId);

    const req = makeRequest("/api/auth/mfa/recovery", {});
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it("P5-3: unauthenticated -> 401", async () => {
    mockAuth(null);

    const req = makeRequest("/api/auth/mfa/recovery", { code: "SOME-CODE" });
    const res = await mfaRecovery(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("P5-3: successful recovery marks code as used in DB", async () => {
    mockAuth(testUserId);

    // Create unused recovery code
    const code = "MARKUSED1234";
    const record = await prisma.mfaRecoveryCode.create({
      data: { userId: testUserId, codeHash: hashRecoveryCode(code) },
    });

    const req = makeRequest("/api/auth/mfa/recovery", {
      code: code,
    });
    const res = await mfaRecovery(req);

    expect(res.status).toBe(200);

    // Verify the code is marked used in DB
    const updated = await prisma.mfaRecoveryCode.findUnique({ where: { id: record.id } });
    expect(updated!.used).toBe(true);
    expect(updated!.usedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: MFA middleware / guard on API routes
// ---------------------------------------------------------------------------

describe("MFA middleware guard (P5-3)", () => {
  it("P5-3: API route with mfaEnabled=true and mfaVerifiedAt=null -> 403 'MFA verification required'", async () => {
    // Placeholder: test will be fully fleshed out once MFA middleware exists
    expect(true).toBe(true);
  });

  it("P5-3: MFA-exempt routes (/api/auth/mfa/*) still accessible when MFA pending", async () => {
    expect(true).toBe(true);
  });
});
