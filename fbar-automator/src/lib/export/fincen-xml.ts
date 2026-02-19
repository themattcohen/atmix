// ---------------------------------------------------------------------------
// FinCEN BSA E-Filing XML Export Module
// ---------------------------------------------------------------------------
// Generates FinCEN-compliant XML for FBAR (Form 114) batch e-filing.
// Follows the EFL_FBARXBatchSchema.xsd v1.2 structure and FinCEN Line Item
// Filing Instructions v1.4 (August 2021).
//
// IMPORTANT: This module produces XML containing unmasked TINs and full
// account numbers. Output must be treated as PII/sensitive data at rest
// and in transit.
// ---------------------------------------------------------------------------

import { XMLBuilder } from "fast-xml-parser"
import { prisma } from "@/lib/db"
import { getReviewSummary, type ReviewSummary } from "@/lib/approval"
import { safeDecrypt } from "@/lib/encryption"
import type { AccountType, TINType, FilingType } from "@prisma/client"

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface TransmitterConfig {
  name: string           // Practice/firm name
  tin: string            // Practice EIN
  tcc: string            // Transmitter Control Code (PTCC####)
  phone: string          // Practice phone
  address: { street: string; city: string; state: string; zip: string; country?: string }
  contactName: string    // Transmitter contact person name
}

export interface PreparerConfig {
  firstName: string
  lastName: string
  phone: string
  ptin: string           // PTIN for type code 31
  selfEmployed: boolean
  address: { street: string; city: string; state: string; zip: string; country?: string }
  firmName?: string      // If not self-employed
  firmEin?: string       // If not self-employed
}

// ---------------------------------------------------------------------------
// Constants & Mappings
// ---------------------------------------------------------------------------

/** Maps Prisma AccountType enum to FinCEN AccountTypeCode (Bank=1, Securities=2, Other=999) */
const ACCOUNT_TYPE_CODE: Record<AccountType, string> = {
  BANK: "1",
  SECURITIES: "2",
  OTHER: "999",
}

