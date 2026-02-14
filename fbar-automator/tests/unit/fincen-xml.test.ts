import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  prisma: {
    filingYear: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}))

vi.mock("@/lib/approval", () => ({
  getReviewSummary: vi.fn(),
}))

import { validateFincenXml } from "@/lib/export/fincen-xml"

// ---------------------------------------------------------------------------
// XML fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a minimal valid FinCEN XML string for testing the validator.
 * All required structural elements are present with unique SeqNums.
 */
function buildValidXml(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    rootOpen: `<EFilingBatchXML xmlns="www.fincen.gov/base" SeqNum="1" StatusCode="A">`,
    rootClose: `</EFilingBatchXML>`,
    activityOpen: `<Activity SeqNum="2">`,
    activityClose: `</Activity>`,
    approvalDate: `<ApprovalOfficialSignatureDateText>20241115</ApprovalOfficialSignatureDateText>`,
    filingDate: `<FilingDateText>20241115</FilingDateText>`,
    activityAssociation: `<ActivityAssociation SeqNum="3"><CorrectsAmendsPriorReportIndicator>N</CorrectsAmendsPriorReportIndicator></ActivityAssociation>`,
    filerParty: `<Party SeqNum="4"><ActivityPartyTypeCode>35</ActivityPartyTypeCode><PartyName SeqNum="5"><PartyNameTypeCode>L</PartyNameTypeCode><RawIndividualLastName>Doe</RawIndividualLastName><RawIndividualFirstName>John</RawIndividualFirstName></PartyName><Address SeqNum="6"><RawCityText>New York</RawCityText><RawCountryCodeText>US</RawCountryCodeText></Address><PartyIdentification SeqNum="7"><PartyIdentificationNumberText>123456789</PartyIdentificationNumberText><PartyIdentificationTypeCode>1</PartyIdentificationTypeCode></PartyIdentification></Party>`,
    accountParty: `<Party SeqNum="8"><ActivityPartyTypeCode>41</ActivityPartyTypeCode><PartyName SeqNum="9"><PartyNameTypeCode>L</PartyNameTypeCode><RawPartyFullName>Swiss National Bank</RawPartyFullName></PartyName><Address SeqNum="10"><RawCityText>Zurich</RawCityText><RawCountryCodeText>CH</RawCountryCodeText></Address><Account SeqNum="11"><AccountMaximumValueAmountText>85000</AccountMaximumValueAmountText><EFilingAccountTypeCode>1</EFilingAccountTypeCode></Account></Party>`,
  }

  const merged = { ...defaults, ...overrides }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    merged.rootOpen,
    merged.activityOpen,
    merged.approvalDate,
    merged.filingDate,
    merged.activityAssociation,
    merged.filerParty,
    merged.accountParty,
    merged.activityClose,
    merged.rootClose,
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// validateFincenXml
// ---------------------------------------------------------------------------

