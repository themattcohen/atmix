import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

// Mock auth BEFORE importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/filing/review/route";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = `review-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/filing/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/filing/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

async function createTestAccount() {
  return prisma.foreignAccount.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      institutionName: "Test Bank",
      accountNumber: "encrypted-test-acct",
      accountType: "BANK",
      ownershipType: "FINANCIAL_INTEREST",
      countryCode: "CH",
      currencyCode: "CHF",
      maxValueLocal: 5000,
      isJointAccount: false,
    },
  });
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1", 10);

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Test",
      lastName: "User",
    },
  });
  testUserId = user.id;

  const filing = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "IN_PROGRESS",
      filingType: "ORIGINAL",
    },
  });
  testFilingId = filing.id;

  // Create 1 account so the account guard passes by default
  await createTestAccount();
});

afterAll(async () => {
  // Cascade deletes clean up accounts, filings, payments, etc.
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Reset filing to IN_PROGRESS for the next test
  await prisma.filingYear.update({
    where: { id: testFilingId },
    data: { status: "IN_PROGRESS" },
  });

  // Ensure exactly 1 account exists for the test user/year
  const count = await prisma.foreignAccount.count({
    where: { userId: testUserId, calendarYear: 2024 },
  });

  if (count === 0) {
    await createTestAccount();
  }
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/filing/review", () => {
  // ── Happy Path ──────────────────────────────────────────────────────────────

  it("1. IN_PROGRESS filing with accounts → 200, status becomes REVIEWED", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe("REVIEWED");

    // Verify DB was actually updated
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("REVIEWED");
  });

  // ── State Guards ─────────────────────────────────────────────────────────────

  it("2. REVIEWED filing → 400 with correct error message", async () => {
    mockAuth(testUserId);

    // Pre-set to REVIEWED
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "REVIEWED" },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Filing is in REVIEWED state, expected IN_PROGRESS");
  });

  it("3. SIGNED filing → 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "SIGNED" },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Filing is in SIGNED state, expected IN_PROGRESS");
  });

  it("4. PAID filing → 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "PAID" },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Filing is in PAID state, expected IN_PROGRESS");
  });

  it("5. SUBMITTED filing → 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "SUBMITTED" },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Filing is in SUBMITTED state, expected IN_PROGRESS");
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  it("6. no filingYearId in body → 400 'filingYearId is required'", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("filingYearId is required");
  });

  it("7. invalid JSON body → 400 'Invalid JSON body'", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRawRequest("not-valid-json{{{"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  it("8. filing not found (wrong ID) → 404", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRequest({ filingYearId: "nonexistent-filing-id-12345" }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Filing not found");
  });

  it("9. filing belongs to different user → 404", async () => {
    // Create a second user with their own filing
    const otherPasswordHash = await bcrypt.hash("OtherPassword1", 10);
    const otherUser = await prisma.user.create({
      data: {
        email: `other-review-${Date.now()}@test.com`,
        passwordHash: otherPasswordHash,
        firstName: "Other",
        lastName: "User",
      },
    });

    const otherFiling = await prisma.filingYear.create({
      data: {
        userId: otherUser.id,
        calendarYear: 2024,
        status: "IN_PROGRESS",
        filingType: "ORIGINAL",
      },
    });

    // Authenticate as the main test user but try to access other user's filing
    mockAuth(testUserId);

    const res = await POST(makeRequest({ filingYearId: otherFiling.id }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Filing not found");

    // Clean up
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  // ── Account Guard ─────────────────────────────────────────────────────────────

  it("10. IN_PROGRESS filing with ZERO accounts → 400 'At least one foreign account is required'", async () => {
    mockAuth(testUserId);

    // Delete all accounts for this user/year
    await prisma.foreignAccount.deleteMany({
      where: { userId: testUserId, calendarYear: 2024 },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("At least one foreign account is required");

    // Restore account so afterEach count check is satisfied
    await createTestAccount();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────────

  it("11. unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  // ── Idempotency Edge Case ─────────────────────────────────────────────────────

  it("12. after successful review, calling again → 400 (already REVIEWED, not IN_PROGRESS)", async () => {
    mockAuth(testUserId);

    // First call: succeeds
    const res1 = await POST(makeRequest({ filingYearId: testFilingId }));
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.status).toBe("REVIEWED");

    // Second call: filing is now REVIEWED, not IN_PROGRESS
    const res2 = await POST(makeRequest({ filingYearId: testFilingId }));
    const json2 = await res2.json();

    expect(res2.status).toBe(400);
    expect(json2.error).toBe("Filing is in REVIEWED state, expected IN_PROGRESS");
  });
});
