import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ReviewSummary } from "@/lib/approval"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFindUniqueOrThrow } = vi.hoisted(() => ({
  mockFindUniqueOrThrow: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    filingYear: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
    },
  },
}))

vi.mock("@/lib/approval", () => ({
  getReviewSummary: vi.fn(),
}))

vi.mock("@/lib/encryption", () => ({
  safeDecrypt: (value: string) => value, // passthrough — test data is already plain
}))

import {
  generateFincenXml,
  validateFincenXml,
  type TransmitterConfig,
  type PreparerConfig,
} from "@/lib/export/fincen-xml"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockTransmitter(): TransmitterConfig {
  return {
    name: "Test Tax Firm LLC",
    tin: "12-3456789",
    tcc: "PTCC1234",
    phone: "555-123-4567",
    address: { street: "123 Main St", city: "New York", state: "NY", zip: "10001" },
    contactName: "John Smith",
  }
}

function createMockPreparer(): PreparerConfig {
  return {
    firstName: "John",
    lastName: "Smith",
    phone: "555-123-4567",
    ptin: "P12345678",
    selfEmployed: false,
    address: { street: "123 Main St", city: "New York", state: "NY", zip: "10001" },
    firmName: "Test Tax Firm LLC",
    firmEin: "12-3456789",
  }
}

function createMockReviewSummary(
  overrides: Partial<ReviewSummary> = {}
): ReviewSummary {
  return {
    filingYear: { id: "fy-1", calendarYear: 2024, status: "EXPORTED" },
    client: {
      id: "c-1",
      firstName: "John",
      lastName: "Doe",
      tin: "123456789",
      tinType: "SSN",
    },
    accounts: [
      {
        foreignAccountId: "fa-1",
        institutionName: "Swiss Bank Corp",
        accountNumber: "CH-123456",
        accountType: "BANK",
        country: "CH",
        maxValueLocal: 50000,
        currencyCode: "CHF",
        exchangeRate: 0.88,
        maxValueUsd: 56818,
        isValueUnknown: false,
        reviewedAt: new Date("2024-06-15"),
        reviewedBy: "Jane Smith",
        corrections: null,
      },
      {
        foreignAccountId: "fa-2",
        institutionName: "Tokyo Securities",
        accountNumber: "JP-789012",
        accountType: "SECURITIES",
        country: "JP",
        maxValueLocal: 5000000,
        currencyCode: "JPY",
        exchangeRate: 148.5,
        maxValueUsd: 33670,
        isValueUnknown: false,
        reviewedAt: new Date("2024-06-16"),
        reviewedBy: "Jane Smith",
        corrections: null,
      },
    ],
    aggregateMaxValueUSD: 90488,
    exceedsThreshold: true,
    ...overrides,
  }
}

function createMockFilingYear() {
  return {
    id: "fy-1",
    calendarYear: 2024,
    status: "EXPORTED",
    clientId: "c-1",
    has25PlusAccounts: false,
    filingType: "INITIAL",
    client: {
      id: "c-1",
      firstName: "John",
      lastName: "Doe",
      tin: "123456789",
      tinType: "SSN",
      type: "INDIVIDUAL",
      dateOfBirth: new Date("1985-03-15"),
      usAddress: {
        street: "123 Main Street",
        city: "New York",
        state: "NY",
        zip: "10001",
      },
    },
    reviewedAccountYears: [
      {
        id: "ray-1",
        foreignAccountId: "fa-1",
        maxValueLocal: 50000,
        maxValueUsd: 56818,
        isValueUnknown: false,
        currencyCode: "CHF",
        exchangeRate: 0.88,
        foreignAccount: {
          id: "fa-1",
          institutionName: "Swiss Bank Corp",
          accountNumber: "CH-123456",
          accountType: "BANK",
          ownershipType: "FINANCIAL_INTEREST",
          isJointlyOwned: false,
          institutionAddressStreet: "Bahnhofstrasse 1",
          institutionAddressCity: "Zurich",
          institutionAddressState: "ZH",
          institutionAddressCountry: "CH",
          institutionAddressPostal: "8001",
        },
      },
      {
        id: "ray-2",
        foreignAccountId: "fa-2",
        maxValueLocal: 5000000,
        maxValueUsd: 33670,
        isValueUnknown: false,
        currencyCode: "JPY",
        exchangeRate: 148.5,
        foreignAccount: {
          id: "fa-2",
          institutionName: "Tokyo Securities",
          accountNumber: "JP-789012",
          accountType: "SECURITIES",
          ownershipType: "FINANCIAL_INTEREST",
          isJointlyOwned: false,
          institutionAddressStreet: "1-2-3 Marunouchi",
          institutionAddressCity: "Tokyo",
          institutionAddressState: "",
          institutionAddressCountry: "JP",
          institutionAddressPostal: "100-0005",
        },
      },
    ],
  }
}

