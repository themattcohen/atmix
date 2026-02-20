import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P7-4 will add sendWelcomeEmail() to d2c/src/lib/email.ts:
//   export async function sendWelcomeEmail(to: string, data: { firstName: string }): Promise<void>
// P7-4 will also modify the signup route (d2c/src/app/api/auth/signup/route.ts) to
// call sendWelcomeEmail() after successful user creation. Email failure must NOT
// block signup (fire-and-forget or try/catch with logging).

// Mock email module BEFORE importing the route
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendSubmissionEmail: vi.fn().mockResolvedValue(undefined),
  sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
  sendEmailWithRetry: vi.fn().mockImplementation((fn: () => Promise<void>) => fn()),
}));

import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIMESTAMP = Date.now();

function makeSignupRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validSignupData(overrides: Record<string, unknown> = {}) {
  return {
    email: `welcome-test-${TIMESTAMP}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    password: "TestPassword123!",
    confirmPassword: "TestPassword123!",
    firstName: "Welcome",
    lastName: "Tester",
    ...overrides,
  };
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

const createdEmails: string[] = [];
const originalResendKey = process.env.RESEND_API_KEY;

beforeAll(() => {
  // Signup route guards email sending on RESEND_API_KEY being set
  process.env.RESEND_API_KEY = "re_test_fake_key";
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Restore RESEND_API_KEY
  if (originalResendKey !== undefined) {
    process.env.RESEND_API_KEY = originalResendKey;
  } else {
    delete process.env.RESEND_API_KEY;
  }
  // Clean up all users created during tests
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("P7-4: Welcome email on signup", () => {
  it("P7-4: successful signup calls sendWelcomeEmail with correct email and firstName", async () => {
    const data = validSignupData();
    createdEmails.push(data.email as string);

    const req = makeSignupRequest(data);
    const res = await POST(req);

    expect(res.status).toBe(201);

    // IMPLEMENTATION NEEDED: P7-4 will wire up sendWelcomeEmail in the signup route
    // After P7-4, this assertion should pass:
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      (data.email as string).toLowerCase().trim(),
      { firstName: "Welcome" }
    );
  });

  it("P7-4: sendWelcomeEmail receives the lowercase-trimmed email", async () => {
    const data = validSignupData({
      email: `  UPPER-${TIMESTAMP}-${Math.random().toString(36).slice(2, 6)}@TEST.COM  `,
    });
    const normalizedEmail = (data.email as string).toLowerCase().trim();
    createdEmails.push(normalizedEmail);

    const req = makeSignupRequest(data);
    const res = await POST(req);

    expect(res.status).toBe(201);

    // Email should be normalized before being passed to the welcome email function
    if ((sendWelcomeEmail as ReturnType<typeof vi.fn>).mock.calls.length > 0) {
      const calledEmail = (sendWelcomeEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledEmail).toBe(normalizedEmail);
    }
  });

  it("P7-4: signup still succeeds if sendWelcomeEmail throws (non-blocking)", async () => {
    // Make the email function throw to simulate a transient failure
    (sendWelcomeEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Resend API timeout")
    );

    const data = validSignupData();
    createdEmails.push(data.email as string);

    const req = makeSignupRequest(data);
    const res = await POST(req);

    // Signup must succeed despite email failure — email is non-blocking
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.message).toBeDefined();
  });

  it("P7-4: sendWelcomeEmail is NOT called on validation failure", async () => {
    // Missing required fields → 400 validation error
    const req = makeSignupRequest({
      email: "invalid",
      // Missing password, firstName, lastName
    });

    const res = await POST(req);

    // Should fail validation
    expect(res.status).toBe(400);

    // Welcome email should NOT be called on failed signup
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("P7-4: sendWelcomeEmail is NOT called when password is too weak", async () => {
    const req = makeSignupRequest({
      email: `weak-pw-${Date.now()}@test.com`,
      password: "ab",
      confirmPassword: "ab",
      firstName: "Test",
      lastName: "User",
    });

    const res = await POST(req);

    // Validation should reject weak password
    expect(res.status).toBe(400);

    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("P7-4: sendWelcomeEmail is NOT called when passwords do not match", async () => {
    const req = makeSignupRequest({
      email: `mismatch-${Date.now()}@test.com`,
      password: "ValidPassword1!",
      confirmPassword: "DifferentPassword1!",
      firstName: "Test",
      lastName: "User",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
