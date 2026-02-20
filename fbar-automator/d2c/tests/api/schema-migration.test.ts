import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `schema-migration-test-${Date.now()}@test.com`;
let testUserId: string;

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Schema",
      lastName: "Tester",
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  // Cascade deletes will remove related records
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up filings and statements created per-test
  await prisma.statement.deleteMany({ where: { userId: testUserId } });
  await prisma.filingYear.deleteMany({ where: { userId: testUserId } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

// IMPLEMENTATION NEEDED: P3-5 will add a `filingYear` relation on Statement
// (FK filingYearId already exists in the schema as a plain String field;
// P3-5 adds the Prisma @relation directive and the corresponding FilingYear
// has-many-statements relation). Until migration runs, the include below
// should already work since filingYearId column exists.

describe("P3-5: Statement.filingYear relation", () => {
  it("P3-5: Statement can be created with a filingYearId and includes filingYear relation", async () => {
    const filing = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        status: "IN_PROGRESS",
      },
    });

    const statement = await prisma.statement.create({
      data: {
        userId: testUserId,
        filingYearId: filing.id,
        filePath: "statements/test/doc.pdf",
        fileName: "doc.pdf",
        fileType: "application/pdf",
        fileSizeBytes: 1024,
        extractionStatus: "PENDING",
      },
    });

    expect(statement.filingYearId).toBe(filing.id);

    // IMPLEMENTATION NEEDED: P3-5 adds the @relation directive, making this
    // include work. Until then, Prisma will reject the `include`.
    const fetched = await prisma.statement.findUnique({
      where: { id: statement.id },
      include: { filingYear: true },
    });

    expect(fetched).not.toBeNull();
    expect(fetched!.filingYear).not.toBeNull();
    expect(fetched!.filingYear!.id).toBe(filing.id);
    expect(fetched!.filingYear!.calendarYear).toBe(2024);
  });

  it("P3-5: FilingYear can query its related statements", async () => {
    const filing = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        status: "IN_PROGRESS",
      },
    });

    await prisma.statement.createMany({
      data: [
        {
          userId: testUserId,
          filingYearId: filing.id,
          filePath: "statements/test/a.pdf",
          fileName: "a.pdf",
          fileType: "application/pdf",
          fileSizeBytes: 500,
        },
        {
          userId: testUserId,
          filingYearId: filing.id,
          filePath: "statements/test/b.pdf",
          fileName: "b.pdf",
          fileType: "application/pdf",
          fileSizeBytes: 600,
        },
      ],
    });

    // IMPLEMENTATION NEEDED: P3-5 adds statements relation on FilingYear model
    const filingWithStatements = await prisma.filingYear.findUnique({
      where: { id: filing.id },
      include: { statements: true },
    });

    expect(filingWithStatements).not.toBeNull();
    expect(filingWithStatements!.statements).toHaveLength(2);
  });
});

// IMPLEMENTATION NEEDED: P3-6 will add @@index([userId, status]) to FilingYear.
// The index is a performance optimization; queries by userId+status should work
// regardless, but we verify the query pattern works correctly.

describe("P3-6: FilingYear @@index([userId, status])", () => {
  it("P3-6: querying FilingYear by userId + status returns correct results", async () => {
    await prisma.filingYear.createMany({
      data: [
        { userId: testUserId, calendarYear: 2022, status: "ACCEPTED" },
        { userId: testUserId, calendarYear: 2023, status: "IN_PROGRESS" },
        { userId: testUserId, calendarYear: 2024, status: "ACCEPTED" },
      ],
    });

    const accepted = await prisma.filingYear.findMany({
      where: { userId: testUserId, status: "ACCEPTED" },
      orderBy: { calendarYear: "asc" },
    });

    expect(accepted).toHaveLength(2);
    expect(accepted[0].calendarYear).toBe(2022);
    expect(accepted[1].calendarYear).toBe(2024);
  });

  it("P3-6: querying FilingYear by userId + status returns empty array when no match", async () => {
    await prisma.filingYear.create({
      data: { userId: testUserId, calendarYear: 2024, status: "IN_PROGRESS" },
    });

    const submitted = await prisma.filingYear.findMany({
      where: { userId: testUserId, status: "SUBMITTED" },
    });

    expect(submitted).toEqual([]);
  });
});