/** Generates XML from mock data for reuse across tests. */
async function generateTestXml(
  overrides?: {
    filingYear?: ReturnType<typeof createMockFilingYear>
    summary?: ReviewSummary
    transmitter?: TransmitterConfig
    preparer?: PreparerConfig
  }
) {
  const filingYear = overrides?.filingYear ?? createMockFilingYear()
  const summary = overrides?.summary ?? createMockReviewSummary()
  const transmitter = overrides?.transmitter ?? createMockTransmitter()
  const preparer = overrides?.preparer ?? createMockPreparer()

  mockFindUniqueOrThrow.mockResolvedValue(filingYear)

  return generateFincenXml("fy-1", transmitter, preparer, summary)
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// 1. XML Structure Tests
// ===========================================================================

describe("XML structure", () => {
  it("root element is fc2:EFilingBatchXML with correct attributes", async () => {
    const xml = await generateTestXml()

    expect(xml).toContain("<fc2:EFilingBatchXML")
    expect(xml).toContain('ActivityCount="1"')
    expect(xml).toContain('xmlns:fc2="www.fincen.gov/base"')
    expect(xml).toContain("xmlns:xsi=")
    expect(xml).toContain(
      'xsi:schemaLocation="www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"'
    )
  })

  it("FormTypeCode is FBARX", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>"
    )
  })

  it("Activity contains parties in correct order: 35, 37, 15, 57, 56", async () => {
    const xml = await generateTestXml()

    const type35Pos = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
    )
    const type37Pos = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>"
    )
    const type15Pos = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Pos = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const type56Pos = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )

    expect(type35Pos).toBeGreaterThan(-1)
    expect(type37Pos).toBeGreaterThan(-1)
    expect(type15Pos).toBeGreaterThan(-1)
    expect(type57Pos).toBeGreaterThan(-1)
    expect(type56Pos).toBeGreaterThan(-1)

    // Verify ordering
    expect(type35Pos).toBeLessThan(type37Pos)
    expect(type37Pos).toBeLessThan(type15Pos)
    expect(type15Pos).toBeLessThan(type57Pos)
    expect(type57Pos).toBeLessThan(type56Pos)
  })

  it("Accounts are siblings of Party inside Activity (not nested in Party)", async () => {
    const xml = await generateTestXml()

    // Account elements should exist as fc2:Account
    expect(xml).toContain("<fc2:Account ")

    // Account should NOT be nested inside an activity-level Party.
    // The FI party (type 41) should be INSIDE Account, not the reverse.
    // Verify that fc2:Account contains fc2:Party with type 41
    const accountSections = xml.split("<fc2:Account ")
    // First element is before the first Account, skip it
    for (let i = 1; i < accountSections.length; i++) {
      const section = accountSections[i].split("</fc2:Account>")[0]
      expect(section).toContain(
        "<fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>"
      )
    }
  })

  it("ForeignAccountActivity exists with ReportCalendarYearText", async () => {
    const xml = await generateTestXml()

    expect(xml).toContain("<fc2:ForeignAccountActivity")
    expect(xml).toContain(
      "<fc2:ReportCalendarYearText>2024</fc2:ReportCalendarYearText>"
    )
  })

  it("no FilingDateText element exists", async () => {
    const xml = await generateTestXml()
    expect(xml).not.toContain("FilingDateText")
  })

  it("no PartyAccountAssociation element exists", async () => {
    const xml = await generateTestXml()
    expect(xml).not.toContain("PartyAccountAssociation")
  })

  it("no StatusCode or TotalAmount on root", async () => {
    const xml = await generateTestXml()
    expect(xml).not.toContain("StatusCode")
    expect(xml).not.toContain("TotalAmount")
  })

  it("ThirdPartyPreparerIndicator is Y", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:ThirdPartyPreparerIndicator>Y</fc2:ThirdPartyPreparerIndicator>"
    )
  })

  it("EFilingPriorDocumentNumber is present (empty for original)", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain("<fc2:EFilingPriorDocumentNumber")
  })
})

