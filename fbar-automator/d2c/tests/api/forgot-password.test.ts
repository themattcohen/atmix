import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// Mocks must be hoisted before the route import
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/auth/forgot-password/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ANTI_ENUM_MESSAGE =
  "If an account exists with that email, we've sent password reset instructions.";

// ─── Test Setup ───────────────────────────────────────────────────────────────

let testUser: { id: string; email: string };

beforeAll(async () => {
  const email = `test-forgot-pw-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  testUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Test",
      lastName: "User",
    },
  });
});

afterAll(async () => {
  // Cascade deletes will clean up PasswordResetToken rows via onDelete: Cascade
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up all password reset tokens between tests to avoid interference
  await prisma.passwordResetToken.deleteMany({
    where: { userId: testUser.id },
  });
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/forgot-password", () => {
  it("1. valid email for existing user → 200 + creates password reset token in DB", async () => {
    const req = makeRequest({ email: testUser.email });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);

    // Token must exist in DB
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: testUser.id },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).toBeTruthy();
    expect(tokens[0].used).toBe(false);
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("2. valid email for non-existent user → 200 (anti-enumeration, no token created)", async () => {
    const req = makeRequest({ email: "nobody-here@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);

    // No token should be created for this non-existent user
    const count = await prisma.passwordResetToken.count();
    expect(count).toBe(0);
  });

  it("3. malformed email (no @) → 200 (anti-enumeration)", async () => {
    const req = makeRequest({ email: "notanemail" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);
  });

  it("4. email too long (>254 chars) → 200 (anti-enumeration)", async () => {
    const longEmail = "a".repeat(245) + "@b.com"; // 252 chars total, then push over
    const tooLongEmail = "a".repeat(250) + "@example.com"; // >254 chars
    expect(tooLongEmail.length).toBeGreaterThan(254);

    const req = makeRequest({ email: tooLongEmail });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);
  });

  it("5. empty email string → 200 (anti-enumeration)", async () => {
    const req = makeRequest({ email: "" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);
  });

  it("6. missing email field → 200 (anti-enumeration)", async () => {
    const req = makeRequest({ name: "hacker" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);
  });

  it("7. empty body {} → 200 (anti-enumeration)", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe(ANTI_ENUM_MESSAGE);
  });

  it("8. valid email for existing user → token created AND sendPasswordResetEmail is called", async () => {
    const req = makeRequest({ email: testUser.email });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Token must be in DB
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: testUser.id },
    });
    expect(tokens).toHaveLength(1);

    // Email function must have been called with correct arguments
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [calledEmail, calledName, calledUrl] = (
      sendPasswordResetEmail as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(calledEmail).toBe(testUser.email);
    expect(calledName).toBe("Test"); // firstName from beforeAll
    expect(calledUrl).toMatch(/\/reset-password\?token=/);
  });

  it("9. non-existent email → no token created AND sendPasswordResetEmail NOT called", async () => {
    const req = makeRequest({ email: "ghost@example.com" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // No tokens in DB
    const count = await prisma.passwordResetToken.count();
    expect(count).toBe(0);

    // Email must NOT have been sent
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("10. multiple requests clean up expired tokens before creating a new one", async () => {
    // Seed an expired token and a used token for the user
    const now = new Date();
    const pastDate = new Date(now.getTime() - 1000); // 1 second ago = expired

    await prisma.passwordResetToken.createMany({
      data: [
        {
          userId: testUser.id,
          token: "expired-token-hash-aaa",
          expiresAt: pastDate,
          used: false,
        },
        {
          userId: testUser.id,
          token: "used-token-hash-bbb",
          expiresAt: new Date(now.getTime() + 3600 * 1000),
          used: true,
        },
      ],
    });

    // Confirm seeded tokens are there
    const before = await prisma.passwordResetToken.findMany({
      where: { userId: testUser.id },
    });
    expect(before).toHaveLength(2);

    // Issue a new forgot-password request
    const req = makeRequest({ email: testUser.email });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // After the route runs: expired + used tokens should be gone,
    // only the fresh valid token should remain
    const after = await prisma.passwordResetToken.findMany({
      where: { userId: testUser.id },
    });
    expect(after).toHaveLength(1);
    expect(after[0].used).toBe(false);
    expect(after[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