describe("validateFincenXml", () => {
  it("passes validation for valid XML", () => {
    const xml = buildValidXml()
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("fails when Activity element is missing", () => {
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<EFilingBatchXML xmlns="www.fincen.gov/base" SeqNum="1">`,
      `</EFilingBatchXML>`,
    ].join("\n")

    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("Activity"))).toBe(true)
  })

  it("fails when filer Party (type 35) is missing", () => {
    const xml = buildValidXml({
      filerParty: `<Party SeqNum="4"><ActivityPartyTypeCode>99</ActivityPartyTypeCode></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("filer Party"))).toBe(true)
  })

  it("fails when account Party (type 41 or 42) is missing", () => {
    const xml = buildValidXml({
      accountParty: `<Party SeqNum="8"><ActivityPartyTypeCode>35</ActivityPartyTypeCode></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("account Party"))).toBe(true)
  })

  it("passes when account Party uses type 42 (joint)", () => {
    const xml = buildValidXml({
      accountParty: `<Party SeqNum="8"><ActivityPartyTypeCode>42</ActivityPartyTypeCode><PartyName SeqNum="9"><PartyNameTypeCode>L</PartyNameTypeCode><RawPartyFullName>Test Bank</RawPartyFullName></PartyName><Address SeqNum="10"><RawCityText>Zurich</RawCityText></Address><Account SeqNum="11"><AccountMaximumValueAmountText>50000</AccountMaximumValueAmountText><EFilingAccountTypeCode>1</EFilingAccountTypeCode></Account></Party>`,
    })
    const result = validateFincenXml(xml)
    // Should not have account Party error (type 42 is valid)
    expect(result.errors.some((e) => e.includes("account Party"))).toBe(false)
  })

  it("fails when duplicate SeqNum values exist", () => {
    const xml = buildValidXml({
      // SeqNum "4" is duplicated between filerParty and accountParty
      accountParty: `<Party SeqNum="4"><ActivityPartyTypeCode>41</ActivityPartyTypeCode><PartyName SeqNum="12"><PartyNameTypeCode>L</PartyNameTypeCode><RawPartyFullName>Test Bank</RawPartyFullName></PartyName><Address SeqNum="13"><RawCityText>Zurich</RawCityText></Address><Account SeqNum="14"><AccountMaximumValueAmountText>50000</AccountMaximumValueAmountText><EFilingAccountTypeCode>1</EFilingAccountTypeCode></Account></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("Duplicate SeqNum"))).toBe(true)
  })

  it("fails when date format is invalid (not YYYYMMDD)", () => {
    const xml = buildValidXml({
      approvalDate: `<ApprovalOfficialSignatureDateText>2024-11-15</ApprovalOfficialSignatureDateText>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("Invalid date format"))
    ).toBe(true)
  })

  it("fails when AccountMaximumValueAmountText is negative", () => {
    const xml = buildValidXml({
      accountParty: `<Party SeqNum="8"><ActivityPartyTypeCode>41</ActivityPartyTypeCode><PartyName SeqNum="9"><PartyNameTypeCode>L</PartyNameTypeCode><RawPartyFullName>Test Bank</RawPartyFullName></PartyName><Address SeqNum="10"><RawCityText>Zurich</RawCityText></Address><Account SeqNum="11"><AccountMaximumValueAmountText>-5000</AccountMaximumValueAmountText><EFilingAccountTypeCode>1</EFilingAccountTypeCode></Account></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("AccountMaximumValueAmountText"))
    ).toBe(true)
  })

  it("fails when AccountMaximumValueAmountText contains decimals", () => {
    const xml = buildValidXml({
      accountParty: `<Party SeqNum="8"><ActivityPartyTypeCode>41</ActivityPartyTypeCode><PartyName SeqNum="9"><PartyNameTypeCode>L</PartyNameTypeCode><RawPartyFullName>Test Bank</RawPartyFullName></PartyName><Address SeqNum="10"><RawCityText>Zurich</RawCityText></Address><Account SeqNum="11"><AccountMaximumValueAmountText>85000.50</AccountMaximumValueAmountText><EFilingAccountTypeCode>1</EFilingAccountTypeCode></Account></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("non-negative integer"))
    ).toBe(true)
  })

  it("fails when root EFilingBatchXML element is missing", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><SomeOtherRoot></SomeOtherRoot>`
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("EFilingBatchXML"))
    ).toBe(true)
  })

  it("accepts valid IndividualBirthDateText in YYYYMMDD format", () => {
    const xml = buildValidXml({
      filerParty: `<Party SeqNum="4"><ActivityPartyTypeCode>35</ActivityPartyTypeCode><IndividualBirthDateText>19800115</IndividualBirthDateText><PartyName SeqNum="5"><PartyNameTypeCode>L</PartyNameTypeCode><RawIndividualLastName>Doe</RawIndividualLastName><RawIndividualFirstName>John</RawIndividualFirstName></PartyName><Address SeqNum="6"><RawCityText>New York</RawCityText><RawCountryCodeText>US</RawCountryCodeText></Address><PartyIdentification SeqNum="7"><PartyIdentificationNumberText>123456789</PartyIdentificationNumberText><PartyIdentificationTypeCode>1</PartyIdentificationTypeCode></PartyIdentification></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.errors.some((e) => e.includes("IndividualBirthDateText"))).toBe(false)
  })

  it("fails for invalid IndividualBirthDateText format", () => {
    const xml = buildValidXml({
      filerParty: `<Party SeqNum="4"><ActivityPartyTypeCode>35</ActivityPartyTypeCode><IndividualBirthDateText>1980-01-15</IndividualBirthDateText><PartyName SeqNum="5"><PartyNameTypeCode>L</PartyNameTypeCode><RawIndividualLastName>Doe</RawIndividualLastName><RawIndividualFirstName>John</RawIndividualFirstName></PartyName><Address SeqNum="6"><RawCityText>New York</RawCityText><RawCountryCodeText>US</RawCountryCodeText></Address><PartyIdentification SeqNum="7"><PartyIdentificationNumberText>123456789</PartyIdentificationNumberText><PartyIdentificationTypeCode>1</PartyIdentificationTypeCode></PartyIdentification></Party>`,
    })
    const result = validateFincenXml(xml)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.includes("IndividualBirthDateText"))
    ).toBe(true)
  })
})