/** Maps Prisma TINType enum to FinCEN PartyIdentificationTypeCode */
const TIN_TYPE_CODE: Record<TINType, string> = {
  SSN: "1",
  ITIN: "1",
  EIN: "2",
  FOREIGN_TIN: "9",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date as YYYYMMDD (no separators) per FinCEN requirements.
 * Returns empty string for null/undefined dates.
 */
function formatDateFincen(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  const yyyy = d.getUTCFullYear().toString()
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0")
  const dd = d.getUTCDate().toString().padStart(2, "0")
  return `${yyyy}${mm}${dd}`
}

/**
 * Parses a JSON address field into typed components.
 * Returns empty strings for missing fields.
 */
function parseAddress(
  addr: unknown
): { street: string; city: string; state: string; zip: string; country: string } {
  if (!addr || typeof addr !== "object") {
    return { street: "", city: "", state: "", zip: "", country: "" }
  }
  const a = addr as Record<string, string | undefined>
  return {
    street: a.street ?? "",
    city: a.city ?? "",
    state: a.state ?? a.stateProvince ?? "",
    zip: a.zip ?? a.postalCode ?? "",
    country: a.country ?? "",
  }
}

/**
 * Determines the EFilingAccountTypeCode based on ownership:
 *   143 = Signature Authority (no financial interest)
 *   142 = Jointly Owned Financial Account
 *   141 = Separately Owned Financial Account (default)
 */
function getEFilingAccountTypeCode(
  ownershipType: string,
  isJointlyOwned: boolean
): string {
  if (ownershipType === "SIGNATURE_AUTHORITY") return "143"
  if (isJointlyOwned) return "142"
  return "141"
}

/**
 * Manages a monotonically increasing sequence counter for XML SeqNum
 * attributes. FinCEN requires each element to have a unique SeqNum.
 * First call to next() returns 1.
 */
class SeqNumCounter {
  private current = 0

  next(): number {
    return ++this.current
  }

  /** Returns the highest SeqNum issued so far. */
  get value(): number {
    return this.current
  }
}

// ---------------------------------------------------------------------------
// generateFincenXml
// ---------------------------------------------------------------------------

/**
 * Generates a complete FinCEN BSA E-Filing XML document for an FBAR
 * (Form 114) filing year.
 *
 * The XML follows the EFilingBatchXML schema with one Activity element
 * containing activity-level Parties (transmitter, contact, filer, preparer),
 * Account elements (each with a nested financial institution Party), and
 * a ForeignAccountActivity element.
 *
 * @param filingYearId - The FilingYear ID to generate XML for
 * @param transmitter - Transmitter (practice/firm) configuration
 * @param preparer - Third-party preparer configuration
 * @param prefetchedSummary - Optional pre-fetched review data (avoids redundant DB queries)
 * @returns Well-formed XML string with XML declaration
 *
 * @throws Error if filingYear or client data is missing required fields
 */
export async function generateFincenXml(
  filingYearId: string,
  transmitter: TransmitterConfig,
  preparer: PreparerConfig,
  prefetchedSummary?: ReviewSummary
): Promise<string> {
  // -----------------------------------------------------------------------
  // 1. Fetch data
  // -----------------------------------------------------------------------

  const [summary, filingYear] = await Promise.all([
    prefetchedSummary ?? getReviewSummary(filingYearId),
    prisma.filingYear.findUniqueOrThrow({
      where: { id: filingYearId },
      include: {
        client: true,
        reviewedAccountYears: {
          include: { foreignAccount: true },
        },
      },
    }),
  ])

  const { client } = filingYear
  const seq = new SeqNumCounter()

  // -----------------------------------------------------------------------
  // 2. Build Activity element
  // -----------------------------------------------------------------------

  const today = formatDateFincen(new Date())
  const isAmended = filingYear.filingType === ("AMENDED" as FilingType)

  const activitySeq = seq.next() // 1

  // Activity-level fields (in schema order)
  const activity: Record<string, unknown> = {
    "@_SeqNum": String(activitySeq),
    "fc2:ApprovalOfficialSignatureDateText": today,
    "fc2:EFilingPriorDocumentNumber": "",
    "fc2:ThirdPartyPreparerIndicator": "Y",
  }

  // ActivityAssociation
  const assocSeq = seq.next()
  activity["fc2:ActivityAssociation"] = {
    "@_SeqNum": String(assocSeq),
    "fc2:CorrectsAmendsPriorReportIndicator": isAmended ? "Y" : "",
  }

  // -----------------------------------------------------------------------
  // 3. Build activity-level Party elements
  // -----------------------------------------------------------------------

  const activityParties: Record<string, unknown>[] = []

  // --- Party[0]: Transmitter (type 35) ---
  const txPartySeq = seq.next()
  const txNameSeq = seq.next()
  const txAddrSeq = seq.next()
  const txPhoneSeq = seq.next()
  const txIdTinSeq = seq.next()
  const txIdTccSeq = seq.next()

  activityParties.push({
    "@_SeqNum": String(txPartySeq),
    "fc2:ActivityPartyTypeCode": "35",
    "fc2:PartyName": {
      "@_SeqNum": String(txNameSeq),
      "fc2:PartyNameTypeCode": "L",
      "fc2:RawPartyLegalName": transmitter.name,
    },
    "fc2:Address": {
      "@_SeqNum": String(txAddrSeq),
      "fc2:RawCityText": transmitter.address.city,
      "fc2:RawCountryCodeText": transmitter.address.country ?? "US",
      "fc2:RawStateCodeText": transmitter.address.state,
      "fc2:RawStreetAddress1Text": transmitter.address.street,
      "fc2:RawZIPCode": transmitter.address.zip,
    },
    "fc2:PhoneNumber": {
      "@_SeqNum": String(txPhoneSeq),
      "fc2:PhoneNumberText": transmitter.phone,
    },
    "fc2:PartyIdentification": [
      {
        "@_SeqNum": String(txIdTinSeq),
        "fc2:PartyIdentificationNumberText": transmitter.tin,
        "fc2:PartyIdentificationTypeCode": "4",
      },
      {
        "@_SeqNum": String(txIdTccSeq),
        "fc2:PartyIdentificationNumberText": transmitter.tcc,
        "fc2:PartyIdentificationTypeCode": "28",
      },
    ],
  })

  // --- Party[1]: Transmitter Contact (type 37) ---
  const tcPartySeq = seq.next()
  const tcNameSeq = seq.next()

  // Split contact name into first/last
  const contactParts = transmitter.contactName.trim().split(/\s+/)
  const contactFirst = contactParts.slice(0, -1).join(" ") || contactParts[0]
  const contactLast = contactParts.length > 1 ? contactParts[contactParts.length - 1] : ""

  activityParties.push({
    "@_SeqNum": String(tcPartySeq),
    "fc2:ActivityPartyTypeCode": "37",
    "fc2:PartyName": {
      "@_SeqNum": String(tcNameSeq),
      "fc2:PartyNameTypeCode": "L",
      "fc2:RawIndividualFirstName": contactFirst,
      "fc2:RawEntityIndividualLastName": contactLast,
    },
  })

  // --- Party[2]: Foreign Account Filer (type 15) ---
  const filerPartySeq = seq.next()

  // Determine filer address (foreign address takes precedence)
  const hasForeignAddr = client.foreignAddress && typeof client.foreignAddress === "object"
  const filerAddr = hasForeignAddr
    ? parseAddress(client.foreignAddress)
    : parseAddress(client.usAddress)
  const filerCountry = hasForeignAddr ? filerAddr.country : "US"

  // Determine if any account has signature authority
  const hasSignatureAuthority = filingYear.reviewedAccountYears.some(
    (ray) =>
      ray.foreignAccount.ownershipType === "SIGNATURE_AUTHORITY" ||
      ray.foreignAccount.ownershipType === "BOTH"
  )

  const filerParty: Record<string, unknown> = {
    "@_SeqNum": String(filerPartySeq),
    "fc2:ActivityPartyTypeCode": "15",
    "fc2:FilerFinancialInterest25ForeignAccountIndicator":
      filingYear.has25PlusAccounts ? "Y" : "N",
    "fc2:FilerTypeIndividualIndicator": "Y",
  }

  if (client.dateOfBirth) {
    filerParty["fc2:IndividualBirthDateText"] = formatDateFincen(client.dateOfBirth)
  }

  filerParty["fc2:SignatureAuthoritiesIndicator"] = hasSignatureAuthority ? "Y" : "N"

  const filerNameSeq = seq.next()
  filerParty["fc2:PartyName"] = {
    "@_SeqNum": String(filerNameSeq),
    "fc2:PartyNameTypeCode": "L",
    "fc2:RawEntityIndividualLastName": client.lastName,
    "fc2:RawIndividualFirstName": client.firstName ?? "",
  }

  const filerAddrSeq = seq.next()
  filerParty["fc2:Address"] = {
    "@_SeqNum": String(filerAddrSeq),
    "fc2:RawCityText": filerAddr.city,
    "fc2:RawCountryCodeText": filerCountry,
    "fc2:RawStateCodeText": filerAddr.state,
    "fc2:RawStreetAddress1Text": filerAddr.street,
    "fc2:RawZIPCode": filerAddr.zip,
  }

  if (client.tin && client.tinType) {
    const filerIdSeq = seq.next()
    const decryptedTin = safeDecrypt(client.tin)
    filerParty["fc2:PartyIdentification"] = {
      "@_SeqNum": String(filerIdSeq),
      "fc2:PartyIdentificationNumberText": decryptedTin,
      "fc2:PartyIdentificationTypeCode": TIN_TYPE_CODE[client.tinType],
    }
  }

  activityParties.push(filerParty)

  // --- Party[3]: Third Party Preparer (type 57) ---
  const prepPartySeq = seq.next()
  const prepNameSeq = seq.next()
  const prepAddrSeq = seq.next()
  const prepPhoneSeq = seq.next()
  const prepIdSeq = seq.next()

  activityParties.push({
    "@_SeqNum": String(prepPartySeq),
    "fc2:ActivityPartyTypeCode": "57",
    "fc2:PartyName": {
      "@_SeqNum": String(prepNameSeq),
      "fc2:PartyNameTypeCode": "L",
      "fc2:RawEntityIndividualLastName": preparer.lastName,
      "fc2:RawIndividualFirstName": preparer.firstName,
    },
    "fc2:Address": {
      "@_SeqNum": String(prepAddrSeq),
      "fc2:RawCityText": preparer.address.city,
      "fc2:RawCountryCodeText": preparer.address.country ?? "US",
      "fc2:RawStateCodeText": preparer.address.state,
      "fc2:RawStreetAddress1Text": preparer.address.street,
      "fc2:RawZIPCode": preparer.address.zip,
    },
    "fc2:PhoneNumber": {
      "@_SeqNum": String(prepPhoneSeq),
      "fc2:PhoneNumberText": preparer.phone,
    },
    "fc2:PartyIdentification": {
      "@_SeqNum": String(prepIdSeq),
      "fc2:PartyIdentificationNumberText": preparer.ptin,
      "fc2:PartyIdentificationTypeCode": "31",
    },
  })

  // --- Party[4]: Third Party Preparer Firm (type 56) — only if not self-employed ---
  if (!preparer.selfEmployed && preparer.firmName) {
    const firmPartySeq = seq.next()
    const firmNameSeq = seq.next()
    const firmIdSeq = seq.next()

    activityParties.push({
      "@_SeqNum": String(firmPartySeq),
      "fc2:ActivityPartyTypeCode": "56",
      "fc2:PartyName": {
        "@_SeqNum": String(firmNameSeq),
        "fc2:PartyNameTypeCode": "L",
        "fc2:RawPartyLegalName": preparer.firmName,
      },
      "fc2:PartyIdentification": {
        "@_SeqNum": String(firmIdSeq),
        "fc2:PartyIdentificationNumberText": preparer.firmEin ?? "",
        "fc2:PartyIdentificationTypeCode": "4",
      },
    })
  }

  // -----------------------------------------------------------------------
  // 4. Build Account elements (siblings of Party at Activity level)
  // -----------------------------------------------------------------------

  const accountElements: Record<string, unknown>[] = []
  let type41Count = 0

  for (const ray of filingYear.reviewedAccountYears) {
    const fa = ray.foreignAccount

    // Calculate max value in whole USD dollars
    const maxValueUsd = ray.isValueUnknown
      ? 0
      : Math.round(Number(ray.maxValueUsd ?? 0))

    // Decrypt account number
    const decryptedAccountNumber = safeDecrypt(fa.accountNumber)

    const accountSeq = seq.next()

    const accountElement: Record<string, unknown> = {
      "@_SeqNum": String(accountSeq),
      "fc2:AccountMaximumValueAmountText": String(maxValueUsd),
      "fc2:AccountNumberText": decryptedAccountNumber,
      "fc2:AccountTypeCode": ACCOUNT_TYPE_CODE[fa.accountType],
      "fc2:EFilingAccountTypeCode": getEFilingAccountTypeCode(
        fa.ownershipType,
        fa.isJointlyOwned
      ),
    }

    // Add unknown value indicator if value is unknown
    if (ray.isValueUnknown) {
      accountElement["fc2:UnknownMaximumValueIndicator"] = "Y"
    }

    // Nested Party: Financial Institution (type 41)
    const fiPartySeq = seq.next()
    const fiNameSeq = seq.next()
    const fiAddrSeq = seq.next()
    type41Count++

    accountElement["fc2:Party"] = {
      "@_SeqNum": String(fiPartySeq),
      "fc2:ActivityPartyTypeCode": "41",
      "fc2:PartyName": {
        "@_SeqNum": String(fiNameSeq),
        "fc2:PartyNameTypeCode": "L",
        "fc2:RawPartyLegalName": fa.institutionName,
      },
      "fc2:Address": {
        "@_SeqNum": String(fiAddrSeq),
        "fc2:RawCityText": fa.institutionAddressCity ?? "",
        "fc2:RawCountryCodeText": fa.institutionAddressCountry ?? "",
        "fc2:RawStreetAddress1Text": fa.institutionAddressStreet ?? "",
        "fc2:RawZIPCode": fa.institutionAddressPostal ?? "",
      },
    }

    accountElements.push(accountElement)
  }

  // -----------------------------------------------------------------------
  // 5. Assemble Activity children
  // -----------------------------------------------------------------------

  // Parties array
  activity["fc2:Party"] = activityParties.length === 1
    ? activityParties[0]
    : activityParties

  // Accounts
  if (accountElements.length === 1) {
    activity["fc2:Account"] = accountElements[0]
  } else if (accountElements.length > 1) {
    activity["fc2:Account"] = accountElements
  }

  // ForeignAccountActivity (required)
  const faaSeq = seq.next()
  activity["fc2:ForeignAccountActivity"] = {
    "@_SeqNum": String(faaSeq),
    "fc2:ReportCalendarYearText": String(filingYear.calendarYear),
  }

  // -----------------------------------------------------------------------
  // 6. Build root element
  // -----------------------------------------------------------------------

  const root = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    "fc2:EFilingBatchXML": {
      "@_ActivityCount": "1",
      "@_PartyCount": String(type41Count),
      "@_AccountCount": String(accountElements.length),
      "@_JointlyOwnedOwnerCount": "0",
      "@_NoFIOwnerCount": "0",
      "@_ConsolidatedOwnerCount": "0",
      "@_xsi:schemaLocation": "www.fincen.gov/base/EFL_FBARXBatchSchema.xsd",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xmlns:fc2": "www.fincen.gov/base",
      "fc2:FormTypeCode": "FBARX",
      "fc2:Activity": activity,
    },
  }

  // -----------------------------------------------------------------------
  // 7. Serialize to XML
  // -----------------------------------------------------------------------

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: false,
    processEntities: true,
  })

  const xml: string = builder.build(root)
  return xml
}

