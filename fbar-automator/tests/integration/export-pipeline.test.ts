// ---------------------------------------------------------------------------
// Integration Tests: Export Pipeline
// ---------------------------------------------------------------------------
// Tests CSV and XML export modules working together. Verifies output format,
// content correctness, TIN masking, XML structure validation, account type
// mapping, date formatting, USD amount formatting, and cross-format
// consistency.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ReviewSummary } from "@/lib/approval"
import type {
  TransmitterConfig,
  PreparerConfig,
} from "@/lib/export/fincen-xml"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReviewSummary = vi.fn()

vi.mock("@/lib/approval", () => ({
  getReviewSummary: (...args: unknown[]) => mockGetReviewSummary(...args),
}))

const mockPrisma = {
  filingYear: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
  },
}

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/encryption", () => ({
  safeDecrypt: (value: string) => value,
}))

// ---------------------------------------------------------------------------
// Transmitter & Preparer configs for XML tests
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
// Comprehensive mock ReviewSummary
// ---------------------------------------------------------------------------

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
        corrections: {
          bank_name: { original: "Tokyo Sec", corrected: "Tokyo Securities" },
        },
      },
    ],
    aggregateMaxValueUSD: 90488,
    exceedsThreshold: true,
    ...overrides,
  }
}

/**
 * Creates a mock filingYear with client and reviewedAccountYears for
 * the XML generator, which fetches data directly from Prisma in addition
 * to the prefetched summary.
 */
