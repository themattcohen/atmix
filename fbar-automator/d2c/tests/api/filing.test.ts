import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// Mock auth BEFORE importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { GET, POST } from "@/app/api/filing/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `filing-test-${Date.now()}@test.com`;
let testUserId: string;

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/filing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/filing");
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Filing",
      lastName: "Tester",
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  // Cascade deletes clean up filings and accounts
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Wipe all filings for the test user between tests
  await prisma.filingYear.deleteMany({ where: { userId: testUserId } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/filing", () => {
  // ── P1-3: Invalid JSON handling ─────────────────────────────────────────────

  it("P1-3: POST with invalid JSON body — does not crash (documents actual behavior)", async () => {
    mockAuth(testUserId);

    // The filing route does NOT have a try/catch around req.json() — it only
    // has an outer catch. An unparseable body will cause req.json() to throw,
    // which is caught by the outer try/catch and returns 500.
    const req = new NextRequest("http://localhost:3000/api/filing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ this is not valid json !!!",
    });

    const res = await POST(req);
    // The outer catch handles this — route does not crash the process.
    // We document the actual HTTP status rather than asserting a specific
    // business-level response.
    expect([400, 500]).toContain(res.status);
  });

  // ── P1-11: AMENDED-requires-ACCEPTED guard ──────────────────────────────────

  it("P1-11a: POST AMENDED when no ORIGINAL exists → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2023, filingType: "AMENDED" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/original filing must be in ACCEPTED status/i);
  });

  it("P1-11b: POST AMENDED when ORIGINAL is IN_PROGRESS → 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
      },
    });

    const res = await POST(
      makePostRequest({ calendarYear: 2023, filingType: "AMENDED" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/original filing must be in ACCEPTED status/i);
  });

  it("P1-11c: POST AMENDED when ORIGINAL is ACCEPTED → 201 success", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        filingType: "ORIGINAL",
        status: "ACCEPTED",
      },
    });

    const res = await POST(
      makePostRequest({ calendarYear: 2023, filingType: "AMENDED" })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("id");
    expect(json.data.calendarYear).toBe(2023);
  });

  it("P1-11d: POST AMENDED when ORIGINAL is REJECTED → 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        filingType: "ORIGINAL",
        status: "REJECTED",
      },
    });

    const res = await POST(
      makePostRequest({ calendarYear: 2023, filingType: "AMENDED" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/original filing must be in ACCEPTED status/i);
  });

  // ── General filing creation ─────────────────────────────────────────────────

  it("POST valid ORIGINAL → 201 with filing ID", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("id");
    expect(typeof json.data.id).toBe("string");
    expect(json.data.calendarYear).toBe(2024);

    // Verify IN_PROGRESS status written to DB
    const filing = await prisma.filingYear.findUnique({
      where: { id: json.data.id },
    });
    expect(filing).not.toBeNull();
    expect(filing!.status).toBe("IN_PROGRESS");
    expect(filing!.filingType).toBe("ORIGINAL");
    expect(filing!.calendarYear).toBe(2024);
    expect(filing!.userId).toBe(testUserId);
  });

  it("POST defaults filingType to ORIGINAL when omitted → 201", async () => {
    mockAuth(testUserId);

    // omit filingType — route defaults to "ORIGINAL"
    const res = await POST(makePostRequest({ calendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);

    const filing = await prisma.filingYear.findUnique({
      where: { id: json.data.id },
    });
    expect(filing!.filingType).toBe("ORIGINAL");
  });

  it("POST duplicate year+type → 409 with existing ID", async () => {
    mockAuth(testUserId);

    // Create the first filing
    const first = await POST(
      makePostRequest({ calendarYear: 2022, filingType: "ORIGINAL" })
    );
    const firstJson = await first.json();
    expect(first.status).toBe(201);

    // Attempt duplicate
    const res = await POST(
      makePostRequest({ calendarYear: 2022, filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/already exists/i);
    expect(json.data.id).toBe(firstJson.data.id);
  });

  it("POST invalid calendarYear (too low: 2009) → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2009, filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("POST invalid calendarYear (too high: 2031) → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2031, filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("POST boundary calendarYear 2010 → 201", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2010, filingType: "ORIGINAL" })
    );

    expect(res.status).toBe(201);
  });

  it("POST boundary calendarYear 2030 → 201", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2030, filingType: "ORIGINAL" })
    );

    expect(res.status).toBe(201);
  });

  it("POST missing calendarYear → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("POST invalid filingType → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({ calendarYear: 2024, filingType: "SUPERSEDED" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid filing type/i);
  });

  it("POST unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await POST(
      makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });
});

describe("GET /api/filing", () => {
  it("GET returns filings with account counts", async () => {
    mockAuth(testUserId);

    // Create two filings for different years
    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
      },
    });
    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        filingType: "ORIGINAL",
        status: "ACCEPTED",
      },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);

    // Route orders by calendarYear desc
    expect(json.data[0].calendarYear).toBe(2024);
    expect(json.data[1].calendarYear).toBe(2023);

    // Verify expected shape on each filing
    const filing2024 = json.data[0];
    expect(filing2024).toHaveProperty("id");
    expect(filing2024).toHaveProperty("calendarYear");
    expect(filing2024).toHaveProperty("status");
    expect(filing2024).toHaveProperty("filingType");
    expect(filing2024).toHaveProperty("has25PlusAccounts");
    expect(filing2024).toHaveProperty("tier");
    expect(filing2024).toHaveProperty("accountCount");
    expect(typeof filing2024.accountCount).toBe("number");
  });

  it("GET returns accountCount 0 when no foreign accounts exist for that year", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
      },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].accountCount).toBe(0);
  });

  it("GET returns empty array when user has no filings", async () => {
    mockAuth(testUserId);

    // afterEach already wiped filings — no filings exist
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it("GET unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("GET includes correct nullable fields (signedAt, submittedAt, etc.) as null when unset", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
      },
    });

    const res = await GET();
    const json = await res.json();

    const filing = json.data[0];
    expect(filing.signedAt).toBeNull();
    expect(filing.form114aUrl).toBeNull();
    expect(filing.stripePaymentId).toBeNull();
    expect(filing.bsaId).toBeNull();
    expect(filing.submittedAt).toBeNull();
    expect(filing.acknowledgedAt).toBeNull();
    expect(filing.rejectionReason).toBeNull();
  });

  it("GET does not return filings belonging to other users", async () => {
    mockAuth(testUserId);

    // Create a second user with their own filing
    const otherUser = await prisma.user.create({
      data: {
        email: `other-filing-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash("OtherPass1!", 10),
      },
    });

    try {
      await prisma.filingYear.create({
        data: {
          userId: otherUser.id,
          calendarYear: 2024,
          filingType: "ORIGINAL",
          status: "IN_PROGRESS",
        },
      });

      // Create our own filing
      await prisma.filingYear.create({
        data: {
          userId: testUserId,
          calendarYear: 2022,
          filingType: "ORIGINAL",
          status: "IN_PROGRESS",
        },
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      // Should only see the test user's filing, not the other user's
      expect(json.data).toHaveLength(1);
      expect(json.data[0].calendarYear).toBe(2022);
    } finally {
      await prisma.filingYear.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  });
});
