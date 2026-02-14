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
    findFirst: vi.fn(),
  },
}

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}))

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
 * to getReviewSummary.
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
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")
      const validation = validateFincenXml(xml)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it("validates malformed XML correctly", async () => {
      const { validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const badXml = "<root><Activity></Activity></root>"
      const validation = validateFincenXml(badXml)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // 4. XML required elements
  // -------------------------------------------------------------------------

  describe("XML required elements", () => {
    it("contains Activity, filer Party, and account Parties", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // Root element
      expect(xml).toContain("<EFilingBatchXML")

      // Activity element
      expect(xml).toContain("<Activity")

      // Filer Party (type 35)
      expect(xml).toContain(
        "<ActivityPartyTypeCode>35</ActivityPartyTypeCode>"
      )

      // Account Parties (type 41 for individual, non-joint accounts)
      expect(xml).toContain(
        "<ActivityPartyTypeCode>41</ActivityPartyTypeCode>"
      )

      // PartyName for filer
      expect(xml).toContain("<RawIndividualLastName>Doe</RawIndividualLastName>")
      expect(xml).toContain(
        "<RawIndividualFirstName>John</RawIndividualFirstName>"
      )

      // PartyName for institutions
      expect(xml).toContain(
        "<RawPartyFullName>Swiss Bank Corp</RawPartyFullName>"
      )
      expect(xml).toContain(
        "<RawPartyFullName>Tokyo Securities</RawPartyFullName>"
      )

      // Filer TIN (unmasked in XML)
      expect(xml).toContain(
        "<PartyIdentificationNumberText>123456789</PartyIdentificationNumberText>"
      )

      // Account numbers
      expect(xml).toContain(
        "<AccountNumberText>CH-123456</AccountNumberText>"
      )
      expect(xml).toContain(
        "<AccountNumberText>JP-789012</AccountNumberText>"
      )
    })

    it("includes filer address elements", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      expect(xml).toContain(
        "<RawStreetAddress1Text>123 Main Street</RawStreetAddress1Text>"
      )
      expect(xml).toContain("<RawCityText>New York</RawCityText>")
      expect(xml).toContain("<RawStateCodeText>NY</RawStateCodeText>")
      expect(xml).toContain("<RawZIPCode>10001</RawZIPCode>")
      expect(xml).toContain(
        "<RawCountryCodeText>US</RawCountryCodeText>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // 5. XML account type mapping
  // -------------------------------------------------------------------------

  describe("XML account type mapping", () => {
    it("maps BANK to code 1, SECURITIES to code 2", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // BANK -> 1
      expect(xml).toContain(
        "<EFilingAccountTypeCode>1</EFilingAccountTypeCode>"
      )
      // SECURITIES -> 2
      expect(xml).toContain(
        "<EFilingAccountTypeCode>2</EFilingAccountTypeCode>"
      )
    })

    it("maps OTHER account type to code 3", async () => {
      const summaryWithOther = createMockReviewSummary({
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
      mockGetReviewSummary.mockResolvedValue(summaryWithOther)

      const xmlFilingYear = {
        ...createMockFilingYearForXml(),
        reviewedAccountYears: [
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
        ],
      }
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        xmlFilingYear
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // OTHER -> 3
      expect(xml).toContain(
        "<EFilingAccountTypeCode>3</EFilingAccountTypeCode>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // 6. XML date formatting
  // -------------------------------------------------------------------------

  describe("XML date formatting", () => {
    it("formats dates as YYYYMMDD without dashes", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // Date of birth: 1985-03-15 -> 19850315
      expect(xml).toContain(
        "<IndividualBirthDateText>19850315</IndividualBirthDateText>"
      )

      // Filing and signature dates should be YYYYMMDD format
      const dateValidation = validateFincenXml(xml)
      const dateErrors = dateValidation.errors.filter((e) =>
        e.includes("Invalid date format")
      )
      expect(dateErrors).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 7. XML USD amounts
  // -------------------------------------------------------------------------

  describe("XML USD amounts", () => {
    it("outputs amounts as whole dollars without decimals", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // Extract all AccountMaximumValueAmountText values
      const amountPattern =
        /<AccountMaximumValueAmountText>(\d+)<\/AccountMaximumValueAmountText>/g
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

      // Verify the validation also passes for amounts
      const validation = validateFincenXml(xml)
      const amountErrors = validation.errors.filter((e) =>
        e.includes("AccountMaximumValueAmountText")
      )
      expect(amountErrors).toHaveLength(0)
    })

    it("rounds fractional USD values to nearest whole dollar", async () => {
      const summaryWithFractional = createMockReviewSummary()
      mockGetReviewSummary.mockResolvedValue(summaryWithFractional)

      // Use maxValueUsd with fractional cents
      const xmlFilingYear = createMockFilingYearForXml()
      xmlFilingYear.reviewedAccountYears[0].maxValueUsd = 56818.45
      xmlFilingYear.reviewedAccountYears[1].maxValueUsd = 33670.87
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        xmlFilingYear
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // Should be rounded: 56818.45 -> 56818, 33670.87 -> 33671
      expect(xml).toContain(
        "<AccountMaximumValueAmountText>56818</AccountMaximumValueAmountText>"
      )
      expect(xml).toContain(
        "<AccountMaximumValueAmountText>33671</AccountMaximumValueAmountText>"
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
      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml("fy-1")

      // CSV: count data rows (exclude header and summary)
      const csvLines = csv.split("\n").filter((l) => l.trim().length > 0)
      const csvDataRows = csvLines.length - 2 // minus header and summary row

      // XML: count account Parties (type 41 or 42)
      const xmlAccountPartyMatches = xml.match(
        /<ActivityPartyTypeCode>4[12]<\/ActivityPartyTypeCode>/g
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
      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml("fy-1")

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
      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml("fy-1")

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
      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const csv = await generateFBARCsv("fy-1")
      const xml = await generateFincenXml("fy-1")

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
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml, validateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")
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
    it("sets CorrectsAmendsPriorReportIndicator to N for initial filing", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      expect(xml).toContain(
        "<CorrectsAmendsPriorReportIndicator>N</CorrectsAmendsPriorReportIndicator>"
      )
    })

    it("sets CorrectsAmendsPriorReportIndicator to Y for amended filing", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())

      const amendedFilingYear = {
        ...createMockFilingYearForXml(),
        filingType: "AMENDED",
      }
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        amendedFilingYear
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      expect(xml).toContain(
        "<CorrectsAmendsPriorReportIndicator>Y</CorrectsAmendsPriorReportIndicator>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // XML value unknown indicator
  // -------------------------------------------------------------------------

  describe("XML value unknown handling", () => {
    it("sets UnknownMaximumValueIndicator for unknown-value accounts", async () => {
      const summaryWithUnknown = createMockReviewSummary({
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
      mockGetReviewSummary.mockResolvedValue(summaryWithUnknown)

      const xmlFilingYear = {
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
          },
        ],
      }
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        xmlFilingYear
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      expect(xml).toContain(
        "<UnknownMaximumValueIndicator>Y</UnknownMaximumValueIndicator>"
      )
      expect(xml).toContain(
        "<AccountMaximumValueAmountText>0</AccountMaximumValueAmountText>"
      )
    })
  })

  // -------------------------------------------------------------------------
  // XML batch attributes
  // -------------------------------------------------------------------------

  describe("XML batch attributes", () => {
    it("sets correct PartyCount and AccountCount", async () => {
      mockGetReviewSummary.mockResolvedValue(createMockReviewSummary())
      mockPrisma.filingYear.findUniqueOrThrow.mockResolvedValue(
        createMockFilingYearForXml()
      )

      const { generateFincenXml } = await import(
        "@/lib/export/fincen-xml"
      )

      const xml = await generateFincenXml("fy-1")

      // PartyCount = 1 filer + 2 accounts = 3
      expect(xml).toContain('PartyCount="3"')

      // AccountCount = 2 accounts
      expect(xml).toContain('AccountCount="2"')

      // ActivityCount = always 1
      expect(xml).toContain('ActivityCount="1"')
    })
  })
})
