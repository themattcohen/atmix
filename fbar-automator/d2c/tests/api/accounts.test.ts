import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// Mock auth BEFORE importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { GET, POST } from "@/app/api/accounts/route";
import { PUT, DELETE } from "@/app/api/accounts/[accountId]/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = `accounts-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/accounts");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(accountId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/accounts/${accountId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(accountId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/accounts/${accountId}`, {
    method: "DELETE",
  });
}

function defaultAccountData(overrides: Record<string, unknown> = {}) {
  return {
    institutionName: "Test Bank",
    accountNumber: "123456789",
    accountType: "BANK",
    ownershipType: "FINANCIAL_INTEREST",
    countryCode: "CH",
    currencyCode: "USD",
    maxValueLocal: 10000,
    isJointAccount: false,
    calendarYear: 2024,
    ...overrides,
  };
}

// Fields for direct DB inserts — uses encrypted accountNumber + Prisma-compatible nulls
function defaultDbAccountFields() {
  return {
    institutionName: "Test Bank",
    accountNumber: encrypt("123456789"),
    accountType: "BANK" as const,
    ownershipType: "FINANCIAL_INTEREST" as const,
    countryCode: "CH",
    currencyCode: "USD",
    maxValueLocal: 10000,
    isJointAccount: false,
    jointOwnerInfo: null,
    institutionAddress: Prisma.DbNull,
    maxValueUsd: null,
    exchangeRate: null,
    exchangeRateSource: null,
  };
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Test",
      lastName: "Accounts",
    },
  });
  testUserId = user.id;

  // Create the IN_PROGRESS filing for 2024 that most tests rely on
  const filing = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "IN_PROGRESS",
    },
  });
  testFilingId = filing.id;
});

afterAll(async () => {
  // Cascade delete removes filings and accounts
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Wipe accounts and reset has25PlusAccounts between tests
  await prisma.foreignAccount.deleteMany({ where: { userId: testUserId } });
  await prisma.filingYear.updateMany({
    where: { userId: testUserId, calendarYear: 2024 },
    data: { has25PlusAccounts: false },
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/accounts — calendarYear validation (P1-2)", () => {
  it("1. GET with calendarYear=abc → 400 'Invalid calendar year'", async () => {
    mockAuth(testUserId);

    const req = makeGetRequest({ calendarYear: "abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid calendar year/i);
  });

  it("2. GET with calendarYear=2024 → 200 (valid integer year)", async () => {
    mockAuth(testUserId);

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("3. GET without calendarYear → 200 (returns all accounts, no filter)", async () => {
    mockAuth(testUserId);

    // Create accounts in two different years to prove no filter is applied
    await prisma.foreignAccount.createMany({
      data: [
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2024, institutionName: "Bank A 2024" },
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2023, institutionName: "Bank B 2023" },
      ],
    });

    const req = makeGetRequest();
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("data");
    expect(json.data).toHaveLength(2);
  });
});

describe("GET /api/accounts — auth guard", () => {
  it("12. GET unauthenticated → 401", async () => {
    mockAuth(null);

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });
});

describe("GET /api/accounts — priorYears population", () => {
  it("GET with year that has no accounts returns priorYears from earlier years", async () => {
    mockAuth(testUserId);

    // Create 2 accounts in 2023 (prior year)
    await prisma.foreignAccount.createMany({
      data: [
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2023, institutionName: "Old Bank 1" },
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2023, institutionName: "Old Bank 2" },
      ],
    });

    // Query 2024 (no accounts) — should surface 2023 in priorYears
    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(0);
    expect(Array.isArray(json.priorYears)).toBe(true);

    const prior2023 = json.priorYears.find(
      (p: { calendarYear: number; count: number }) => p.calendarYear === 2023
    );
    expect(prior2023).toBeDefined();
    expect(prior2023.count).toBe(2);
  });
});

describe("POST /api/accounts — auth + validation", () => {
  it("10. POST unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await POST(makePostRequest(defaultAccountData()));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("11. POST with invalid data (missing required fields) → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest({
        // Missing institutionName, accountNumber, accountType, etc.
        calendarYear: 2024,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/validation failed/i);
    expect(json.details).toBeDefined();
  });

  it("POST with invalid accountType → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest(defaultAccountData({ accountType: "INVALID_TYPE" }))
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/validation failed/i);
  });

  it("POST with maxValueLocal=0 (not positive) → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest(defaultAccountData({ maxValueLocal: 0 }))
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/validation failed/i);
  });
});

describe("POST /api/accounts — account creation", () => {
  it("POST valid USD account → 201 with account data", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest(defaultAccountData()));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("id");
    expect(json.data.institutionName).toBe("Test Bank");
    expect(json.data.calendarYear).toBe(2024);
  });

  it("POST stores accountNumber encrypted (not plaintext in DB)", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest(defaultAccountData({ accountNumber: "MYSECRET123" })));
    expect(res.status).toBe(201);
    const json = await res.json();

    // Fetch raw record from DB
    const dbAccount = await prisma.foreignAccount.findUnique({
      where: { id: json.data.id },
    });

    expect(dbAccount).not.toBeNull();
    // The stored value must NOT be the plaintext
    expect(dbAccount!.accountNumber).not.toBe("MYSECRET123");
    // It must contain the iv:tag:cipher format (v1:iv:tag:cipher or legacy iv:tag:cipher)
    expect(dbAccount!.accountNumber).toMatch(/^(v1:)?[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("POST response shows last-4 digits of account number, not full number", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest(defaultAccountData({ accountNumber: "987654321" })));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.accountNumberLast4).toBe("4321");
  });
});

describe("P2-2: maxValueUsd computation on POST", () => {
  it("6. POST with currencyCode=USD → maxValueUsd equals maxValueLocal", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest(defaultAccountData({ currencyCode: "USD", maxValueLocal: 15000 }))
    );
    const json = await res.json();

    expect(res.status).toBe(201);

    // Fetch the persisted account from DB to check maxValueUsd
    const dbAccount = await prisma.foreignAccount.findUnique({
      where: { id: json.data.id },
    });

    expect(dbAccount).not.toBeNull();
    expect(Number(dbAccount!.maxValueUsd)).toBe(15000);
  });

  it("7. POST with currencyCode=EUR → maxValueUsd is null (treasury rates stubbed)", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest(
        defaultAccountData({ currencyCode: "EUR", countryCode: "DE", maxValueLocal: 8000 })
      )
    );
    const json = await res.json();

    expect(res.status).toBe(201);

    const dbAccount = await prisma.foreignAccount.findUnique({
      where: { id: json.data.id },
    });

    expect(dbAccount).not.toBeNull();
    // Treasury is stubbed → getRate returns null → maxValueUsd should be null
    expect(dbAccount!.maxValueUsd).toBeNull();
  });

  it("POST with currencyCode=JPY → maxValueUsd is null (treasury rates stubbed)", async () => {
    mockAuth(testUserId);

    const res = await POST(
      makePostRequest(
        defaultAccountData({ currencyCode: "JPY", countryCode: "JP", maxValueLocal: 1000000 })
      )
    );
    const json = await res.json();

    expect(res.status).toBe(201);

    const dbAccount = await prisma.foreignAccount.findUnique({
      where: { id: json.data.id },
    });

    expect(dbAccount!.maxValueUsd).toBeNull();
  });
});

describe("P1-10: has25PlusAccounts flag on POST", () => {
  it("4. POST the 25th account → filing.has25PlusAccounts becomes true", async () => {
    mockAuth(testUserId);

    // Create 24 accounts directly in DB for speed
    const accounts = Array.from({ length: 24 }, (_, i) => ({
      ...defaultDbAccountFields(),
      userId: testUserId,
      calendarYear: 2024,
      institutionName: `Bulk Bank ${i + 1}`,
    }));
    await prisma.foreignAccount.createMany({ data: accounts });

    // Verify flag is still false before the 25th
    const beforeFiling = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    expect(beforeFiling!.has25PlusAccounts).toBe(false);

    // POST the 25th account through the API — handler must recompute the flag
    const res = await POST(
      makePostRequest(defaultAccountData({ institutionName: "Account #25" }))
    );
    expect(res.status).toBe(201);

    const updatedFiling = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    expect(updatedFiling!.has25PlusAccounts).toBe(true);
  });

  it("POST the 26th account → filing.has25PlusAccounts stays true", async () => {
    mockAuth(testUserId);

    const accounts = Array.from({ length: 25 }, (_, i) => ({
      ...defaultDbAccountFields(),
      userId: testUserId,
      calendarYear: 2024,
      institutionName: `Bulk Bank ${i + 1}`,
    }));
    await prisma.foreignAccount.createMany({ data: accounts });

    // Set the flag to true to simulate the state after the 25th
    await prisma.filingYear.updateMany({
      where: { userId: testUserId, calendarYear: 2024 },
      data: { has25PlusAccounts: true },
    });

    const res = await POST(
      makePostRequest(defaultAccountData({ institutionName: "Account #26" }))
    );
    expect(res.status).toBe(201);

    const updatedFiling = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    expect(updatedFiling!.has25PlusAccounts).toBe(true);
  });

  it("POST with only 24 accounts total → filing.has25PlusAccounts remains false", async () => {
    mockAuth(testUserId);

    // Create 23 directly, POST 1 via API → total = 24
    const accounts = Array.from({ length: 23 }, (_, i) => ({
      ...defaultDbAccountFields(),
      userId: testUserId,
      calendarYear: 2024,
      institutionName: `Bank ${i + 1}`,
    }));
    await prisma.foreignAccount.createMany({ data: accounts });

    const res = await POST(makePostRequest(defaultAccountData({ institutionName: "Bank 24" })));
    expect(res.status).toBe(201);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.has25PlusAccounts).toBe(false);
  });
});

describe("P1-10: has25PlusAccounts flag on DELETE", () => {
  it("5. DELETE one account (down from 25 to 24) → filing.has25PlusAccounts becomes false", async () => {
    mockAuth(testUserId);

    // Create 25 accounts in DB
    const accounts = Array.from({ length: 25 }, (_, i) => ({
      ...defaultDbAccountFields(),
      userId: testUserId,
      calendarYear: 2024,
      institutionName: `Bank ${i + 1}`,
    }));
    await prisma.foreignAccount.createMany({ data: accounts });

    // Set flag to true (as it would be after adding the 25th)
    await prisma.filingYear.updateMany({
      where: { userId: testUserId, calendarYear: 2024 },
      data: { has25PlusAccounts: true },
    });

    // Pick one account to delete
    const accountToDelete = await prisma.foreignAccount.findFirst({
      where: { userId: testUserId, calendarYear: 2024 },
    });
    expect(accountToDelete).not.toBeNull();

    const req = makeDeleteRequest(accountToDelete!.id);
    const res = await DELETE(req, { params: { accountId: accountToDelete!.id } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Now at 24 — flag should be false
    const updatedFiling = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    expect(updatedFiling!.has25PlusAccounts).toBe(false);
  });

  it("DELETE one of 26 accounts (down to 25) → filing.has25PlusAccounts stays true", async () => {
    mockAuth(testUserId);

    const accounts = Array.from({ length: 26 }, (_, i) => ({
      ...defaultDbAccountFields(),
      userId: testUserId,
      calendarYear: 2024,
      institutionName: `Bank ${i + 1}`,
    }));
    await prisma.foreignAccount.createMany({ data: accounts });

    await prisma.filingYear.updateMany({
      where: { userId: testUserId, calendarYear: 2024 },
      data: { has25PlusAccounts: true },
    });

    const accountToDelete = await prisma.foreignAccount.findFirst({
      where: { userId: testUserId, calendarYear: 2024 },
    });

    const req = makeDeleteRequest(accountToDelete!.id);
    const res = await DELETE(req, { params: { accountId: accountToDelete!.id } });

    expect(res.status).toBe(200);

    const updatedFiling = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    // Still 25 accounts remaining — flag stays true
    expect(updatedFiling!.has25PlusAccounts).toBe(true);
  });

  it("DELETE non-existent account → 404", async () => {
    mockAuth(testUserId);

    const fakeId = "00000000-0000-0000-0000-000000000000";
    const req = makeDeleteRequest(fakeId);
    const res = await DELETE(req, { params: { accountId: fakeId } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  it("DELETE account belonging to another user → 404 (ownership enforced)", async () => {
    mockAuth(testUserId);

    // Create a second user and an account belonging to them
    const otherUser = await prisma.user.create({
      data: {
        email: `other-user-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash("TestPassword1!", 10),
        firstName: "Other",
        lastName: "User",
      },
    });

    const otherAccount = await prisma.foreignAccount.create({
      data: {
        ...defaultDbAccountFields(),
        userId: otherUser.id,
        calendarYear: 2024,
      },
    });

    const req = makeDeleteRequest(otherAccount.id);
    const res = await DELETE(req, { params: { accountId: otherAccount.id } });

    expect(res.status).toBe(404);

    // Cleanup
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});

