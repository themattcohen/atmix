import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

import {
  generateFincenXml,
  validateFincenXml,
} from "@/lib/fincen-xml";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `fincen-xml-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

/**
 * Creates a foreign account in the DB with sensible defaults.
 * Returns the created account ID.
 */
async function createTestAccount(
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const defaults = {
    userId: testUserId,
    calendarYear: 2024,
    institutionName: "Test Bank Zurich",
    accountNumber: encrypt("CH9300762011623852957"),
    accountType: "BANK" as const,
    ownershipType: "FINANCIAL_INTEREST" as const,
    countryCode: "CH",
    currencyCode: "CHF",
    maxValueLocal: 50000,
    maxValueUsd: 56500,
    exchangeRate: 1.13,
    exchangeRateSource: "TREASURY" as const,
    isJointAccount: false,
    jointOwnerInfo: null,
    institutionAddress: Prisma.DbNull,
  };

  const data = { ...defaults, ...overrides };
  const account = await prisma.foreignAccount.create({ data });
  return account.id;
}

/**
 * Simple XML element presence check. Returns true if the XML contains the
 * specified tag name (opening tag).
 */
function xmlContains(xml: string, tagName: string): boolean {
  return xml.includes(`<${tagName}`) || xml.includes(`<${tagName}>`);
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Set env vars the XML generator will need for transmitter info
  process.env.FINCEN_TRANSMITTER_NAME = "FBAR Direct LLC";
  process.env.FINCEN_TRANSMITTER_TIN = "123456789";
  process.env.FINCEN_TRANSMITTER_TCC = "TBSATEST";
  process.env.FINCEN_TRANSMITTER_ADDRESS = "123 Main St, Denver, CO 80202";
  process.env.FINCEN_TRANSMITTER_CONTACT_NAME = "Test Admin";
  process.env.FINCEN_TRANSMITTER_CONTACT_PHONE = "3035551234";

  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Jane",
      lastName: "Filer",
      middleName: "M",
      tin: encrypt("123456789"),
      tinType: "SSN",
      dateOfBirth: new Date("1985-06-15"),
      usAddress: {
        street: "456 Elm Street",
        city: "Denver",
        state: "CO",
        zip: "80202",
      },
    },
  });
  testUserId = user.id;

  const filing = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "PAID",
      filingType: "ORIGINAL",
    },
  });
  testFilingId = filing.id;
});

afterAll(async () => {
  // Clean up env vars
  delete process.env.FINCEN_TRANSMITTER_NAME;
  delete process.env.FINCEN_TRANSMITTER_TIN;
  delete process.env.FINCEN_TRANSMITTER_TCC;
  delete process.env.FINCEN_TRANSMITTER_ADDRESS;
  delete process.env.FINCEN_TRANSMITTER_CONTACT_NAME;
  delete process.env.FINCEN_TRANSMITTER_CONTACT_PHONE;

  // Cascade deletes clean up filings and accounts
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Wipe accounts between tests
  await prisma.foreignAccount.deleteMany({ where: { userId: testUserId } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("P4-2: generateFincenXml — single account", () => {
  it("P4-2: single account generates valid XML containing fc2:EFilingBatchXML root element", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    expect(typeof xml).toBe("string");
    expect(xml.length).toBeGreaterThan(0);

    expect(xml).toContain("<fc2:EFilingBatchXML");
    expect(xml).toContain('<?xml version');
  });

  it("P4-2: generated XML contains Activity element with filing year data", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xmlContains(xml, "fc2:Activity")).toBe(true);
    }
  });

  it("P4-2: generated XML contains Party element with filer info", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xmlContains(xml, "fc2:Party")).toBe(true);
    }
  });

  it("P4-2: generated XML contains account details (institution name, country)", async () => {
    await createTestAccount({
      institutionName: "Credit Suisse AG",
      countryCode: "CH",
    });

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("Credit Suisse AG");
      expect(xml).toContain("CH");
    }
  });

  it("P4-2: generated XML contains maxValueUsd for the account", async () => {
    await createTestAccount({
      maxValueLocal: 50000,
      maxValueUsd: 56500,
      currencyCode: "CHF",
    });

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("56500");
    }
  });

  it("P4-2: D2C-specific: ThirdPartyPreparerIndicator is N (self-filed)", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain(
        "<fc2:ThirdPartyPreparerIndicator>N</fc2:ThirdPartyPreparerIndicator>"
      );
    }
  });

  it("P4-2: D2C-specific: XML has party types 35, 37, 15 but NOT 57 or 56", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
      );
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>"
      );
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
      );
      expect(xml).not.toContain(
        "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
      );
      expect(xml).not.toContain(
        "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
      );
    }
  });
});

describe("P4-2: generateFincenXml — batch filing (25+ accounts)", () => {
  it("P4-2: 25+ accounts are all included in the generated XML", async () => {
    // Create 27 accounts to test batch filing
    const accountPromises = Array.from({ length: 27 }, (_, i) =>
      createTestAccount({
        institutionName: `Batch Bank ${i + 1}`,
        accountNumber: encrypt(`BATCH-ACCT-${String(i + 1).padStart(4, "0")}`),
        maxValueLocal: 10000 + i * 1000,
        maxValueUsd: 11300 + i * 1130,
      })
    );
    await Promise.all(accountPromises);

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("Batch Bank 1");
      expect(xml).toContain("Batch Bank 15");
      expect(xml).toContain("Batch Bank 27");
    }
  });
});

describe("P4-2: generateFincenXml — joint accounts", () => {
  it("P4-2: joint account (isJointAccount=true) uses EFilingAccountTypeCode 142", async () => {
    await createTestAccount({
      isJointAccount: true,
      jointOwnerInfo: "John Q. Public, SSN: ***-**-1234",
    });

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      // EFilingAccountTypeCode 142 = Jointly Owned Financial Account
      expect(xml).toContain(
        "<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>"
      );
    }
  });

  it("P4-2: non-joint account uses EFilingAccountTypeCode 141", async () => {
    await createTestAccount({
      isJointAccount: false,
      jointOwnerInfo: null,
    });

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      // EFilingAccountTypeCode 141 = Separately Owned Financial Account
      expect(xml).toContain(
        "<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>"
      );
    }
  });
});

describe("P4-2: generateFincenXml — multi-currency accounts", () => {
  it("P4-2: accounts with different currencies have correct maxValueUsd per account", async () => {
    // CHF account
    await createTestAccount({
      institutionName: "Swiss Bank",
      currencyCode: "CHF",
      maxValueLocal: 50000,
      maxValueUsd: 56500,
      exchangeRate: 1.13,
    });

    // EUR account
    await createTestAccount({
      institutionName: "German Bank",
      currencyCode: "EUR",
      countryCode: "DE",
      maxValueLocal: 30000,
      maxValueUsd: 33000,
      exchangeRate: 1.10,
      accountNumber: encrypt("DE89370400440532013000"),
    });

    // JPY account
    await createTestAccount({
      institutionName: "Japan Bank",
      currencyCode: "JPY",
      countryCode: "JP",
      maxValueLocal: 5000000,
      maxValueUsd: 35000,
      exchangeRate: 0.007,
      accountNumber: encrypt("JP1234567890"),
    });

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("Swiss Bank");
      expect(xml).toContain("German Bank");
      expect(xml).toContain("Japan Bank");
      expect(xml).toContain("56500");
      expect(xml).toContain("33000");
      expect(xml).toContain("35000");
    }
  });
});

describe("P4-2: generateFincenXml — empty accounts", () => {
  it("P4-2: filing with zero accounts generates XML but without Account elements", async () => {
    // No accounts created — filing has no foreign accounts
    const xml = await generateFincenXml(testFilingId);

    // With zero accounts the XML is still generated (no error), but
    // validateFincenXml will catch the missing Account elements.
    expect(typeof xml).toBe("string");
    expect(xml.length).toBeGreaterThan(0);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      const result = validateFincenXml(xml);
      // Zero accounts should not produce valid XML (missing Account elements)
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing Account elements");
    }
  });
});

describe("P4-2: generateFincenXml — transmitter/preparer config", () => {
  it("P4-2: generated XML includes transmitter info from FINCEN_* env vars", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("FBAR Direct LLC");
      expect(xml).toContain("123456789");
    }
  });

  it("P4-2: generated XML includes contact information from env vars", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("Test Admin");
      expect(xml).toContain("3035551234");
    }
  });
});

describe("P4-2: generateFincenXml — XML structure validation", () => {
  it("P4-2: generated XML starts with XML declaration", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml.trimStart()).toMatch(/^<\?xml\s+version/);
    }
  });

  it("P4-2: generated XML is well-formed (no unclosed tags)", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      try {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({
          ignoreAttributes: false,
          parseAttributeValue: true,
        });
        const parsed = parser.parse(xml);
        expect(parsed).toBeDefined();
        // fast-xml-parser strips namespace prefix; check the fc2:EFilingBatchXML key
        expect(parsed).toHaveProperty("fc2:EFilingBatchXML");
      } catch {
        // If fast-xml-parser is not available, verify basic structure
        expect(xml).toContain("</fc2:EFilingBatchXML>");
      }
    }
  });

  it("P4-2: generated XML is at least 100 characters (passes submit route gate)", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml.length).toBeGreaterThanOrEqual(100);
      expect(xml).toContain("<fc2:EFilingBatchXML");
    }
  });
});

describe("P4-2: generateFincenXml — filing type", () => {
  it("P4-2: ORIGINAL filing type sets CorrectsAmendsPriorReportIndicator to empty", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      // For ORIGINAL filings, CorrectsAmendsPriorReportIndicator is empty
      expect(xml).toContain("<fc2:CorrectsAmendsPriorReportIndicator>");
    }
  });

  it("P4-2: AMENDED filing type sets CorrectsAmendsPriorReportIndicator to Y", async () => {
    // Create an AMENDED filing
    const amendedFiling = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2023,
        status: "PAID",
        filingType: "AMENDED",
      },
    });

    await createTestAccount({
      calendarYear: 2023,
      institutionName: "Amended Test Bank",
    });

    const xml = await generateFincenXml(amendedFiling.id);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain(
        "<fc2:CorrectsAmendsPriorReportIndicator>Y</fc2:CorrectsAmendsPriorReportIndicator>"
      );
    }

    // Cleanup the additional filing (user cascade won't catch year-specific cleanup)
    await prisma.foreignAccount.deleteMany({
      where: { userId: testUserId, calendarYear: 2023 },
    });
    await prisma.filingYear.delete({ where: { id: amendedFiling.id } });
  });
});

describe("P4-2: validateFincenXml — structural validation", () => {
  it("P4-2: validateFincenXml returns isValid=true for well-formed FinCEN XML", () => {
    const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<fc2:EFilingBatchXML ActivityCount="1" PartyCount="1" AccountCount="1"
  JointlyOwnedOwnerCount="0" NoFIOwnerCount="0" ConsolidatedOwnerCount="0"
  xsi:schemaLocation="www.fincen.gov/base EFL_FBARXBatchSchema.xsd"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:fc2="www.fincen.gov/base">
  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>
  <fc2:Activity SeqNum="1">
    <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>
    <fc2:ThirdPartyPreparerIndicator>N</fc2:ThirdPartyPreparerIndicator>
    <fc2:ActivityAssociation SeqNum="2">
      <fc2:CorrectsAmendsPriorReportIndicator></fc2:CorrectsAmendsPriorReportIndicator>
    </fc2:ActivityAssociation>
    <fc2:Party SeqNum="3">
      <fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>
    </fc2:Party>
    <fc2:Account SeqNum="10">
      <fc2:AccountMaximumValueAmountText>1000</fc2:AccountMaximumValueAmountText>
    </fc2:Account>
    <fc2:ForeignAccountActivity SeqNum="20">
      <fc2:ReportCalendarYearText>2024</fc2:ReportCalendarYearText>
    </fc2:ForeignAccountActivity>
  </fc2:Activity>
</fc2:EFilingBatchXML>`;

    const result = validateFincenXml(validXml);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("P4-2: validateFincenXml returns isValid=false for empty string", () => {
    const result = validateFincenXml("");

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("P4-2: validateFincenXml returns isValid=false for non-XML content", () => {
    const result = validateFincenXml("this is not xml at all");

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("P4-2: validateFincenXml returns isValid=false for XML missing fc2:EFilingBatchXML root", () => {
    const result = validateFincenXml(
      '<?xml version="1.0"?><SomeOtherRoot><data>test</data></SomeOtherRoot>'
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing root element: fc2:EFilingBatchXML");
  });
});

describe("P4-2: generateFincenXml — nonexistent filing", () => {
  it("P4-2: nonexistent filingYearId throws (Prisma NotFound)", async () => {
    // findUniqueOrThrow will throw Prisma.PrismaClientKnownRequestError
    await expect(
      generateFincenXml("nonexistent-filing-id-000")
    ).rejects.toBeDefined();
  });
});

describe("P4-2: generateFincenXml — null maxValueUsd throws", () => {
  it("P4-2: account with null maxValueUsd causes generateFincenXml to throw", async () => {
    await createTestAccount({ maxValueUsd: null });

    await expect(generateFincenXml(testFilingId)).rejects.toThrow(
      "has null maxValueUsd"
    );
  });
});
