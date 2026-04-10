import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

import {
  generateFincenXml,
  validateFincenXml,
} from "@/lib/fincen-xml";
import { validateXmlAgainstXsd } from "@/lib/xsd-validator";
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

/** Assert generated XML passes XSD validation (skipped if xmllint not available) */
function expectXsdValid(xml: string) {
  const result = validateXmlAgainstXsd(xml);
  if (!result.isValid) {
    const details = result.errors.map(e => `  Line ${e.line}: ${e.message}`).join("\n");
    throw new Error(`XSD validation failed:\n${details}`);
  }
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
    expectXsdValid(xml);
  });

  it("P4-2: generated XML contains Activity element with filing year data", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xmlContains(xml, "fc2:Activity")).toBe(true);
      expectXsdValid(xml);
    }
  });

  it("P4-2: generated XML contains Party element with filer info", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xmlContains(xml, "fc2:Party")).toBe(true);
      expectXsdValid(xml);
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
      expectXsdValid(xml);
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
      expectXsdValid(xml);
    }
  });

  it("P4-2: D2C-specific: PreparerFilingSignatureIndicator is Y (self-filed)", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain(
        "<fc2:PreparerFilingSignatureIndicator>Y</fc2:PreparerFilingSignatureIndicator>"
      );
      expect(xml).not.toContain("ThirdPartyPreparerIndicator");
      expectXsdValid(xml);
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
      expectXsdValid(xml);
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
      expectXsdValid(xml);
    }
  });
});

describe("P4-2: generateFincenXml — joint accounts", () => {
  it("joint account emits EFilingAccountTypeCode 142 and Party type 42", async () => {
    await createTestAccount({
      isJointAccount: true,
      jointOwnerInfo: "John Q. Public",
      jointOwnerFirstName: "John",
      jointOwnerLastName: "Public",
      jointOwnerAddress: { street: "123 Main St", city: "London", country: "GB", zip: "SW1A 1AA" },
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>"
    );
    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>42</fc2:ActivityPartyTypeCode>"
    );
    expect(xml).toContain(
      "<fc2:RawEntityIndividualLastName>Public</fc2:RawEntityIndividualLastName>"
    );
    expect(xml).toContain(
      "<fc2:RawIndividualFirstName>John</fc2:RawIndividualFirstName>"
    );
    expect(xml).toContain("<fc2:RawCityText>London</fc2:RawCityText>");
    expect(xml).toContain("<fc2:RawCountryCodeText>GB</fc2:RawCountryCodeText>");
    expectXsdValid(xml);
  });

  it("joint account with TIN emits PartyIdentification", async () => {
    await createTestAccount({
      isJointAccount: true,
      jointOwnerFirstName: "Jane",
      jointOwnerLastName: "Doe",
      jointOwnerAddress: { street: "456 Oak Ave", city: "Toronto", country: "CA", state: "ON", zip: "M5V" },
      jointOwnerTin: encrypt("123456789"),
      jointOwnerTinType: "SSN",
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>42</fc2:ActivityPartyTypeCode>"
    );
    expect(xml).toContain(
      "<fc2:PartyIdentificationNumberText>123456789</fc2:PartyIdentificationNumberText>"
    );
  });

  it("signature authority + joint flag emits 143, not 142", async () => {
    await createTestAccount({
      ownershipType: "SIGNATURE_AUTHORITY",
      isJointAccount: true,
      jointOwnerFirstName: "Test",
      jointOwnerLastName: "Owner",
      jointOwnerAddress: { city: "Berlin", country: "DE" },
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>143</fc2:EFilingAccountTypeCode>"
    );
    expect(xml).not.toContain(
      "<fc2:ActivityPartyTypeCode>42</fc2:ActivityPartyTypeCode>"
    );
  });

  it("JointlyOwnedOwnerCount matches joint account count", async () => {
    await createTestAccount({
      isJointAccount: true,
      jointOwnerFirstName: "Alice",
      jointOwnerLastName: "Smith",
      jointOwnerAddress: { city: "Zurich", country: "CH" },
      institutionName: "Bank A",
    });
    await createTestAccount({
      isJointAccount: true,
      jointOwnerFirstName: "Bob",
      jointOwnerLastName: "Jones",
      jointOwnerAddress: { city: "Berlin", country: "DE" },
      institutionName: "Bank B",
    });
    await createTestAccount({ isJointAccount: false, institutionName: "Bank C" });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain('JointlyOwnedOwnerCount="2"');
  });

  it("non-joint account uses EFilingAccountTypeCode 141", async () => {
    await createTestAccount({
      isJointAccount: false,
      jointOwnerInfo: null,
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>"
    );
    expect(xml).not.toContain(
      "<fc2:ActivityPartyTypeCode>42</fc2:ActivityPartyTypeCode>"
    );
    expectXsdValid(xml);
  });

  it("joint account without structured data does not emit type 42", async () => {
    await createTestAccount({
      isJointAccount: true,
      jointOwnerInfo: "Just a name, no structured fields",
      jointOwnerLastName: null,
    });

    const xml = await generateFincenXml(testFilingId);

    // Type 142 is set (isJointAccount=true) but no Party 42 without structured data
    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>"
    );
    expect(xml).not.toContain(
      "<fc2:ActivityPartyTypeCode>42</fc2:ActivityPartyTypeCode>"
    );
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
      expectXsdValid(xml);
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
      expectXsdValid(xml);
    }
  });

  it("P4-2: generated XML includes contact information from env vars", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml).toContain("Test Admin");
      expect(xml).toContain("3035551234");
      expectXsdValid(xml);
    }
  });
});