// ===========================================================================
// 2. Party Type Tests
// ===========================================================================

describe("Party type tests", () => {
  it("Transmitter party has ActivityPartyTypeCode 35", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
    )
  })

  it("Transmitter has TIN type 4 (EIN) and type 28 (TCC)", async () => {
    const xml = await generateTestXml()

    // Find the transmitter party section (type 35)
    const type35Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
    )
    // Find the next party to bound the section
    const nextPartyAfter35 = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>"
    )
    const transmitterSection = xml.slice(type35Start, nextPartyAfter35)

    expect(transmitterSection).toContain(
      "<fc2:PartyIdentificationTypeCode>4</fc2:PartyIdentificationTypeCode>"
    )
    expect(transmitterSection).toContain(
      "<fc2:PartyIdentificationTypeCode>28</fc2:PartyIdentificationTypeCode>"
    )
    // TCC value should be present
    expect(transmitterSection).toContain("PTCC1234")
  })

  it("Transmitter has name and address and phone", async () => {
    const xml = await generateTestXml()

    const type35Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
    )
    const nextPartyAfter35 = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>"
    )
    const transmitterSection = xml.slice(type35Start, nextPartyAfter35)

    expect(transmitterSection).toContain("Test Tax Firm LLC")
    expect(transmitterSection).toContain("<fc2:Address")
    expect(transmitterSection).toContain("<fc2:PhoneNumber")
  })

  it("Transmitter Contact party has ActivityPartyTypeCode 37 with name only", async () => {
    const xml = await generateTestXml()

    const type37Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>"
    )
    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const contactSection = xml.slice(type37Start, type15Start)

    expect(contactSection).toContain("John") // contactName first
    expect(contactSection).toContain("Smith") // contactName last
    expect(contactSection).toContain("<fc2:PartyName")
  })

  it("Filer party has ActivityPartyTypeCode 15 (not 35)", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
  })

  it("Filer has FilerFinancialInterest25ForeignAccountIndicator", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:FilerFinancialInterest25ForeignAccountIndicator>"
    )
  })

  it("Filer has FilerTypeIndividualIndicator", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:FilerTypeIndividualIndicator>Y</fc2:FilerTypeIndividualIndicator>"
    )
  })

  it("Filer has SignatureAuthoritiesIndicator", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain("<fc2:SignatureAuthoritiesIndicator>")
  })

  it("Filer has IndividualBirthDateText", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:IndividualBirthDateText>19850315</fc2:IndividualBirthDateText>"
    )
  })

  it("Filer name uses RawEntityIndividualLastName (not RawIndividualLastName)", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain("<fc2:RawEntityIndividualLastName>Doe</fc2:RawEntityIndividualLastName>")
    expect(filerSection).not.toContain("<fc2:RawIndividualLastName>")
  })

  it("Filer has address with correct elements", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain("<fc2:RawStreetAddress1Text>123 Main Street</fc2:RawStreetAddress1Text>")
    expect(filerSection).toContain("<fc2:RawCityText>New York</fc2:RawCityText>")
    expect(filerSection).toContain("<fc2:RawStateCodeText>NY</fc2:RawStateCodeText>")
    expect(filerSection).toContain("<fc2:RawZIPCode>10001</fc2:RawZIPCode>")
    expect(filerSection).toContain("<fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>")
  })

  it("Filer TIN is unmasked in XML", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:PartyIdentificationNumberText>123456789</fc2:PartyIdentificationNumberText>"
    )
  })

  it("Preparer party has ActivityPartyTypeCode 57", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
  })

  it("Preparer has PTIN with type 31", async () => {
    const xml = await generateTestXml()

    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const type56Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )
    const preparerSection = xml.slice(type57Start, type56Start)

    expect(preparerSection).toContain(
      "<fc2:PartyIdentificationTypeCode>31</fc2:PartyIdentificationTypeCode>"
    )
    expect(preparerSection).toContain("P12345678")
  })

  it("Preparer has name, address, and phone", async () => {
    const xml = await generateTestXml()

    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const type56Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )
    const preparerSection = xml.slice(type57Start, type56Start)

    expect(preparerSection).toContain("<fc2:RawEntityIndividualLastName>Smith</fc2:RawEntityIndividualLastName>")
    expect(preparerSection).toContain("<fc2:RawIndividualFirstName>John</fc2:RawIndividualFirstName>")
    expect(preparerSection).toContain("<fc2:Address")
    expect(preparerSection).toContain("<fc2:PhoneNumber")
  })

  it("Preparer firm has ActivityPartyTypeCode 56 when not self-employed", async () => {
    const xml = await generateTestXml()

    expect(xml).toContain(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )

    // Find firm section
    const type56Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )
    const firmSection = xml.slice(type56Start)

    expect(firmSection).toContain("Test Tax Firm LLC")
    expect(firmSection).toContain("12-3456789")
  })

  it("Preparer firm (type 56) is omitted when self-employed", async () => {
    const selfEmployedPreparer = createMockPreparer()
    selfEmployedPreparer.selfEmployed = true
    selfEmployedPreparer.firmName = undefined
    selfEmployedPreparer.firmEin = undefined

    const xml = await generateTestXml({ preparer: selfEmployedPreparer })

    expect(xml).not.toContain(
      "<fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>"
    )
  })

  it("Financial Institution has ActivityPartyTypeCode 41 inside Account", async () => {
    const xml = await generateTestXml()

    // Type 41 should be inside Account elements
    const accountSections = xml.split("<fc2:Account ")
    for (let i = 1; i < accountSections.length; i++) {
      const section = accountSections[i].split("</fc2:Account>")[0]
      expect(section).toContain(
        "<fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>"
      )
    }
  })

  it("Financial Institution party has name and address", async () => {
    const xml = await generateTestXml()

    expect(xml).toContain(
      "<fc2:RawPartyLegalName>Swiss Bank Corp</fc2:RawPartyLegalName>"
    )
    expect(xml).toContain(
      "<fc2:RawPartyLegalName>Tokyo Securities</fc2:RawPartyLegalName>"
    )
  })
})