function createMockFilingYearForXml() {
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

// ---------------------------------------------------------------------------
// Helper: set up mocks + generate XML with new 4-arg signature
// ---------------------------------------------------------------------------

async function setupAndGenerateXml(
  overrides?: {
    summary?: ReviewSummary
    filingYear?: ReturnType<typeof createMockFilingYearForXml>
    transmitter?: TransmitterConfig
    preparer?: PreparerConfig
  }
) {
  const summary = overrides?.summary ?? createMockReviewSummary()
  const filingYear = overrides?.filingYear ?? createMockFilingYearForXml()
  const transmitter = overrides?.transmitter ?? createMockTransmitter()
  const preparer = overrides?.preparer ?? createMockPreparer()

  mockGetReviewSummary.mockResolvedValue(summary)
  mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(filingYear)

  const { generateFincenXml } = await import("@/lib/export/fincen-xml")

  return generateFincenXml("fy-1", transmitter, preparer, summary)
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Export Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. CSV export content
  // -------------------------------------------------------------------------

  describe("CSV export content", () => {
    it("generates CSV with correct headers and data rows", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())

      const { generateFBARCsv } = await import("@/lib/export/csv")

      const csv = await generateFBARCsv("fy-1")

      // Verify headers are present
      const expectedHeaders = [
        "Filing Year",
        "Filer Last Name",
        "Filer First Name",
        "Filer TIN",
        "Account Number",
        "Institution Name",
        "Account Type",
        "Country",
        "Currency Code",
        "Max Value (Local Currency)",
        "Exchange Rate",
        "Max Value (USD)",
        "Value Unknown",
        "Reviewed By",
        "Reviewed At",
      ]

      const lines = csv.split("\n")
      const headerLine = lines[0]

      for (const header of expectedHeaders) {
        expect(headerLine).toContain(header)
      }

      // Should have header + 2 data rows + 1 summary row = 4 lines
      // (papaparse may or may not add trailing newline)
      const nonEmptyLines = lines.filter((l) => l.trim().length > 0)
      expect(nonEmptyLines.length).toBe(4) // header + 2 accounts + summary

      // Verify data content
      expect(csv).toContain("Swiss Bank Corp")
      expect(csv).toContain("Tokyo Securities")
      expect(csv).toContain("CH-123456")
      expect(csv).toContain("JP-789012")
      expect(csv).toContain("2024")
      expect(csv).toContain("Doe")
      expect(csv).toContain("John")
      expect(csv).toContain("BANK")
      expect(csv).toContain("SECURITIES")
    })

    it("includes aggregate summary row at the end", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())

      const { generateFBARCsv } = await import("@/lib/export/csv")

      const csv = await generateFBARCsv("fy-1")
      const lines = csv.split("\n").filter((l) => l.trim().length > 0)
      const lastLine = lines[lines.length - 1]

      // Summary row contains aggregate max value
      expect(lastLine).toContain("90488")
      expect(lastLine).toContain("Aggregate Max Value (USD)")
    })
  })

  // -------------------------------------------------------------------------
  // 2. CSV TIN masking
  // -------------------------------------------------------------------------

  describe("CSV TIN masking", () => {
    it("masks the full TIN to show only last 4 digits", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())

      const { generateFBARCsv } = await import("@/lib/export/csv")

      const csv = await generateFBARCsv("fy-1")

      // Full TIN should NOT appear
      expect(csv).not.toContain("123456789")

      // Masked format should appear
      expect(csv).toContain("***-**-6789")
    })

    it("handles null TIN gracefully", async () => {
      const summaryWithNullTin = createMockReviewSummary({
        client: {
          id: "c-1",
          firstName: "John",
          lastName: "Doe",
          tin: null,
          tinType: null,
        },
      })
      mockGetReviewSummary.mockResolvedValue(summaryWithNullTin)

      const { generateFBARCsv } = await import("@/lib/export/csv")

      const csv = await generateFBARCsv("fy-1")

      // Should not crash, TIN field should be empty
      expect(csv).toBeDefined()
      expect(csv.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // 3. XML structure validation
  // -------------------------------------------------------------------------

  describe("XML structure validation", () => {
    it("generates valid XML that passes structural validation", async () => {
      const xml = await setupAndGenerateXml()

      const { validateFincenXml } = await import("@/lib/export/fincen-xml")
      const validation = validateFincenXml(xml)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it("validates malformed XML correctly", async () => {
      const { validateFincenXml } = await import("@/lib/export/fincen-xml")

      const badXml = "<root><fc2:Activity></fc2:Activity></root>"
      const validation = validateFincenXml(badXml)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // 4. XML required elements
  // -------------------------------------------------------------------------

  describe("XML required elements", () => {
    it("contains fc2:EFilingBatchXML root, Activity, parties, and accounts", async () => {
      const xml = await setupAndGenerateXml()

      // Root element with fc2 prefix
      expect(xml).toContain("<fc2:EFilingBatchXML")

      // Activity element
      expect(xml).toContain("<fc2:Activity")

      // FormTypeCode
      expect(xml).toContain("<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>")

      // Transmitter party (type 35)
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>"
      )

      // Filer party (type 15)
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>"
      )

      // FI parties (type 41) inside Account elements
      expect(xml).toContain(
        "<fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>"
      )

      // PartyName for filer (uses RawEntityIndividualLastName in new schema)
      expect(xml).toContain(
        "<fc2:RawEntityIndividualLastName>Doe</fc2:RawEntityIndividualLastName>"
      )
      expect(xml).toContain(
        "<fc2:RawIndividualFirstName>John</fc2:RawIndividualFirstName>"
      )

      // PartyName for institutions
      expect(xml).toContain(
        "<fc2:RawPartyLegalName>Swiss Bank Corp</fc2:RawPartyLegalName>"
      )
      expect(xml).toContain(
        "<fc2:RawPartyLegalName>Tokyo Securities</fc2:RawPartyLegalName>"
      )

      // Filer TIN (unmasked in XML)
      expect(xml).toContain(
        "<fc2:PartyIdentificationNumberText>123456789</fc2:PartyIdentificationNumberText>"
      )

      // Account numbers (direct child of Account, not PartyAccountAssociation)
      expect(xml).toContain(
        "<fc2:AccountNumberText>CH-123456</fc2:AccountNumberText>"
      )
      expect(xml).toContain(
        "<fc2:AccountNumberText>JP-789012</fc2:AccountNumberText>"
      )

      // ForeignAccountActivity
      expect(xml).toContain("<fc2:ForeignAccountActivity")
      expect(xml).toContain(
        "<fc2:ReportCalendarYearText>2024</fc2:ReportCalendarYearText>"
      )
    })

    it("includes filer address elements with fc2 prefix", async () => {
      const xml = await setupAndGenerateXml()

      expect(xml).toContain(
        "<fc2:RawStreetAddress1Text>123 Main Street</fc2:RawStreetAddress1Text>"
      )
      expect(xml).toContain("<fc2:RawCityText>New York</fc2:RawCityText>")
      expect(xml).toContain("<fc2:RawStateCodeText>NY</fc2:RawStateCodeText>")
      expect(xml).toContain("<fc2:RawZIPCode>10001</fc2:RawZIPCode>")
      expect(xml).toContain(
        "<fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>"
      )
    })

    it("does not contain removed elements from old schema", async () => {
      const xml = await setupAndGenerateXml()

      // PartyAccountAssociation was CTR-only, not in FBAR
      expect(xml).not.toContain("PartyAccountAssociation")

      // FilingDateText does not exist in FBAR schema
      expect(xml).not.toContain("FilingDateText")

      // StatusCode and TotalAmount are acknowledgement-only attributes
      expect(xml).not.toContain("StatusCode")
      expect(xml).not.toContain("TotalAmount")
    })
  })

  // -------------------------------------------------------------------------
  // 5. XML account type mapping
  // -------------------------------------------------------------------------

  describe("XML account type mapping", () => {
    it("maps BANK to AccountTypeCode 1, SECURITIES to AccountTypeCode 2", async () => {
      const xml = await setupAndGenerateXml()

      // BANK -> AccountTypeCode 1
      expect(xml).toContain(
        "<fc2:AccountTypeCode>1</fc2:AccountTypeCode>"
      )
      // SECURITIES -> AccountTypeCode 2
      expect(xml).toContain(
        "<fc2:AccountTypeCode>2</fc2:AccountTypeCode>"
      )
    })

    it("maps OTHER account type to AccountTypeCode 999", async () => {
      const filingYear = createMockFilingYearForXml()
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

      const xml = await setupAndGenerateXml({ filingYear, summary })

      // OTHER -> 999
      expect(xml).toContain(
        "<fc2:AccountTypeCode>999</fc2:AccountTypeCode>"
      )
    })

    it("maps EFilingAccountTypeCode based on ownership: 141, 142, 143", async () => {
      const xml = await setupAndGenerateXml()

      // Default accounts are FINANCIAL_INTEREST, not joint -> 141
      expect(xml).toContain(
        "<fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>"
      )
    })

    it("maps joint ownership to EFilingAccountTypeCode 142", async () => {
      const filingYear = createMockFilingYearForXml()
      filingYear.reviewedAccountYears[0].foreignAccount.isJointlyOwned = true

      const xml = await setupAndGenerateXml({ filingYear })

      expect(xml).toContain(
        "<fc2:EFilingAccountTypeCode>142</fc2:EFilingAccountTypeCode>"
      )
    })

    it("maps SIGNATURE_AUTHORITY to EFilingAccountTypeCode 143", async () => {
      const filingYear = createMockFilingYearForXml()
      filingYear.reviewedAccountYears[0].foreignAccount.ownershipType =
        "SIGNATURE_AUTHORITY"

      const xml = await setupAndGenerateXml({ filingYear })

      expect(xml).toContain(
        "<fc2:EFilingAccountTypeCode>143</fc2:EFilingAccountTypeCode>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // 6. XML date formatting
  // -------------------------------------------------------------------------

  describe("XML date formatting", () => {
    it("formats dates as YYYYMMDD without dashes", async () => {
      const xml = await setupAndGenerateXml()

      // Date of birth: 1985-03-15 -> 19850315
      expect(xml).toContain(
        "<fc2:IndividualBirthDateText>19850315</fc2:IndividualBirthDateText>"
      )

      // Signature date should be YYYYMMDD format
      const datePattern =
        /<fc2:ApprovalOfficialSignatureDateText>(\d{8})<\/fc2:ApprovalOfficialSignatureDateText>/
      expect(xml).toMatch(datePattern)
    })
  })

  // -------------------------------------------------------------------------
  // 7. XML USD amounts
  // -------------------------------------------------------------------------

  describe("XML USD amounts", () => {
    it("outputs amounts as whole dollars without decimals", async () => {
      const xml = await setupAndGenerateXml()

      // Extract all AccountMaximumValueAmountText values
      const amountPattern =
        /<fc2:AccountMaximumValueAmountText>(\d+)<\/fc2:AccountMaximumValueAmountText>/g
      const amounts: string[] = []
      let match: RegExpExecArray | null
      while ((match = amountPattern.exec(xml)) !== null) {
        amounts.push(match[1])
      }

      expect(amounts.length).toBe(2) // two accounts

      // Amounts should be whole integers
      for (const amount of amounts) {
        expect(amount).toMatch(/^\d+$/)
        expect(amount).not.toContain(".")
      }
    })

    it("rounds fractional USD values to nearest whole dollar", async () => {
      const filingYear = createMockFilingYearForXml()
      filingYear.reviewedAccountYears[0].maxValueUsd = 56818.45
      filingYear.reviewedAccountYears[1].maxValueUsd = 33670.87

      const xml = await setupAndGenerateXml({ filingYear })

      // Should be rounded: 56818.45 -> 56818, 33670.87 -> 33671
      expect(xml).toContain(
        "<fc2:AccountMaximumValueAmountText>56818</fc2:AccountMaximumValueAmountText>"
      )
      expect(xml).toContain(
        "<fc2:AccountMaximumValueAmountText>33671</fc2:AccountMaximumValueAmountText>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // 8. Cross-format consistency
  // -------------------------------------------------------------------------

  describe("cross-format consistency", () => {
    it("CSV and XML contain same number of accounts", async () => {
      const summary = createMockReviewSummary()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFBARCsv } = await import("@/lib/export/csv")
      const { generateFincenXml } = await import("@/lib/export/fincen-xml")

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml(
        "fy-1",
        createMockTransmitter(),
        createMockPreparer(),
        summary
      )

      // CSV: count data rows (exclude header and summary)
      const csvLines = csv.split("\n").filter((l) => l.trim().length > 0)
      const csvDataRows = csvLines.length - 2 // minus header and summary row

      // XML: count FI parties (type 41) inside Account elements
      const xmlAccountPartyMatches = xml.match(
        /<fc2:ActivityPartyTypeCode>41<\/fc2:ActivityPartyTypeCode>/g
      )
      const xmlAccountCount = xmlAccountPartyMatches
        ? xmlAccountPartyMatches.length
        : 0

      expect(csvDataRows).toBe(xmlAccountCount)
      expect(csvDataRows).toBe(summary.accounts.length)
    })

    it("CSV and XML reference the same institution names", async () => {
      const summary = createMockReviewSummary()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFBARCsv } = await import("@/lib/export/csv")
      const { generateFincenXml } = await import("@/lib/export/fincen-xml")

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml(
        "fy-1",
        createMockTransmitter(),
        createMockPreparer(),
        summary
      )

      for (const account of summary.accounts) {
        expect(csv).toContain(account.institutionName)
        expect(xml).toContain(account.institutionName)
      }
    })

    it("CSV and XML agree on account numbers", async () => {
      const summary = createMockReviewSummary()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFBARCsv } = await import("@/lib/export/csv")
      const { generateFincenXml } = await import("@/lib/export/fincen-xml")

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml(
        "fy-1",
        createMockTransmitter(),
        createMockPreparer(),
        summary
      )

      for (const account of summary.accounts) {
        expect(csv).toContain(account.accountNumber)
        expect(xml).toContain(account.accountNumber)
      }
    })

    it("CSV masks TIN while XML contains full TIN", async () => {
      const summary = createMockReviewSummary()
      mockGetReviewSummary.mockResolvedValue(summary)
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFBARCsv } = await import("@/lib/export/csv")
      const { generateFincenXml } = await import("@/lib/export/fincen-xml")

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml(
        "fy-1",
        createMockTransmitter(),
        createMockPreparer(),
        summary
      )

      // CSV: TIN is masked
      expect(csv).not.toContain("123456789")
      expect(csv).toContain("***-**-6789")

      // XML: TIN is unmasked (required for FinCEN submission)
      expect(xml).toContain("123456789")
    })
  })

  // -------------------------------------------------------------------------
  // XML SeqNum uniqueness
  // -------------------------------------------------------------------------

  describe("XML SeqNum uniqueness", () => {
    it("all SeqNum values are unique across the document", async () => {
      const xml = await setupAndGenerateXml()

      const { validateFincenXml } = await import("@/lib/export/fincen-xml")
      const validation = validateFincenXml(xml)

      // The validator checks SeqNum uniqueness
      const seqNumErrors = validation.errors.filter((e) =>
        e.includes("Duplicate SeqNum")
      )
      expect(seqNumErrors).toHaveLength(0)

      // Double-check by extracting all SeqNums manually
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
  })

  // -------------------------------------------------------------------------
  // XML amended filing indicator
  // -------------------------------------------------------------------------

  describe("XML filing type indicators", () => {
    it("sets CorrectsAmendsPriorReportIndicator correctly for initial filing", async () => {
      const xml = await setupAndGenerateXml()

      // For initial filings, indicator should be "N" or empty
      const hasN = xml.includes(
        "<fc2:CorrectsAmendsPriorReportIndicator>N</fc2:CorrectsAmendsPriorReportIndicator>"
      )
      const hasEmpty = xml.includes(
        "<fc2:CorrectsAmendsPriorReportIndicator/>"
      ) || xml.includes(
        "<fc2:CorrectsAmendsPriorReportIndicator></fc2:CorrectsAmendsPriorReportIndicator>"
      )
      expect(hasN || hasEmpty).toBe(true)
    })

    it("sets CorrectsAmendsPriorReportIndicator to Y for amended filing", async () => {
      const filingYear = {
        ...createMockFilingYearForXml(),
        filingType: "AMENDED",
      }

      const xml = await setupAndGenerateXml({ filingYear })

      expect(xml).toContain(
        "<fc2:CorrectsAmendsPriorReportIndicator>Y</fc2:CorrectsAmendsPriorReportIndicator>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // XML value unknown indicator
  // -------------------------------------------------------------------------

  describe("XML value unknown handling", () => {
    it("sets UnknownMaximumValueIndicator for unknown-value accounts", async () => {
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
        ],
        aggregateMaxValueUSD: 0,
        exceedsThreshold: false,
      })

      const filingYear = {
        ...createMockFilingYearForXml(),
        reviewedAccountYears: [
          {
            id: "ray-1",
            foreignAccountId: "fa-1",
            maxValueLocal: null,
            maxValueUsd: null,
            isValueUnknown: true,
            currencyCode: null,
            exchangeRate: null,
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
          } as any,
        ],
      }

      const xml = await setupAndGenerateXml({ summary, filingYear })

      expect(xml).toContain(
        "<fc2:UnknownMaximumValueIndicator>Y</fc2:UnknownMaximumValueIndicator>"
      )
      expect(xml).toContain(
        "<fc2:AccountMaximumValueAmountText>0</fc2:AccountMaximumValueAmountText>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // XML batch attributes
  // -------------------------------------------------------------------------

  describe("XML batch attributes", () => {
    it("sets correct PartyCount and AccountCount", async () => {
      const xml = await setupAndGenerateXml()

      // PartyCount = number of type-41 FI parties = 2 (one per account)
      expect(xml).toContain('PartyCount="2"')

      // AccountCount = 2 accounts
      expect(xml).toContain('AccountCount="2"')

      // ActivityCount = always 1
      expect(xml).toContain('ActivityCount="1"')

      // Owner counts default to 0
      expect(xml).toContain('JointlyOwnedOwnerCount="0"')
      expect(xml).toContain('NoFIOwnerCount="0"')
      expect(xml).toContain('ConsolidatedOwnerCount="0"')
    })
  })
})