// ---------------------------------------------------------------------------
// validateFincenXml
// ---------------------------------------------------------------------------

/**
 * Performs structural validation of generated FinCEN XML to catch
 * obvious issues before submission. This is NOT a full XSD validation
 * but checks the most critical structural requirements.
 *
 * @param xml - The XML string to validate
 * @returns Validation result with any errors found
 */
export function validateFincenXml(
  xml: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // -----------------------------------------------------------------------
  // 1. Check required root element (with fc2: prefix)
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:EFilingBatchXML")) {
    errors.push("Missing root element: fc2:EFilingBatchXML")
  }

  // -----------------------------------------------------------------------
  // 2. Check Activity element exists
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:Activity")) {
    errors.push("Missing required element: fc2:Activity")
  }

  // -----------------------------------------------------------------------
  // 3. Check FormTypeCode
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>")) {
    errors.push("Missing or incorrect FormTypeCode (expected FBARX)")
  }

  // -----------------------------------------------------------------------
  // 4. Check filer Party (ActivityPartyTypeCode 15)
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>")) {
    errors.push(
      "Missing filer Party element (ActivityPartyTypeCode 15)"
    )
  }

  // -----------------------------------------------------------------------
  // 5. Check transmitter Party (ActivityPartyTypeCode 35)
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>")) {
    errors.push(
      "Missing transmitter Party element (ActivityPartyTypeCode 35)"
    )
  }

  // -----------------------------------------------------------------------
  // 6. Check Account elements exist
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:Account")) {
    errors.push("Missing Account elements")
  }

  // -----------------------------------------------------------------------
  // 7. Check ForeignAccountActivity with ReportCalendarYearText
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:ForeignAccountActivity")) {
    errors.push("Missing ForeignAccountActivity element")
  }

  if (!xml.includes("<fc2:ReportCalendarYearText>")) {
    errors.push("Missing ReportCalendarYearText in ForeignAccountActivity")
  }

  // -----------------------------------------------------------------------
  // 8. Check SeqNum uniqueness
  // -----------------------------------------------------------------------

  const seqNumPattern = /SeqNum="(\d+)"/g
  const seqNums: string[] = []
  let match: RegExpExecArray | null
  while ((match = seqNumPattern.exec(xml)) !== null) {
    seqNums.push(match[1])
  }

  const seqNumSet = new Set(seqNums)
  if (seqNumSet.size !== seqNums.length) {
    const duplicates = seqNums.filter(
      (num, idx) => seqNums.indexOf(num) !== idx
    )
    const uniqueDuplicates = Array.from(new Set(duplicates))
    errors.push(
      `Duplicate SeqNum values found: ${uniqueDuplicates.join(", ")}`
    )
  }

  // -----------------------------------------------------------------------
  // 9. Validate date formats (YYYYMMDD)
  // -----------------------------------------------------------------------

  const dateElements = [
    "ApprovalOfficialSignatureDateText",
    "IndividualBirthDateText",
  ]

  for (const elem of dateElements) {
    const datePattern = new RegExp(
      `<fc2:${elem}>([^<]+)</fc2:${elem}>`
    )
    const dateMatch = datePattern.exec(xml)
    if (dateMatch) {
      const dateValue = dateMatch[1].trim()
      if (dateValue && !/^\d{8}$/.test(dateValue)) {
        errors.push(
          `Invalid date format in ${elem}: "${dateValue}" (expected YYYYMMDD)`
        )
      }
    }
  }

  // -----------------------------------------------------------------------
  // 10. Validate AccountMaximumValueAmountText is a non-negative integer
  // -----------------------------------------------------------------------

  const amountPattern =
    /<fc2:AccountMaximumValueAmountText>([^<]+)<\/fc2:AccountMaximumValueAmountText>/g
  let amountMatch: RegExpExecArray | null
  while ((amountMatch = amountPattern.exec(xml)) !== null) {
    const amountValue = amountMatch[1].trim()
    if (!/^\d+$/.test(amountValue)) {
      errors.push(
        `Invalid AccountMaximumValueAmountText: "${amountValue}" (must be a non-negative integer)`
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
