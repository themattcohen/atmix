// ---------------------------------------------------------------------------
// Integration Tests: Deep XML Validation
// ---------------------------------------------------------------------------
// Comprehensive end-to-end testing of FBAR XML generation with realistic
// scenarios, edge cases, and FinCEN BSA format compliance verification.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ReviewSummary } from "@/lib/approval"
import type { TransmitterConfig, PreparerConfig } from "@/lib/export/fincen-xml"
import { XMLParser } from "fast-xml-parser"

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

// Mock encryption module
vi.mock("@/lib/encryption", () => ({
  safeDecrypt: (value: string) => value, // Return as-is for testing
}))

// ---------------------------------------------------------------------------
// Test Data Builders
// ---------------------------------------------------------------------------

interface MockFilingYearOptions {
  accountCount?: number
  hasJointAccounts?: boolean
  hasUnknownValues?: boolean
  includeAllAccountTypes?: boolean
  includeSpecialCharacters?: boolean
  includeLargeBalances?: boolean
  filingType?: "INITIAL" | "AMENDED"
  has25PlusAccounts?: boolean
  ownershipType?: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH"
}

function createComprehensiveFilingYear(
  options: MockFilingYearOptions = {}
) {
  const {
    accountCount = 3,
    hasJointAccounts = false,
    hasUnknownValues = false,
    includeAllAccountTypes = false,
    includeSpecialCharacters = false,
    includeLargeBalances = false,
    filingType = "INITIAL",
    has25PlusAccounts = false,
    ownershipType = "FINANCIAL_INTEREST",
  } = options

  const accounts = []
  const reviewedAccountYears = []

  // Account 1: Bank account in Switzerland
  accounts.push({
    foreignAccountId: "fa-1",
    institutionName: includeSpecialCharacters
      ? "UBS AG & Co. <Private>"
      : "UBS AG",
    accountNumber: "CH-123456789",
    accountType: "BANK",
    country: "CH",
    maxValueLocal: includeLargeBalances ? 50000000 : 75000,
    currencyCode: "CHF",
    exchangeRate: 0.88,
    maxValueUsd: includeLargeBalances ? 56818182 : 85227,
    isValueUnknown: false,
    reviewedAt: new Date("2024-06-15"),
    reviewedBy: "Jane Smith",
    corrections: null,
  })

  reviewedAccountYears.push({
    id: "ray-1",
    foreignAccountId: "fa-1",
    maxValueLocal: includeLargeBalances ? 50000000 : 75000,
    maxValueUsd: includeLargeBalances ? 56818182 : 85227,
    isValueUnknown: false,
    currencyCode: "CHF",
    exchangeRate: 0.88,
    foreignAccount: {
      id: "fa-1",
      institutionName: includeSpecialCharacters
        ? "UBS AG & Co. <Private>"
        : "UBS AG",
      accountNumber: "CH-123456789",
      accountType: includeAllAccountTypes ? "BANK" : "BANK",
      ownershipType,
      isJointlyOwned: hasJointAccounts,
      institutionAddressStreet: "Bahnhofstrasse 45",
      institutionAddressCity: "Zurich",
      institutionAddressState: "ZH",
      institutionAddressCountry: "CH",
      institutionAddressPostal: "8001",
    },
  })

  if (accountCount >= 2) {
    // Account 2: Securities account in Japan
    accounts.push({
      foreignAccountId: "fa-2",
      institutionName: "Nomura Securities",
      accountNumber: "JP-987654321",
      accountType: includeAllAccountTypes ? "SECURITIES" : "BANK",
      country: "JP",
      maxValueLocal: 10000000,
      currencyCode: "JPY",
      exchangeRate: 148.5,
      maxValueUsd: 67340,
      isValueUnknown: false,
      reviewedAt: new Date("2024-06-16"),
      reviewedBy: "John Doe",
      corrections: {
        institution_name: {
          original: "Nomura",
          corrected: "Nomura Securities",
        },
      },
    })

    reviewedAccountYears.push({
      id: "ray-2",
      foreignAccountId: "fa-2",
      maxValueLocal: 10000000,
      maxValueUsd: 67340,
      isValueUnknown: false,
      currencyCode: "JPY",
      exchangeRate: 148.5,
      foreignAccount: {
        id: "fa-2",
        institutionName: "Nomura Securities",
        accountNumber: "JP-987654321",
        accountType: includeAllAccountTypes ? "SECURITIES" : "BANK",
        ownershipType: "FINANCIAL_INTEREST",
        isJointlyOwned: false,
        institutionAddressStreet: "1-9-1 Nihombashi",
        institutionAddressCity: "Tokyo",
        institutionAddressState: "",
        institutionAddressCountry: "JP",
        institutionAddressPostal: "103-8011",
      },
    })
  }

  if (accountCount >= 3) {
    // Account 3: Other account type or unknown value account
    accounts.push({
      foreignAccountId: "fa-3",
      institutionName: "Cayman Investment Fund",
      accountNumber: "KY-555666777",
      accountType: includeAllAccountTypes ? "OTHER" : "BANK",
      country: "KY",
      maxValueLocal: hasUnknownValues ? null : 200000,
      currencyCode: hasUnknownValues ? null : "USD",
      exchangeRate: hasUnknownValues ? null : 1.0,
      maxValueUsd: hasUnknownValues ? null : 200000,
      isValueUnknown: hasUnknownValues,
      reviewedAt: new Date("2024-06-17"),
      reviewedBy: "Jane Smith",
      corrections: null,
    })

    reviewedAccountYears.push({
      id: "ray-3",
      foreignAccountId: "fa-3",
      maxValueLocal: hasUnknownValues ? null : 200000,
      maxValueUsd: hasUnknownValues ? null : 200000,
      isValueUnknown: hasUnknownValues,
      currencyCode: hasUnknownValues ? null : "USD",
      exchangeRate: hasUnknownValues ? null : 1.0,
      foreignAccount: {
        id: "fa-3",
        institutionName: "Cayman Investment Fund",
        accountNumber: "KY-555666777",
        accountType: includeAllAccountTypes ? "OTHER" : "BANK",
        ownershipType: "FINANCIAL_INTEREST",
        isJointlyOwned: false,
        institutionAddressStreet: "PO Box 31106 SMB",
        institutionAddressCity: "George Town",
        institutionAddressState: "Grand Cayman",
        institutionAddressCountry: "KY",
        institutionAddressPostal: "KY1-1205",
      },
    })
  }

  const totalUsd = accounts.reduce(
    (sum, acc) => sum + (acc.maxValueUsd ?? 0),
    0
  )

  return {
    filingYear: {
      id: "fy-test",
      calendarYear: 2024,
      status: "EXPORTED",
      clientId: "c-test",
      has25PlusAccounts,
      filingType,
      client: {
        id: "c-test",
        firstName: "Robert",
        lastName: "Smith",
        tin: "987654321",
        tinType: "SSN" as const,
        type: "INDIVIDUAL" as const,
        dateOfBirth: new Date("1975-08-22"),
        usAddress: {
          street: "456 Oak Avenue",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
        },
      },
      reviewedAccountYears,
    },
    summary: {
      filingYear: {
        id: "fy-test",
        calendarYear: 2024,
        status: "EXPORTED",
      },
      client: {
        id: "c-test",
        firstName: "Robert",
        lastName: "Smith",
        tin: "987654321",
        tinType: "SSN",
      },
      accounts,
      aggregateMaxValueUSD: totalUsd,
      exceedsThreshold: totalUsd > 10000,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock Transmitter / Preparer Configs
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
// XML Parsing Helper
// ---------------------------------------------------------------------------

function parseXml(xml: string): Record<string, unknown> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
  })
  return parser.parse(xml)
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe("XML Deep Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. FinCEN BSA XML Format Compliance
  // -------------------------------------------------------------------------

  describe("FinCEN BSA XML Format Compliance", () => {
    it("generates valid FinCEN BSA XML with correct structure", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Verify XML declaration
      expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)

      // Verify root element with correct namespace
      expect(xml).toContain('<fc2:EFilingBatchXML')
      expect(xml).toContain('xmlns:fc2="www.fincen.gov/base"')

      // Verify required root attributes
      expect(xml).toContain('ActivityCount="1"')

      // Parse and verify structure
      const parsed = parseXml(xml)
      expect(parsed).toHaveProperty("fc2:EFilingBatchXML")
      const root = parsed["fc2:EFilingBatchXML"] as Record<string, unknown>
      expect(root).toHaveProperty("fc2:Activity")
    })

    it("includes all required filer fields (Part I)", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Filer identification (party type 15)
      expect(xml).toContain("<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>")
      expect(xml).toContain("<fc2:RawEntityIndividualLastName>Smith</fc2:RawEntityIndividualLastName>")
      expect(xml).toContain("<fc2:RawIndividualFirstName>Robert</fc2:RawIndividualFirstName>")

      // Filer TIN (unmasked)
      expect(xml).toContain("<fc2:PartyIdentificationNumberText>987654321</fc2:PartyIdentificationNumberText>")
      expect(xml).toContain("<fc2:PartyIdentificationTypeCode>1</fc2:PartyIdentificationTypeCode>") // SSN

      // Filer address
      expect(xml).toContain("<fc2:RawStreetAddress1Text>456 Oak Avenue</fc2:RawStreetAddress1Text>")
      expect(xml).toContain("<fc2:RawCityText>San Francisco</fc2:RawCityText>")
      expect(xml).toContain("<fc2:RawStateCodeText>CA</fc2:RawStateCodeText>")
      expect(xml).toContain("<fc2:RawZIPCode>94102</fc2:RawZIPCode>")
      expect(xml).toContain("<fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>")

      // Filer date of birth
      expect(xml).toContain("<fc2:IndividualBirthDateText>19750822</fc2:IndividualBirthDateText>")

      // Individual indicator
      expect(xml).toContain("<fc2:FilerTypeIndividualIndicator>Y</fc2:FilerTypeIndividualIndicator>")
    })

    it("includes all required account fields (Part II/III)", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Financial institution party type (nested in Account)
      expect(xml).toContain("<fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>")

      // Institution name
      expect(xml).toContain("<fc2:RawPartyLegalName>UBS AG</fc2:RawPartyLegalName>")

      // Institution address
      expect(xml).toContain("<fc2:RawCityText>Zurich</fc2:RawCityText>")
      expect(xml).toContain("<fc2:RawCountryCodeText>CH</fc2:RawCountryCodeText>")

      // Account details
      expect(xml).toContain("<fc2:AccountNumberText>CH-123456789</fc2:AccountNumberText>")
      expect(xml).toContain("<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>") // Separately owned BANK
      expect(xml).toContain("<fc2:AccountMaximumValueAmountText>85227</fc2:AccountMaximumValueAmountText>")
    })

    it("formats all dates as YYYYMMDD", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Extract all date elements
      const dateElements = [
        "ApprovalOfficialSignatureDateText",
        "IndividualBirthDateText",
      ]

      for (const elem of dateElements) {
        const pattern = new RegExp(`<fc2:${elem}>([^<]+)</fc2:${elem}>`)
        const match = pattern.exec(xml)
        if (match) {
          const dateValue = match[1]
          // Should be exactly 8 digits (YYYYMMDD)
          expect(dateValue).toMatch(/^\d{8}$/)
          // Should not contain dashes or slashes
          expect(dateValue).not.toContain("-")
          expect(dateValue).not.toContain("/")
        }
      }
    })

    it("formats maximum values as whole USD dollars", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Extract all AccountMaximumValueAmountText elements
      const amountPattern = /<fc2:AccountMaximumValueAmountText>(\d+)<\/fc2:AccountMaximumValueAmountText>/g
      const amounts: string[] = []
      let match: RegExpExecArray | null
      while ((match = amountPattern.exec(xml)) !== null) {
        amounts.push(match[1])
      }

      expect(amounts.length).toBeGreaterThan(0)

      for (const amount of amounts) {
        // Should be integers only (no decimal point, no currency symbols)
        expect(amount).toMatch(/^\d+$/)
        expect(amount).not.toContain(".")
        expect(amount).not.toContain("$")
        expect(amount).not.toContain(",")
      }
    })
  })

  // -------------------------------------------------------------------------
  // 2. Edge Cases and Special Scenarios
  // -------------------------------------------------------------------------

  describe("Edge Cases and Special Scenarios", () => {
    it("handles special characters in institution names with XML escaping", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        includeSpecialCharacters: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // XML should escape special characters
      expect(xml).toContain("&amp;") // & -> &amp;
      expect(xml).toContain("&lt;") // < -> &lt;

      // Should not contain unescaped special characters
      const institutionNamePattern = /<fc2:RawPartyLegalName>([^<]+)<\/fc2:RawPartyLegalName>/
      const match = institutionNamePattern.exec(xml)
      if (match) {
        // After parsing, should be properly escaped
        expect(xml).not.toMatch(/<fc2:RawPartyLegalName>UBS AG & Co\. <Private>/)
      }
    })

    it("handles very large balance amounts", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        includeLargeBalances: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should handle large numbers (over $50 million)
      expect(xml).toContain("<fc2:AccountMaximumValueAmountText>56818182</fc2:AccountMaximumValueAmountText>")

      // Verify validation still passes
      const { validateFincenXml } = await import("@/lib/export/fincen-xml")
      const validation = validateFincenXml(xml)
      expect(validation.isValid).toBe(true)
    })

    it("handles accounts with unknown values", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        hasUnknownValues: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should include UnknownMaximumValueIndicator
      expect(xml).toContain("<fc2:UnknownMaximumValueIndicator>Y</fc2:UnknownMaximumValueIndicator>")

      // Amount should be 0 for unknown value accounts
      const unknownValuePattern = /<fc2:UnknownMaximumValueIndicator>Y<\/fc2:UnknownMaximumValueIndicator>[^]*?<fc2:AccountMaximumValueAmountText>(\d+)<\/fc2:AccountMaximumValueAmountText>/
      const match = unknownValuePattern.exec(xml)
      if (match) {
        expect(match[1]).toBe("0")
      }
    })

    it("handles all supported account types (BANK, SECURITIES, OTHER)", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
        includeAllAccountTypes: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should contain all three AccountTypeCode values (BANK=1, SECURITIES=2, OTHER=999)
      expect(xml).toContain("<fc2:AccountTypeCode>1</fc2:AccountTypeCode>") // BANK
      expect(xml).toContain("<fc2:AccountTypeCode>2</fc2:AccountTypeCode>") // SECURITIES
      expect(xml).toContain("<fc2:AccountTypeCode>999</fc2:AccountTypeCode>") // OTHER
    })

    it("handles jointly owned accounts (EFilingAccountTypeCode 142)", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        hasJointAccounts: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should use EFilingAccountTypeCode 142 for jointly owned accounts
      expect(xml).toContain("<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>")
    })

    it("handles signature authority ownership type", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        ownershipType: "SIGNATURE_AUTHORITY",
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should use EFilingAccountTypeCode 143 for signature authority
      expect(xml).toContain("<fc2:EFilingAccountTypeCode>143</fc2:EFilingAccountTypeCode>")

      // Filer should have SignatureAuthoritiesIndicator set to Y
      expect(xml).toContain("<fc2:SignatureAuthoritiesIndicator>Y</fc2:SignatureAuthoritiesIndicator>")
    })

    it("handles both financial interest and signature authority", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        ownershipType: "BOTH",
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Filer should have SignatureAuthoritiesIndicator set to Y (BOTH includes signature authority)
      expect(xml).toContain("<fc2:SignatureAuthoritiesIndicator>Y</fc2:SignatureAuthoritiesIndicator>")

      // EFilingAccountTypeCode defaults to 141 for BOTH ownership (separately owned)
      expect(xml).toContain("<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>")
    })

    it("handles amended filing type", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        filingType: "AMENDED",
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should set CorrectsAmendsPriorReportIndicator to Y
      expect(xml).toContain("<fc2:CorrectsAmendsPriorReportIndicator>Y</fc2:CorrectsAmendsPriorReportIndicator>")
    })

    it("handles 25+ accounts indicator", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        has25PlusAccounts: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should set FilerFinancialInterest25ForeignAccountIndicator to Y
      expect(xml).toContain("<fc2:FilerFinancialInterest25ForeignAccountIndicator>Y</fc2:FilerFinancialInterest25ForeignAccountIndicator>")
    })
  })

  // -------------------------------------------------------------------------
  // 3. XML Structural Validation
  // -------------------------------------------------------------------------

  describe("XML Structural Validation", () => {
    it("ensures all SeqNum values are unique", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Extract all SeqNum values
      const seqNumPattern = /SeqNum="(\d+)"/g
      const seqNums: string[] = []
      let match: RegExpExecArray | null
      while ((match = seqNumPattern.exec(xml)) !== null) {
        seqNums.push(match[1])
      }

      // All should be unique
      const uniqueSeqNums = new Set(seqNums)
      expect(uniqueSeqNums.size).toBe(seqNums.length)

      // Should have a reasonable number of SeqNums (1 root + 1 activity + parties + nested elements)
      expect(seqNums.length).toBeGreaterThan(10)
    })

    it("maintains correct PartyCount and AccountCount", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // PartyCount = number of type 41 (financial institution) parties = 3
      expect(xml).toContain('PartyCount="3"')

      // AccountCount = 3
      expect(xml).toContain('AccountCount="3"')
    })

    it("validates against comprehensive validation rules", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
        includeAllAccountTypes: true,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())
      const validation = validateFincenXml(xml)

      // Should pass all validation checks
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Multiple Accounts Scenario
  // -------------------------------------------------------------------------

  describe("Multiple Accounts Scenario", () => {
    it("generates valid XML with 5 diverse accounts", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
        includeAllAccountTypes: true,
        includeSpecialCharacters: true,
      })

      // Add 2 more accounts
      summary.accounts.push(
        {
          foreignAccountId: "fa-4",
          institutionName: "HSBC Hong Kong",
          accountNumber: "HK-111222333",
          accountType: "BANK",
          country: "HK",
          maxValueLocal: 500000,
          currencyCode: "HKD",
          exchangeRate: 7.8,
          maxValueUsd: 64103,
          isValueUnknown: false,
          reviewedAt: new Date("2024-06-18"),
          reviewedBy: "Jane Smith",
          corrections: null,
        },
        {
          foreignAccountId: "fa-5",
          institutionName: "Deutsche Bank AG",
          accountNumber: "DE-444555666",
          accountType: "SECURITIES",
          country: "DE",
          maxValueLocal: 100000,
          currencyCode: "EUR",
          exchangeRate: 0.92,
          maxValueUsd: 108696,
          isValueUnknown: false,
          reviewedAt: new Date("2024-06-19"),
          reviewedBy: "John Doe",
          corrections: null,
        }
      )

      filingYear.reviewedAccountYears.push(
        {
          id: "ray-4",
          foreignAccountId: "fa-4",
          maxValueLocal: 500000,
          maxValueUsd: 64103,
          isValueUnknown: false,
          currencyCode: "HKD",
          exchangeRate: 7.8,
          foreignAccount: {
            id: "fa-4",
            institutionName: "HSBC Hong Kong",
            accountNumber: "HK-111222333",
            accountType: "BANK",
            ownershipType: "FINANCIAL_INTEREST",
            isJointlyOwned: false,
            institutionAddressStreet: "1 Queen's Road Central",
            institutionAddressCity: "Hong Kong",
            institutionAddressState: "",
            institutionAddressCountry: "HK",
            institutionAddressPostal: "",
          },
        },
        {
          id: "ray-5",
          foreignAccountId: "fa-5",
          maxValueLocal: 100000,
          maxValueUsd: 108696,
          isValueUnknown: false,
          currencyCode: "EUR",
          exchangeRate: 0.92,
          foreignAccount: {
            id: "fa-5",
            institutionName: "Deutsche Bank AG",
            accountNumber: "DE-444555666",
            accountType: "SECURITIES",
            ownershipType: "FINANCIAL_INTEREST",
            isJointlyOwned: false,
            institutionAddressStreet: "Taunusanlage 12",
            institutionAddressCity: "Frankfurt",
            institutionAddressState: "HE",
            institutionAddressCountry: "DE",
            institutionAddressPostal: "60325",
          },
        }
      )

      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should validate successfully
      const validation = validateFincenXml(xml)
      expect(validation.isValid).toBe(true)

      // Should contain all 5 accounts (each with a type 41 financial institution party)
      const accountPartyMatches = xml.match(
        /<fc2:ActivityPartyTypeCode>41<\/fc2:ActivityPartyTypeCode>/g
      )
      expect(accountPartyMatches?.length).toBe(5)

      // Should have correct PartyCount (5 type-41 financial institution parties)
      expect(xml).toContain('PartyCount="5"')
    })
  })

  // -------------------------------------------------------------------------
  // 5. Country Code Coverage
  // -------------------------------------------------------------------------

  describe("Country Code Coverage", () => {
    it("handles diverse country codes from different continents", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      // Should contain various country codes
      expect(xml).toContain("<fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>") // Filer
      expect(xml).toContain("<fc2:RawCountryCodeText>CH</fc2:RawCountryCodeText>") // Switzerland
      expect(xml).toContain("<fc2:RawCountryCodeText>JP</fc2:RawCountryCodeText>") // Japan
      expect(xml).toContain("<fc2:RawCountryCodeText>KY</fc2:RawCountryCodeText>") // Cayman Islands

      // All should be 2-letter ISO codes
      const countryPattern = /<fc2:RawCountryCodeText>([A-Z]{2})<\/fc2:RawCountryCodeText>/g
      const countries: string[] = []
      let match: RegExpExecArray | null
      while ((match = countryPattern.exec(xml)) !== null) {
        countries.push(match[1])
      }

      for (const country of countries) {
        expect(country).toMatch(/^[A-Z]{2}$/)
      }
    })
  })

  // -------------------------------------------------------------------------
  // 6. Data Consistency Checks
  // -------------------------------------------------------------------------

  describe("Data Consistency Checks", () => {
    it("ensures account numbers appear exactly once per account", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      for (const account of summary.accounts) {
        const pattern = new RegExp(
          `<fc2:AccountNumberText>${account.accountNumber}</fc2:AccountNumberText>`,
          "g"
        )
        const matches = xml.match(pattern)
        // Each account number should appear exactly once (in the Account element)
        expect(matches).toBeTruthy()
        expect(matches!.length).toBe(1)
      }
    })

    it("ensures institution names match between summary and XML", async () => {
      const { filingYear, summary } = createComprehensiveFilingYear({
        accountCount: 3,
      })
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

      const { generateFincenXml } = await import("@/lib/export/fincen-xml")
      const xml = await generateFincenXml("fy-test", createMockTransmitter(), createMockPreparer())

      for (const account of summary.accounts) {
        // Institution name should appear in XML (possibly with XML escaping)
        const escapedName = account.institutionName
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")

        expect(xml).toContain(account.institutionName)
      }
    })
  })
})