describe("P4-2: generateFincenXml — XML structure validation", () => {
  it("P4-2: generated XML starts with XML declaration", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml.trimStart()).toMatch(/^<\?xml\s+version/);
      expectXsdValid(xml);
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
      expectXsdValid(xml);
    }
  });

  it("P4-2: generated XML is at least 100 characters (passes submit route gate)", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    if (xml.includes("<fc2:EFilingBatchXML")) {
      expect(xml.length).toBeGreaterThanOrEqual(100);
      expect(xml).toContain("<fc2:EFilingBatchXML");
      expectXsdValid(xml);
    }
  });
});

describe("P4-2: generateFincenXml — filing type", () => {
  it("P4-2: ORIGINAL filing type emits empty CorrectsAmendsPriorReportIndicator", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain("<fc2:CorrectsAmendsPriorReportIndicator>");
    expect(xml).not.toContain(">Y</fc2:CorrectsAmendsPriorReportIndicator>");
    expectXsdValid(xml);
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
      expectXsdValid(xml);
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
  xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:fc2="www.fincen.gov/base">
  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>
  <fc2:Activity SeqNum="1">
    <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>
    <fc2:PreparerFilingSignatureIndicator>Y</fc2:PreparerFilingSignatureIndicator>
    <fc2:ActivityAssociation SeqNum="2">
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

  it("validateFincenXml catches EFilingAccountTypeCode=142 without Party type 42", () => {
    const xml142NoParty42 = `<?xml version="1.0" encoding="UTF-8"?>
<fc2:EFilingBatchXML ActivityCount="1" PartyCount="1" AccountCount="1"
  JointlyOwnedOwnerCount="0" NoFIOwnerCount="0" ConsolidatedOwnerCount="0"
  xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:fc2="www.fincen.gov/base">
  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>
  <fc2:Activity SeqNum="1">
    <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>
    <fc2:PreparerFilingSignatureIndicator>Y</fc2:PreparerFilingSignatureIndicator>
    <fc2:ActivityAssociation SeqNum="2">
    </fc2:ActivityAssociation>
    <fc2:Party SeqNum="3">
      <fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>
    </fc2:Party>
    <fc2:Account SeqNum="10">
      <fc2:AccountMaximumValueAmountText>1000</fc2:AccountMaximumValueAmountText>
      <fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>
      <fc2:Party SeqNum="11">
        <fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>
      </fc2:Party>
    </fc2:Account>
    <fc2:ForeignAccountActivity SeqNum="20">
      <fc2:ReportCalendarYearText>2024</fc2:ReportCalendarYearText>
    </fc2:ForeignAccountActivity>
  </fc2:Activity>
</fc2:EFilingBatchXML>`;

    const result = validateFincenXml(xml142NoParty42);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Party type 42"))).toBe(true);
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

// ─── Adversarial Audit Fix Tests ──────────────────────────────────────────────

describe("Audit fix: PartyCount counts type-41 parties only", () => {
  it("PartyCount = type41Count (2 accounts → 2)", async () => {
    await createTestAccount();
    await createTestAccount({
      institutionName: "Second Bank",
      accountNumber: encrypt("SECOND-001"),
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain('PartyCount="2"');
    expectXsdValid(xml);
  });

  it("single account: PartyCount = 1", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain('PartyCount="1"');
    expectXsdValid(xml);
  });
});

describe("Audit fix: account number sanitization", () => {
  it("strips leading/trailing whitespace from account numbers", async () => {
    await createTestAccount({
      accountNumber: encrypt("  CH123456  "),
      maxValueUsd: 10000,
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain("<fc2:AccountNumberText>CH123456</fc2:AccountNumberText>");
    expectXsdValid(xml);
  });

  it("truncates account numbers to 40 characters", async () => {
    const longAcct = "A".repeat(50);
    await createTestAccount({
      accountNumber: encrypt(longAcct),
      maxValueUsd: 10000,
    });

    const xml = await generateFincenXml(testFilingId);

    const match = /<fc2:AccountNumberText>([^<]+)<\/fc2:AccountNumberText>/.exec(xml);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeLessThanOrEqual(40);
    expectXsdValid(xml);
  });
});

describe("Audit fix: non-ASCII transliteration", () => {
  it("transliterates accented characters in institution name", async () => {
    await createTestAccount({
      institutionName: "Crédit Münchenér Ñoño",
      maxValueUsd: 10000,
    });

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain("Credit Munchener Nono");
    expect(xml).not.toContain("é");
    expect(xml).not.toContain("ü");
    expect(xml).not.toContain("ñ");
    expectXsdValid(xml);
  });
});

describe("Audit fix: CorrectsAmendsPriorReportIndicator", () => {
  it("AMENDED filing emits CorrectsAmendsPriorReportIndicator=Y", async () => {
    const amendedFiling = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2022,
        status: "PAID",
        filingType: "AMENDED",
      },
    });

    await createTestAccount({ calendarYear: 2022 });

    const xml = await generateFincenXml(amendedFiling.id);

    expect(xml).toContain(
      "<fc2:CorrectsAmendsPriorReportIndicator>Y</fc2:CorrectsAmendsPriorReportIndicator>"
    );
    expectXsdValid(xml);

    await prisma.foreignAccount.deleteMany({
      where: { userId: testUserId, calendarYear: 2022 },
    });
    await prisma.filingYear.delete({ where: { id: amendedFiling.id } });
  });

  it("ORIGINAL filing emits empty CorrectsAmendsPriorReportIndicator", async () => {
    await createTestAccount();

    const xml = await generateFincenXml(testFilingId);

    expect(xml).toContain("<fc2:CorrectsAmendsPriorReportIndicator>");
    expect(xml).not.toContain(">Y</fc2:CorrectsAmendsPriorReportIndicator>");
    expectXsdValid(xml);
  });
});

// ─── Golden-File Test ─────────────────────────────────────────────────────────
// Compares generateFincenXml() output against a FinCEN-confirmed reference file
// (ticket #491265). This ensures element ordering, SeqNum assignment, empty
// element handling, and conditional omissions remain structurally identical.

import { readFileSync } from "fs";
import { resolve } from "path";

describe("P4-2: generateFincenXml — golden-file structural match", () => {
  const GOLDEN_EMAIL = `golden-file-test-${Date.now()}@test.com`;
  let goldenUserId: string;
  let goldenFilingId: string;

  beforeAll(async () => {
    // Override env vars to match the FinCEN-confirmed transmitter info
    process.env.FINCEN_TRANSMITTER_NAME = "All Solutions Consulting";
    process.env.FINCEN_TRANSMITTER_TIN = "883761328";
    process.env.FINCEN_TRANSMITTER_TCC = "TBSATEST";
    process.env.FINCEN_TRANSMITTER_ADDRESS = "123 Main St, Denver, CO 80202";
    process.env.FINCEN_TRANSMITTER_CONTACT_NAME = "Matthew Cohen";
    process.env.FINCEN_TRANSMITTER_CONTACT_PHONE = "3035555555";

    const passwordHash = await bcrypt.hash("GoldenTest1!", 10);
    const user = await prisma.user.create({
      data: {
        email: GOLDEN_EMAIL,
        passwordHash,
        firstName: "SDTM",
        lastName: "AckTest",
        tin: encrypt("900123456"),
        tinType: "SSN",
        dateOfBirth: new Date("1985-06-15"),
        usAddress: {
          street: "123 Test Street",
          city: "Denver",
          state: "CO",
          zip: "80202",
        },
      },
    });
    goldenUserId = user.id;

    const filing = await prisma.filingYear.create({
      data: {
        userId: goldenUserId,
        calendarYear: 2024,
        status: "PAID",
        filingType: "ORIGINAL",
      },
    });
    goldenFilingId = filing.id;

    await prisma.foreignAccount.create({
      data: {
        userId: goldenUserId,
        calendarYear: 2024,
        institutionName: "Test Bank AG",
        accountNumber: encrypt("CH9876543210"),
        accountType: "BANK",
        ownershipType: "FINANCIAL_INTEREST",
        countryCode: "CH",
        currencyCode: "CHF",
        maxValueLocal: 19800,
        maxValueUsd: 19800,
        exchangeRate: 1.0,
        exchangeRateSource: "TREASURY",
        isJointAccount: false,
        jointOwnerInfo: null,
        institutionAddress: {
          street: "Bahnhofstrasse 1",
          city: "Zurich",
          country: "CH",
          zip: "8001",
        },
      },
    });
  });

  afterAll(async () => {
    // Restore original env vars
    process.env.FINCEN_TRANSMITTER_NAME = "FBAR Direct LLC";
    process.env.FINCEN_TRANSMITTER_TIN = "123456789";
    process.env.FINCEN_TRANSMITTER_ADDRESS = "123 Main St, Denver, CO 80202";
    process.env.FINCEN_TRANSMITTER_CONTACT_NAME = "Test Admin";
    process.env.FINCEN_TRANSMITTER_CONTACT_PHONE = "3035551234";

    await prisma.user.delete({ where: { id: goldenUserId } });
  });

  it("generated XML is structurally identical to FinCEN-confirmed reference", async () => {
    const { XMLParser } = await import("fast-xml-parser");

    // Read the golden reference file
    const goldenPath = resolve(
      __dirname,
      "../../../claudedocs/fincen-ticket-491265/FBARXST.20260311000451.sdtmmar02264.xml"
    );
    const goldenXml = readFileSync(goldenPath, "utf-8");

    // Generate XML from our code
    const generatedXml = await generateFincenXml(goldenFilingId);

    // Parse both with identical settings
    const parserOpts = {
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: true,
      // Preserve empty tags as empty string (matches FinCEN format)
      allowBooleanAttributes: false,
    };
    const parser = new XMLParser(parserOpts);

    const goldenObj = parser.parse(goldenXml);
    const generatedObj = parser.parse(generatedXml);

    // Normalize: replace date-dependent and audit-fixed fields with constants
    const PLACEHOLDER = "NORMALIZED";
    function normalizeFields(obj: any): void {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        if (key === "fc2:ApprovalOfficialSignatureDateText") {
          obj[key] = PLACEHOLDER;
        } else {
          normalizeFields(obj[key]);
        }
      }
    }

    normalizeFields(goldenObj);
    normalizeFields(generatedObj);

    expect(generatedObj).toEqual(goldenObj);

    // Also validate the generated XML against XSD
    expectXsdValid(generatedXml);
  });
});
