import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

// Mock auth BEFORE importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/accounts/import/route";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { encrypt, safeDecrypt } from "@/lib/encryption";
import { Prisma } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3001/api/accounts/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

// Default account fields used across tests
function defaultAccountFields() {
  return {
    institutionName: "Test Bank",
    accountNumber: encrypt("ACC123"),
    accountType: "BANK" as const,
    ownershipType: "FINANCIAL_INTEREST" as const,
    countryCode: "CH",
    currencyCode: "CHF",
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

let testUser: { id: string; email: string };

beforeAll(async () => {
  const email = `test-import-${Date.now()}@test.com`;
  const passwordHash = await bcrypt.hash("TestPassword1", 10);
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
  // Cascade deletes will clean up accounts and filings
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up all accounts and filings between tests to avoid interference
  await prisma.foreignAccount.deleteMany({ where: { userId: testUser.id } });
  await prisma.filingYear.deleteMany({ where: { userId: testUser.id } });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/accounts/import", () => {
  it("1. happy path: 3 source accounts → 3 imported", async () => {
    mockAuth(testUser.id);

    // Create active filing for 2025
    await prisma.filingYear.create({
      data: {
        userId: testUser.id,
        calendarYear: 2025,
        status: "IN_PROGRESS",
      },
    });

    // Create 3 source accounts for 2024
    await prisma.foreignAccount.createMany({
      data: [
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "Bank Alpha" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "Bank Beta" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "Bank Gamma" },
      ],
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.importedCount).toBe(3);
    expect(json.data).toHaveLength(3);

    const names = json.data.map((a: { institutionName: string }) => a.institutionName).sort();
    expect(names).toEqual(["Bank Alpha", "Bank Beta", "Bank Gamma"]);
  });

  it("2. encrypted integrity: decrypt(imported.accountNumber) === decrypt(source.accountNumber)", async () => {
    mockAuth(testUser.id);

    const knownAccountNumber = "SECRET-ACC-9876";
    const encryptedAccountNumber = encrypt(knownAccountNumber);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    const sourceAccount = await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        accountNumber: encryptedAccountNumber,
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    // Fetch the imported account from DB
    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(targetAccount).not.toBeNull();
    const decryptedSource = safeDecrypt(sourceAccount.accountNumber);
    const decryptedTarget = safeDecrypt(targetAccount!.accountNumber);
    expect(decryptedTarget).toBe(decryptedSource);
    expect(decryptedTarget).toBe(knownAccountNumber);
  });

  it("3. institutionAddress JSON preserved (non-null source)", async () => {
    mockAuth(testUser.id);

    const address = { street: "123 Main", city: "Zurich", country: "CH" };

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        institutionAddress: address,
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(targetAccount!.institutionAddress).toEqual(address);
  });

  it("4. institutionAddress null on source → null on import", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        institutionAddress: Prisma.DbNull,
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(targetAccount!.institutionAddress).toBeNull();
  });

  it("5. joint account fields preserved", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        isJointAccount: true,
        jointOwnerInfo: "Jane Doe",
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(targetAccount!.isJointAccount).toBe(true);
    expect(targetAccount!.jointOwnerInfo).toBe("Jane Doe");
  });

  it("6. no source accounts → importedCount=0, status 200", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    // No accounts created for 2024

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.importedCount).toBe(0);
    expect(json.data).toEqual([]);
  });

  it("7. target year already has accounts → 409", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    // Create source accounts for 2024
    await prisma.foreignAccount.create({
      data: { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024 },
    });

    // Create existing target accounts for 2025
    await prisma.foreignAccount.create({
      data: { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2025 },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(409);
  });

  it("8. no active filing → 400", async () => {
    mockAuth(testUser.id);

    // No filings created for this user

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/no active filing/i);
  });

  it("9. unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(401);
  });

  it("10. financial fields reset: maxValueLocal=0, maxValueUsd=null, exchangeRate=null", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        maxValueLocal: 50000,
        maxValueUsd: 40000,
        exchangeRate: 0.8,
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(Number(targetAccount!.maxValueLocal)).toBe(0);
    expect(targetAccount!.maxValueUsd).toBeNull();
    expect(targetAccount!.exchangeRate).toBeNull();
  });

  it("11. exchangeRateSource=null on imports", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: {
        ...defaultAccountFields(),
        userId: testUser.id,
        calendarYear: 2024,
        exchangeRateSource: "TREASURY",
      },
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res.status).toBe(201);

    const targetAccount = await prisma.foreignAccount.findFirst({
      where: { userId: testUser.id, calendarYear: 2025 },
    });

    expect(targetAccount!.exchangeRateSource).toBeNull();
  });

  it("12. duplicate import (second call) → 409", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    await prisma.foreignAccount.create({
      data: { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024 },
    });

    // First import should succeed
    const res1 = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res1.status).toBe(201);

    // Second import should conflict
    const res2 = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    expect(res2.status).toBe(409);
  });

  it("13. multi-year: sourceYear=2024 copies only 2024 accounts, not 2023", async () => {
    mockAuth(testUser.id);

    await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    // Create 2 accounts for 2023 and 3 accounts for 2024
    await prisma.foreignAccount.createMany({
      data: [
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2023, institutionName: "Old Bank A" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2023, institutionName: "Old Bank B" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "New Bank A" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "New Bank B" },
        { ...defaultAccountFields(), userId: testUser.id, calendarYear: 2024, institutionName: "New Bank C" },
      ],
    });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.importedCount).toBe(3);
    expect(json.data).toHaveLength(3);

    const names = json.data.map((a: { institutionName: string }) => a.institutionName).sort();
    expect(names).toEqual(["New Bank A", "New Bank B", "New Bank C"]);
  });

  it("14. 25+ accounts sets has25PlusAccounts=true on filing", async () => {
    mockAuth(testUser.id);

    const filing = await prisma.filingYear.create({
      data: { userId: testUser.id, calendarYear: 2025, status: "IN_PROGRESS" },
    });

    // Create exactly 25 source accounts for 2024
    const accounts = Array.from({ length: 25 }, (_, i) => ({
      ...defaultAccountFields(),
      userId: testUser.id,
      calendarYear: 2024,
      institutionName: `Bank ${i + 1}`,
    }));

    await prisma.foreignAccount.createMany({ data: accounts });

    const res = await POST(makeRequest({ sourceCalendarYear: 2024 }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.importedCount).toBe(25);

    // Verify filing flag was set
    const updatedFiling = await prisma.filingYear.findUnique({
      where: { id: filing.id },
    });

    expect(updatedFiling!.has25PlusAccounts).toBe(true);
  });
});