// ===========================================================================
// 3. AccountTypeCode Tests
// ===========================================================================

describe("AccountTypeCode mapping", () => {
  it("BANK maps to AccountTypeCode 1", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:AccountTypeCode>1</fc2:AccountTypeCode>"
    )
  })

  it("SECURITIES maps to AccountTypeCode 2", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain(
      "<fc2:AccountTypeCode>2</fc2:AccountTypeCode>"
    )
  })

  it("OTHER maps to AccountTypeCode 999", async () => {
    const filingYear = createMockFilingYear()
    filingYear.reviewedAccountYears = [
      {
        id: "ray-3",
        foreignAccountId: "fa-3",
        maxValueLocal: 100000,
        maxValueUsd: 100000,
        isValueUnknown: false,
        currencyCode: "USD",
        exchangeRate: 1.0,
        foreignAccount: {
          id: "fa-3",
          institutionName: "Cayman Fund LLC",
          accountNumber: "KY-555666",
          accountType: "OTHER",
          ownershipType: "FINANCIAL_INTEREST",
          isJointlyOwned: false,
          institutionAddressStreet: "PO Box 1234",
          institutionAddressCity: "George Town",
          institutionAddressState: "",
          institutionAddressCountry: "KY",
          institutionAddressPostal: "KY1-1234",
        },
      },
    ]

    const summary = createMockReviewSummary({
      accounts: [
        {
          foreignAccountId: "fa-3",
          institutionName: "Cayman Fund LLC",
          accountNumber: "KY-555666",
          accountType: "OTHER",
          country: "KY",
          maxValueLocal: 100000,
          currencyCode: "USD",
          exchangeRate: 1.0,
          maxValueUsd: 100000,
          isValueUnknown: false,
          reviewedAt: new Date("2024-06-17"),
          reviewedBy: "Jane Smith",
          corrections: null,
        },
      ],
      aggregateMaxValueUSD: 100000,
    })

    const xml = await generateTestXml({ filingYear, summary })
    expect(xml).toContain(
      "<fc2:AccountTypeCode>999</fc2:AccountTypeCode>"
    )
  })
})