describe("P2-2: maxValueUsd computation on PUT", () => {
  it("8. PUT updating maxValueLocal on USD account → maxValueUsd recomputed to match", async () => {
    mockAuth(testUserId);

    // Create a USD account
    const createRes = await POST(
      makePostRequest(defaultAccountData({ currencyCode: "USD", maxValueLocal: 5000 }))
    );
    expect(createRes.status).toBe(201);
    const { data: created } = await createRes.json();

    // Verify initial maxValueUsd
    const beforeDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(Number(beforeDb!.maxValueUsd)).toBe(5000);

    // PUT: update maxValueLocal to 20000
    const putReq = makePutRequest(created.id, { maxValueLocal: 20000 });
    const putRes = await PUT(putReq, { params: { accountId: created.id } });

    expect(putRes.status).toBe(200);

    // After update, maxValueUsd should match new maxValueLocal (USD 1:1)
    const afterDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(Number(afterDb!.maxValueUsd)).toBe(20000);
  });

  it("9. PUT changing currencyCode from USD to EUR → maxValueUsd becomes null (treasury stubbed)", async () => {
    mockAuth(testUserId);

    // Create a USD account (starts with maxValueUsd set)
    const createRes = await POST(
      makePostRequest(defaultAccountData({ currencyCode: "USD", maxValueLocal: 10000 }))
    );
    expect(createRes.status).toBe(201);
    const { data: created } = await createRes.json();

    const beforeDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(Number(beforeDb!.maxValueUsd)).toBe(10000);

    // PUT: change currencyCode from USD to EUR
    const putReq = makePutRequest(created.id, { currencyCode: "EUR" });
    const putRes = await PUT(putReq, { params: { accountId: created.id } });

    expect(putRes.status).toBe(200);

    // EUR rate not available (stubbed) → maxValueUsd = null
    const afterDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(afterDb!.maxValueUsd).toBeNull();
  });

  it("PUT updating institutionName only → maxValueUsd unchanged (no recompute)", async () => {
    mockAuth(testUserId);

    const createRes = await POST(
      makePostRequest(defaultAccountData({ currencyCode: "USD", maxValueLocal: 7500 }))
    );
    expect(createRes.status).toBe(201);
    const { data: created } = await createRes.json();

    const beforeDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(Number(beforeDb!.maxValueUsd)).toBe(7500);

    // PUT: change only institutionName (does not trigger maxValueUsd recompute)
    const putReq = makePutRequest(created.id, { institutionName: "Updated Bank Name" });
    const putRes = await PUT(putReq, { params: { accountId: created.id } });

    expect(putRes.status).toBe(200);

    const afterDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    // maxValueUsd should remain unchanged at 7500
    expect(Number(afterDb!.maxValueUsd)).toBe(7500);
    expect(afterDb!.institutionName).toBe("Updated Bank Name");
  });

  it("PUT updating maxValueLocal on EUR account → maxValueUsd stays null (treasury stubbed)", async () => {
    mockAuth(testUserId);

    const createRes = await POST(
      makePostRequest(
        defaultAccountData({ currencyCode: "EUR", countryCode: "DE", maxValueLocal: 5000 })
      )
    );
    expect(createRes.status).toBe(201);
    const { data: created } = await createRes.json();

    // Verify it starts null (EUR, no treasury rate)
    const beforeDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(beforeDb!.maxValueUsd).toBeNull();

    // PUT: update maxValueLocal
    const putReq = makePutRequest(created.id, { maxValueLocal: 9000 });
    const putRes = await PUT(putReq, { params: { accountId: created.id } });

    expect(putRes.status).toBe(200);

    // Still null — treasury rate unavailable
    const afterDb = await prisma.foreignAccount.findUnique({ where: { id: created.id } });
    expect(afterDb!.maxValueUsd).toBeNull();
    expect(Number(afterDb!.maxValueLocal)).toBe(9000);
  });

  it("PUT non-existent account → 404", async () => {
    mockAuth(testUserId);

    const fakeId = "00000000-0000-0000-0000-000000000000";
    const putReq = makePutRequest(fakeId, { institutionName: "Ghost Bank" });
    const res = await PUT(putReq, { params: { accountId: fakeId } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  it("PUT account belonging to another user → 404 (ownership enforced)", async () => {
    mockAuth(testUserId);

    const otherUser = await prisma.user.create({
      data: {
        email: `other-put-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash("TestPassword1!", 10),
        firstName: "Other",
        lastName: "User",
      },
    });

    const otherAccount = await prisma.foreignAccount.create({
      data: {
        ...defaultDbAccountFields(),
        userId: otherUser.id,
        calendarYear: 2024,
      },
    });

    const putReq = makePutRequest(otherAccount.id, { institutionName: "Hacked Bank" });
    const res = await PUT(putReq, { params: { accountId: otherAccount.id } });

    expect(res.status).toBe(404);

    // Cleanup
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("PUT with invalid accountType → 400", async () => {
    mockAuth(testUserId);

    const createRes = await POST(makePostRequest(defaultAccountData()));
    const { data: created } = await createRes.json();

    const putReq = makePutRequest(created.id, { accountType: "NOT_VALID" });
    const res = await PUT(putReq, { params: { accountId: created.id } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/validation failed/i);
  });
});

describe("PUT /api/accounts/[accountId] — field updates", () => {
  it("PUT updates institutionName, accountType, ownershipType fields correctly", async () => {
    mockAuth(testUserId);

    const createRes = await POST(makePostRequest(defaultAccountData()));
    const { data: created } = await createRes.json();

    const putReq = makePutRequest(created.id, {
      institutionName: "Renamed Bank",
      accountType: "SECURITIES",
      ownershipType: "SIGNATURE_AUTHORITY",
    });
    const res = await PUT(putReq, { params: { accountId: created.id } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.institutionName).toBe("Renamed Bank");
    expect(json.data.accountType).toBe("SECURITIES");
  });

  it("PUT response includes id, institutionName, accountType, countryCode, maxValueLocal", async () => {
    mockAuth(testUserId);

    const createRes = await POST(makePostRequest(defaultAccountData()));
    const { data: created } = await createRes.json();

    const putReq = makePutRequest(created.id, { maxValueLocal: 99999 });
    const res = await PUT(putReq, { params: { accountId: created.id } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty("id");
    expect(json.data).toHaveProperty("institutionName");
    expect(json.data).toHaveProperty("accountType");
    expect(json.data).toHaveProperty("countryCode");
    expect(json.data).toHaveProperty("maxValueLocal");
    expect(json.data.maxValueLocal).toBe(99999);
  });
});

describe("DELETE /api/accounts/[accountId] — account removal", () => {
  it("DELETE removes account from DB", async () => {
    mockAuth(testUserId);

    const createRes = await POST(makePostRequest(defaultAccountData()));
    const { data: created } = await createRes.json();

    const req = makeDeleteRequest(created.id);
    const res = await DELETE(req, { params: { accountId: created.id } });

    expect(res.status).toBe(200);

    const dbAccount = await prisma.foreignAccount.findUnique({
      where: { id: created.id },
    });
    expect(dbAccount).toBeNull();
  });

  it("DELETE returns success: true", async () => {
    mockAuth(testUserId);

    const createRes = await POST(makePostRequest(defaultAccountData()));
    const { data: created } = await createRes.json();

    const req = makeDeleteRequest(created.id);
    const res = await DELETE(req, { params: { accountId: created.id } });
    const json = await res.json();

    expect(json.success).toBe(true);
  });
});

describe("POST /api/accounts — countryCode and currencyCode normalization", () => {
  it("POST with lowercase countryCode → stored as uppercase", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest(defaultAccountData({ countryCode: "ch" })));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.countryCode).toBe("CH");
  });

  it("POST with lowercase currencyCode → stored as uppercase", async () => {
    mockAuth(testUserId);

    const res = await POST(makePostRequest(defaultAccountData({ currencyCode: "usd" })));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.currencyCode).toBe("USD");
  });
});

describe("GET /api/accounts — data filtering by calendarYear", () => {
  it("GET calendarYear=2024 returns only 2024 accounts, not 2023", async () => {
    mockAuth(testUserId);

    await prisma.foreignAccount.createMany({
      data: [
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2024, institutionName: "Bank 2024" },
        { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2023, institutionName: "Bank 2023" },
      ],
    });

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].institutionName).toBe("Bank 2024");
    expect(json.data[0].calendarYear).toBe(2024);
  });

  it("GET returns accounts ordered by createdAt ascending", async () => {
    mockAuth(testUserId);

    // Create accounts via direct DB insert to control ordering
    await prisma.foreignAccount.create({
      data: { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2024, institutionName: "First Bank" },
    });
    // Small delay to ensure createdAt differs
    await new Promise((r) => setTimeout(r, 5));
    await prisma.foreignAccount.create({
      data: { ...defaultDbAccountFields(), userId: testUserId, calendarYear: 2024, institutionName: "Second Bank" },
    });

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].institutionName).toBe("First Bank");
    expect(json.data[1].institutionName).toBe("Second Bank");
  });
});

describe("GET /api/accounts — response shape", () => {
  it("GET returns { data, priorYears } shape", async () => {
    mockAuth(testUserId);

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("priorYears");
    expect(Array.isArray(json.data)).toBe(true);
    expect(Array.isArray(json.priorYears)).toBe(true);
  });

  it("GET account data includes accountNumberLast4, not full account number", async () => {
    mockAuth(testUserId);

    await prisma.foreignAccount.create({
      data: {
        ...defaultDbAccountFields(),
        accountNumber: encrypt("9876543210"),
        userId: testUserId,
        calendarYear: 2024,
      },
    });

    const req = makeGetRequest({ calendarYear: "2024" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0]).toHaveProperty("accountNumberLast4");
    expect(json.data[0].accountNumberLast4).toBe("3210");
    expect(json.data[0]).not.toHaveProperty("accountNumber");
  });
});
