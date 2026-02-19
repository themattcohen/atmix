// ---------------------------------------------------------------------------
// Sample XML Output Test
// ---------------------------------------------------------------------------
// Generates a sample XML output and prints it for manual inspection.
// This test demonstrates what a real FBAR XML filing looks like.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ReviewSummary } from "@/lib/approval"
import type { TransmitterConfig, PreparerConfig } from "@/lib/export/fincen-xml"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReviewSummary = vi.fn()

vi.mock("@/lib/approval", () => ({
  getReviewSummary: (...args: unknown[]) => mockGetReviewSummary(...args),
}))

const mockPrisma = {
  filingYear: {
    findUniqueOrThrow: vi.fn(),
  },
}

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/encryption", () => ({
  safeDecrypt: (value: string) => value,
}))

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("XML Sample Output", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("generates and displays a sample FBAR XML", async () => {
    // Create realistic test data
    const summary: ReviewSummary = {
      filingYear: {
        id: "fy-sample",
        calendarYear: 2024,
        status: "EXPORTED",
      },
      client: {
        id: "c-sample",
        firstName: "John",
        lastName: "Smith",
        tin: "123456789",
        tinType: "SSN",
      },
      accounts: [
        {
          foreignAccountId: "fa-1",
          institutionName: "UBS Switzerland AG",
          accountNumber: "CH-98765432",
          accountType: "BANK",
          country: "CH",
          maxValueLocal: 100000,
          currencyCode: "CHF",
          exchangeRate: 0.88,
          maxValueUsd: 113636,
          isValueUnknown: false,
          reviewedAt: new Date("2024-12-15"),
          reviewedBy: "Jane Reviewer",
          corrections: null,
        },
        {
          foreignAccountId: "fa-2",
          institutionName: "Tokyo Securities Co Ltd",
          accountNumber: "JP-11223344",
          accountType: "SECURITIES",
          country: "JP",
          maxValueLocal: 8000000,
          currencyCode: "JPY",
          exchangeRate: 148.5,
          maxValueUsd: 53872,
          isValueUnknown: false,
          reviewedAt: new Date("2024-12-16"),
          reviewedBy: "Jane Reviewer",
          corrections: null,
        },
      ],
      aggregateMaxValueUSD: 167508,
      exceedsThreshold: true,
    }

    const filingYear = {
      id: "fy-sample",
      calendarYear: 2024,
      status: "EXPORTED",
      clientId: "c-sample",
      has25PlusAccounts: false,
      filingType: "INITIAL",
      client: {
        id: "c-sample",
        firstName: "John",
        lastName: "Smith",
        tin: "123456789",
        tinType: "SSN",
        type: "INDIVIDUAL",
        dateOfBirth: new Date("1980-05-15"),
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
          maxValueLocal: 100000,
          maxValueUsd: 113636,
          isValueUnknown: false,
          currencyCode: "CHF",
          exchangeRate: 0.88,
          foreignAccount: {
            id: "fa-1",
            institutionName: "UBS Switzerland AG",
            accountNumber: "CH-98765432",
            accountType: "BANK",
            ownershipType: "FINANCIAL_INTEREST",
            isJointlyOwned: false,
            institutionAddressStreet: "Bahnhofstrasse 45",
            institutionAddressCity: "Zurich",
            institutionAddressState: "ZH",
            institutionAddressCountry: "CH",
            institutionAddressPostal: "8001",
          },
        },
        {
          id: "ray-2",
          foreignAccountId: "fa-2",
          maxValueLocal: 8000000,
          maxValueUsd: 53872,
          isValueUnknown: false,
          currencyCode: "JPY",
          exchangeRate: 148.5,
          foreignAccount: {
            id: "fa-2",
            institutionName: "Tokyo Securities Co Ltd",
            accountNumber: "JP-11223344",
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

    mockGetReviewSummary.mockResolvedValue(summary)
    mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

    const { generateFincenXml, validateFincenXml } = await import(
      "@/lib/export/fincen-xml"
    )

    const xml = await generateFincenXml(
      "fy-sample",
      createMockTransmitter(),
      createMockPreparer()
    )

    // Validate the XML
    const validation = validateFincenXml(xml)
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toHaveLength(0)

    // Print the XML for manual inspection
    console.log("\n" + "=".repeat(80))
    console.log("SAMPLE FBAR XML OUTPUT")
    console.log("=".repeat(80))
    console.log(xml)
    console.log("=".repeat(80))
    console.log(`XML Length: ${xml.length} characters`)
    console.log("=".repeat(80) + "\n")

    // Verify key elements are present
    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
    expect(xml).toContain("<fc2:EFilingBatchXML")
    expect(xml).toContain("xmlns:fc2=\"www.fincen.gov/base\"")
    expect(xml).toContain("<fc2:Activity")
    expect(xml).toContain("<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>")
    expect(xml).toContain("<fc2:RawEntityIndividualLastName>Smith</fc2:RawEntityIndividualLastName>")
    expect(xml).toContain("<fc2:PartyIdentificationNumberText>123456789</fc2:PartyIdentificationNumberText>")
    expect(xml).toContain("<fc2:RawPartyLegalName>UBS Switzerland AG</fc2:RawPartyLegalName>")
    expect(xml).toContain("<fc2:AccountNumberText>CH-98765432</fc2:AccountNumberText>")
    expect(xml).toContain("<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>")
    expect(xml).toContain("<fc2:AccountMaximumValueAmountText>113636</fc2:AccountMaximumValueAmountText>")
  })
})