// ===========================================================================
// 4. EFilingAccountTypeCode Tests
// ===========================================================================

describe("EFilingAccountTypeCode mapping", () => {
  it("FINANCIAL_INTEREST (not joint) maps to 141", async () => {
    const xml = await generateTestXml()
    // Default mock accounts are FINANCIAL_INTEREST, not jointly owned
    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>"
    )
  })

  it("Joint ownership maps to 142", async () => {
    const filingYear = createMockFilingYear()
    filingYear.reviewedAccountYears[0].foreignAccount.isJointlyOwned = true

    const xml = await generateTestXml({ filingYear })
    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>"
    )
  })

  it("SIGNATURE_AUTHORITY maps to 143", async () => {
    const filingYear = createMockFilingYear()
    filingYear.reviewedAccountYears[0].foreignAccount.ownershipType =
      "SIGNATURE_AUTHORITY"

    const xml = await generateTestXml({ filingYear })
    expect(xml).toContain(
      "<fc2:EFilingAccountTypeCode>143</fc2:EFilingAccountTypeCode>"
    )
  })
})

// ===========================================================================
// 5. TIN Type Code Tests
// ===========================================================================

describe("TIN type code mapping", () => {
  it("SSN maps to PartyIdentificationTypeCode 1", async () => {
    const xml = await generateTestXml()

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:PartyIdentificationTypeCode>1</fc2:PartyIdentificationTypeCode>"
    )
  })

  it("ITIN maps to PartyIdentificationTypeCode 1", async () => {
    const filingYear = createMockFilingYear()
    filingYear.client.tinType = "ITIN"

    const xml = await generateTestXml({ filingYear })

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:PartyIdentificationTypeCode>1</fc2:PartyIdentificationTypeCode>"
    )
  })

  it("EIN maps to PartyIdentificationTypeCode 2", async () => {
    const filingYear = createMockFilingYear()
    filingYear.client.tinType = "EIN"

    const xml = await generateTestXml({ filingYear })

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>"
    )
  })

  it("FOREIGN_TIN maps to PartyIdentificationTypeCode 9", async () => {
    const filingYear = createMockFilingYear()
    filingYear.client.tinType = "FOREIGN_TIN"

    const xml = await generateTestXml({ filingYear })

    const type15Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
    )
    const type57Start = xml.indexOf(
      "<fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>"
    )
    const filerSection = xml.slice(type15Start, type57Start)

    expect(filerSection).toContain(
      "<fc2:PartyIdentificationTypeCode>9</fc2:PartyIdentificationTypeCode>"
    )
  })
})

// ===========================================================================
// 6. SeqNum Tests
// ===========================================================================

describe("SeqNum uniqueness", () => {
  it("all SeqNum values are unique", async () => {
    const xml = await generateTestXml()

    const seqNumPattern = /SeqNum="(\d+)"/g
    const seqNums: string[] = []
    let match: RegExpExecArray | null
    while ((match = seqNumPattern.exec(xml)) !== null) {
      seqNums.push(match[1])
    }

    const uniqueSeqNums = new Set(seqNums)
    expect(uniqueSeqNums.size).toBe(seqNums.length)
    expect(seqNums.length).toBeGreaterThan(0)
  })

  it("first SeqNum is 1", async () => {
    const xml = await generateTestXml()

    const seqNumPattern = /SeqNum="(\d+)"/g
    const seqNums: number[] = []
    let match: RegExpExecArray | null
    while ((match = seqNumPattern.exec(xml)) !== null) {
      seqNums.push(Number(match[1]))
    }

    expect(Math.min(...seqNums)).toBe(1)
  })
})

// ===========================================================================
// 7. Validator Tests
// ===========================================================================