describe("P3-5/P3-6: UTM columns on User accept strings up to 200 chars", () => {
  // IMPLEMENTATION NEEDED: P3-5/P3-6 migration may add @db.VarChar(200) limits
  // on UTM columns. These tests verify that 200-char strings persist correctly.

  it("P3-5: utmSource accepts a 200-character string", async () => {
    const longSource = "s".repeat(200);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmSource: longSource },
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmSource).toBe(longSource);

    // Clean up
    await prisma.user.update({
      where: { id: testUserId },
      data: { utmSource: null },
    });
  });

  it("P3-5: utmMedium accepts a 200-character string", async () => {
    const longMedium = "m".repeat(200);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmMedium: longMedium },
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmMedium).toBe(longMedium);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmMedium: null },
    });
  });

  it("P3-5: utmCampaign accepts a 200-character string", async () => {
    const longCampaign = "c".repeat(200);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmCampaign: longCampaign },
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmCampaign).toBe(longCampaign);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmCampaign: null },
    });
  });

  it("P3-5: utmContent accepts a 200-character string", async () => {
    const longContent = "n".repeat(200);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmContent: longContent },
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmContent).toBe(longContent);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmContent: null },
    });
  });

  it("P3-5: utmTerm accepts a 200-character string", async () => {
    const longTerm = "t".repeat(200);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmTerm: longTerm },
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmTerm).toBe(longTerm);

    await prisma.user.update({
      where: { id: testUserId },
      data: { utmTerm: null },
    });
  });

  it("P3-5: all five UTM columns accept strings simultaneously", async () => {
    const utmData = {
      utmSource: "google-ads-campaign-2024-q4-remarketing",
      utmMedium: "cpc-display-retargeting-network",
      utmCampaign: "fbar-direct-filing-tax-season-2025-launch",
      utmContent: "banner-ad-version-b-blue-cta-button",
      utmTerm: "fbar+filing+online+direct+irs+foreign+bank",
    };

    await prisma.user.update({
      where: { id: testUserId },
      data: utmData,
    });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user!.utmSource).toBe(utmData.utmSource);
    expect(user!.utmMedium).toBe(utmData.utmMedium);
    expect(user!.utmCampaign).toBe(utmData.utmCampaign);
    expect(user!.utmContent).toBe(utmData.utmContent);
    expect(user!.utmTerm).toBe(utmData.utmTerm);

    // Clean up
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
      },
    });
  });
});

describe("P3-5: Statement.fileName accepts strings up to 255 chars", () => {
  // IMPLEMENTATION NEEDED: P3-5 migration may add @db.VarChar(255) limit on
  // Statement.fileName. These tests verify boundary values persist correctly.

  it("P3-5: Statement.fileName accepts a 255-character filename", async () => {
    const filing = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        status: "IN_PROGRESS",
      },
    });

    // 255 chars: "x" * 251 + ".pdf"
    const longFileName = "x".repeat(251) + ".pdf";
    expect(longFileName.length).toBe(255);

    const statement = await prisma.statement.create({
      data: {
        userId: testUserId,
        filingYearId: filing.id,
        filePath: `statements/test/${longFileName}`,
        fileName: longFileName,
        fileType: "application/pdf",
        fileSizeBytes: 2048,
      },
    });

    const fetched = await prisma.statement.findUnique({
      where: { id: statement.id },
    });

    expect(fetched).not.toBeNull();
    expect(fetched!.fileName).toBe(longFileName);
    expect(fetched!.fileName.length).toBe(255);
  });

  it("P3-5: Statement.fileName handles typical real-world filenames", async () => {
    const filing = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        status: "IN_PROGRESS",
      },
    });

    const realWorldNames = [
      "HSBC-Premier-Account-Statement-2024-Q4-Final.pdf",
      "UBS Investment Portfolio Summary (CHF) - December 2024.pdf",
      "Deutsche Bank - Konto-Auszug Nr. 12345678 - 31.12.2024.pdf",
    ];

    for (const fileName of realWorldNames) {
      const statement = await prisma.statement.create({
        data: {
          userId: testUserId,
          filingYearId: filing.id,
          filePath: `statements/test/${fileName}`,
          fileName,
          fileType: "application/pdf",
          fileSizeBytes: 1024,
        },
      });

      const fetched = await prisma.statement.findUnique({
        where: { id: statement.id },
      });
      expect(fetched!.fileName).toBe(fileName);
    }
  });
});
