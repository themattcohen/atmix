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

const TEST_EMAIL = `filing-tier-test-${Date.now()}@test.com`;
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

function makeRawPostRequest(rawBody: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/filing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
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
      firstName: "Tier",
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
  // Wipe all filings for this test user between tests
  await prisma.filingYear.deleteMany({ where: { userId: testUserId } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/filing — auth guard", () => {
  it("1. POST without session returns 401", async () => {
    mockAuth(null);

    const res = await POST(makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });
});

describe("POST /api/filing — calendarYear validation", () => {
  it("2. POST with invalid JSON body returns 400 with 'Invalid JSON body'", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRawPostRequest("{ this is not valid json !!!"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid json body/i);
  });

  it("3. POST with missing calendarYear returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("4. POST with string calendarYear returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: "2024", filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("5. POST with non-integer calendarYear (2024.5) returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2024.5, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("6. POST with calendarYear too low (2009) returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2009, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("7. POST with calendarYear too high (2031) returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2031, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("8. POST with null calendarYear returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: null, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });
});

describe("POST /api/filing — happy path", () => {
  it("9. POST valid ORIGINAL filing returns 201 with filing id and calendarYear", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("id");
    expect(typeof json.data.id).toBe("string");
    expect(json.data.calendarYear).toBe(2024);
  });

  it("10. POST with omitted filingType defaults to ORIGINAL and returns 201", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);

    const filing = await prisma.filingYear.findUnique({ where: { id: json.data.id } });
    expect(filing).not.toBeNull();
    expect(filing!.filingType).toBe("ORIGINAL");
  });

  it("11. POST creates filing with IN_PROGRESS status in the database", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2022, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(201);

    const filing = await prisma.filingYear.findUnique({ where: { id: json.data.id } });
    expect(filing).not.toBeNull();
    expect(filing!.status).toBe("IN_PROGRESS");
    expect(filing!.userId).toBe(testUserId);
  });

  it("12. POST creates filing with BASIC tier by default", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2023, filingType: "ORIGINAL" }));
    const json = await res.json();

    expect(res.status).toBe(201);

    const filing = await prisma.filingYear.findUnique({ where: { id: json.data.id } });
    expect(filing).not.toBeNull();
    expect(filing!.tier).toBe("BASIC");
  });

  it("13. POST boundary calendarYear 2010 returns 201", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2010, filingType: "ORIGINAL" }));

    expect(res.status).toBe(201);
  });

  it("14. POST boundary calendarYear 2030 returns 201", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2030, filingType: "ORIGINAL" }));

    expect(res.status).toBe(201);
  });
});

describe("POST /api/filing — conflicts", () => {
  it("15. POST duplicate year and type returns 409 with existing ID", async () => {
    mockAuth(testUserId);

    // Create the first filing
    const first = await POST(makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" }));
    const firstJson = await first.json();
    expect(first.status).toBe(201);

    // Attempt duplicate
    const second = await POST(makePostRequest({ calendarYear: 2024, filingType: "ORIGINAL" }));
    const secondJson = await second.json();

    expect(second.status).toBe(409);
    expect(secondJson.error).toMatch(/already exists/i);
    expect(secondJson.data.id).toBe(firstJson.data.id);
  });

  it("16. POST invalid filingType returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2024, filingType: "SUPERSEDED" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid filing type/i);
  });

  it("17. POST AMENDED when no ORIGINAL exists returns 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest({ calendarYear: 2023, filingType: "AMENDED" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/original filing must be in ACCEPTED status/i);
  });

  it("18. POST AMENDED when ORIGINAL is IN_PROGRESS (not ACCEPTED) returns 400", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
      },
    });

    const res = await POST(makePostRequest({ calendarYear: 2023, filingType: "AMENDED" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/original filing must be in ACCEPTED status/i);
  });
});

describe("GET /api/filing — auth guard and tier field", () => {
  it("19. GET without session returns 401", async () => {
    mockAuth(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("20. GET returns empty array when user has no filings", async () => {
    mockAuth(testUserId);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it("21. GET returns filing with tier field set to BASIC by default", async () => {
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
    expect(json.data[0].tier).toBe("BASIC");
  });

  it("22. GET returns filing with tier field set to PREMIUM when explicitly set", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        filingType: "ORIGINAL",
        status: "IN_PROGRESS",
        tier: "PREMIUM",
      },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].tier).toBe("PREMIUM");
  });

  it("23. GET returns filings ordered by calendarYear descending", async () => {
    mockAuth(testUserId);

    await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2022,
        filingType: "ORIGINAL",
        status: "ACCEPTED",
      },
    });
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
    expect(json.data).toHaveLength(2);
    expect(json.data[0].calendarYear).toBe(2024);
    expect(json.data[1].calendarYear).toBe(2022);
  });

  it("24. GET includes accountCount of 0 when no foreign accounts exist", async () => {
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

  it("25. GET does not return filings from another user", async () => {
    mockAuth(testUserId);

    // Create a second user with their own filing
    const otherUser = await prisma.user.create({
      data: {
        email: `other-tier-${Date.now()}@test.com`,
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

      // Create our own filing for a different year
      await prisma.filingYear.create({
        data: {
          userId: testUserId,
          calendarYear: 2023,
          filingType: "ORIGINAL",
          status: "IN_PROGRESS",
        },
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].calendarYear).toBe(2023);
    } finally {
      await prisma.filingYear.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  });
});