describe("validateFincenXml", () => {
  it("accepts valid XML", async () => {
    const xml = await generateTestXml()
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("rejects XML missing fc2:EFilingBatchXML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><SomeOtherRoot></SomeOtherRoot>`
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("EFilingBatchXML"))).toBe(true)
  })

  it("rejects XML missing fc2:Activity", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fc2:EFilingBatchXML xmlns:fc2="www.fincen.gov/base">
  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>
</fc2:EFilingBatchXML>`
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("Activity"))).toBe(true)
  })

  it("rejects XML missing fc2:FormTypeCode", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fc2:EFilingBatchXML xmlns:fc2="www.fincen.gov/base">
  <fc2:Activity SeqNum="1">
    <fc2:Party SeqNum="2">
      <fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>
    </fc2:Party>
  </fc2:Activity>
</fc2:EFilingBatchXML>`
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("FormTypeCode"))).toBe(true)
  })
})

// ===========================================================================
// 8. Amended Filing Test
// ===========================================================================

describe("Amended filing", () => {
  it("CorrectsAmendsPriorReportIndicator is Y for amended filing", async () => {
    const filingYear = createMockFilingYear()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(filingYear as any).filingType = "AMENDED"

    const xml = await generateTestXml({ filingYear })
    expect(xml).toContain(
      "<fc2:CorrectsAmendsPriorReportIndicator>Y</fc2:CorrectsAmendsPriorReportIndicator>"
    )
  })

  it("CorrectsAmendsPriorReportIndicator is N or empty for initial filing", async () => {
    const xml = await generateTestXml()

    // For initial filings, the indicator should either be "N" or the element
    // should be empty/absent. The gap analysis notes FinCEN expects "Y" or null,
    // so we accept either pattern.
    const hasIndicatorN = xml.includes(
      "<fc2:CorrectsAmendsPriorReportIndicator>N</fc2:CorrectsAmendsPriorReportIndicator>"
    )
    const hasEmptyIndicator = xml.includes(
      "<fc2:CorrectsAmendsPriorReportIndicator/>"
    ) || xml.includes(
      "<fc2:CorrectsAmendsPriorReportIndicator></fc2:CorrectsAmendsPriorReportIndicator>"
    )

    expect(hasIndicatorN || hasEmptyIndicator).toBe(true)
  })
})

// ===========================================================================
// 9. Batch Attribute Tests
// ===========================================================================

describe("Batch attributes", () => {
  it("PartyCount equals number of type-41 FI parties", async () => {
    const xml = await generateTestXml()

    // 2 accounts = 2 FI parties (type 41)
    expect(xml).toContain('PartyCount="2"')
  })

  it("AccountCount equals number of accounts", async () => {
    const xml = await generateTestXml()

    // 2 accounts
    expect(xml).toContain('AccountCount="2"')
  })

  it("ActivityCount is always 1", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain('ActivityCount="1"')
  })

  it("JointlyOwnedOwnerCount, NoFIOwnerCount, ConsolidatedOwnerCount present", async () => {
    const xml = await generateTestXml()
    expect(xml).toContain('JointlyOwnedOwnerCount="0"')
    expect(xml).toContain('NoFIOwnerCount="0"')
    expect(xml).toContain('ConsolidatedOwnerCount="0"')
  })
})

// ===========================================================================
// 10. Date Formatting
// ===========================================================================

describe("Date formatting", () => {
  it("formats date of birth as YYYYMMDD without dashes", async () => {
    const xml = await generateTestXml()
    // 1985-03-15 -> 19850315
    expect(xml).toContain(
      "<fc2:IndividualBirthDateText>19850315</fc2:IndividualBirthDateText>"
    )
  })

  it("ApprovalOfficialSignatureDateText is YYYYMMDD format", async () => {
    const xml = await generateTestXml()

    const datePattern =
      /<fc2:ApprovalOfficialSignatureDateText>(\d{8})<\/fc2:ApprovalOfficialSignatureDateText>/
    expect(xml).toMatch(datePattern)
  })
})

// ===========================================================================
// 11. USD Amounts
// ===========================================================================

describe("USD amounts", () => {
  it("outputs amounts as whole dollars without decimals", async () => {
    const xml = await generateTestXml()

    const amountPattern =
      /<fc2:AccountMaximumValueAmountText>(\d+)<\/fc2:AccountMaximumValueAmountText>/g
    const amounts: string[] = []
    let match: RegExpExecArray | null
    while ((match = amountPattern.exec(xml)) !== null) {
      amounts.push(match[1])
    }

    expect(amounts.length).toBe(2)
    for (const amount of amounts) {
      expect(amount).toMatch(/^\d+$/)
      expect(amount).not.toContain(".")
    }
  })

  it("rounds fractional USD values to nearest whole dollar", async () => {
    const filingYear = createMockFilingYear()
    filingYear.reviewedAccountYears[0].maxValueUsd = 56818.45
    filingYear.reviewedAccountYears[1].maxValueUsd = 33670.87

    const xml = await generateTestXml({ filingYear })

    expect(xml).toContain(
      "<fc2:AccountMaximumValueAmountText>56818</fc2:AccountMaximumValueAmountText>"
    )
    expect(xml).toContain(
      "<fc2:AccountMaximumValueAmountText>33671</fc2:AccountMaximumValueAmountText>"
    )
  })
})

// ===========================================================================
// 12. Account Number and Unknown Value
// ===========================================================================

describe("Account details", () => {
  it("AccountNumberText is a direct child of Account", async () => {
    const xml = await generateTestXml()

    expect(xml).toContain(
      "<fc2:AccountNumberText>CH-123456</fc2:AccountNumberText>"
    )
    expect(xml).toContain(
      "<fc2:AccountNumberText>JP-789012</fc2:AccountNumberText>"
    )
  })

  it("UnknownMaximumValueIndicator present for unknown-value accounts", async () => {
    const filingYear = createMockFilingYear()
    filingYear.reviewedAccountYears[0].isValueUnknown = true
    filingYear.reviewedAccountYears[0].maxValueUsd = null as unknown as number
    filingYear.reviewedAccountYears[0].maxValueLocal = null as unknown as number

    const summary = createMockReviewSummary({
      accounts: [
        {
          foreignAccountId: "fa-1",
          institutionName: "Swiss Bank Corp",
          accountNumber: "CH-123456",
          accountType: "BANK",
          country: "CH",
          maxValueLocal: null,
          currencyCode: null,
          exchangeRate: null,
          maxValueUsd: null,
          isValueUnknown: true,
          reviewedAt: new Date("2024-06-15"),
          reviewedBy: "Jane Smith",
          corrections: null,
        },
        ...createMockReviewSummary().accounts.slice(1),
      ],
    })

    const xml = await generateTestXml({ filingYear, summary })

    expect(xml).toContain(
      "<fc2:UnknownMaximumValueIndicator>Y</fc2:UnknownMaximumValueIndicator>"
    )
  })

  it("UnknownMaximumValueIndicator absent for known-value accounts", async () => {
    const xml = await generateTestXml()

    // Default accounts have known values
    expect(xml).not.toContain("UnknownMaximumValueIndicator")
  })
})

// ===========================================================================
// 13. Namespace Prefix
// ===========================================================================

describe("Namespace prefix", () => {
  it("all element names use fc2: prefix", async () => {
    const xml = await generateTestXml()

    // Verify fc2: prefix on key elements
    expect(xml).toContain("<fc2:Activity")
    expect(xml).toContain("<fc2:Party")
    expect(xml).toContain("<fc2:PartyName")
    expect(xml).toContain("<fc2:Address")
    expect(xml).toContain("<fc2:Account ")
    expect(xml).toContain("<fc2:ActivityPartyTypeCode>")
    expect(xml).toContain("<fc2:FormTypeCode>")
    expect(xml).toContain("<fc2:ForeignAccountActivity")

    // Should NOT have un-prefixed elements (except xml declaration)
    // Check that core elements are not present without prefix
    expect(xml).not.toMatch(/<Activity[\s>](?!PartyTypeCode)/)
    expect(xml).not.toMatch(/<Account[\s>](?!MaximumValue|NumberText|TypeCode)/)
  })
})
