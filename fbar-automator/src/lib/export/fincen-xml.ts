// ---------------------------------------------------------------------------
// FinCEN BSA E-Filing XML Export Module
// ---------------------------------------------------------------------------
// Generates FinCEN-compliant XML for FBAR (Form 114) batch e-filing.
// Follows the EFL_FBARXBatchSchema.xsd structure and FinCEN Line Item
// Filing Instructions.
//
// IMPORTANT: This module produces XML containing unmasked TINs and full
// account numbers. Output must be treated as PII/sensitive data at rest
// and in transit.
// ---------------------------------------------------------------------------

import { XMLBuilder } from "fast-xml-parser"
import { prisma } from "@/lib/db"
import { getReviewSummary, type ReviewSummary } from "@/lib/approval"
import { safeDecrypt } from "@/lib/encryption"
import type { AccountType, OwnershipType, TINType, FilingType } from "@prisma/client"

// ---------------------------------------------------------------------------
// Constants & Mappings
// ---------------------------------------------------------------------------

/** Maps Prisma AccountType enum to FinCEN EFilingAccountTypeCode */
const ACCOUNT_TYPE_CODE: Record<AccountType, string> = {
  BANK: "1",
  SECURITIES: "2",
  OTHER: "3",
}

/** Maps Prisma TINType enum to FinCEN PartyIdentificationTypeCode */
const TIN_TYPE_CODE: Record<TINType, string> = {
  SSN: "1",
  ITIN: "1",
  EIN: "2",
  FOREIGN_TIN: "14",
}

/** Maps Prisma OwnershipType to FinCEN PartyAccountAssociationTypeCode(s) */
const OWNERSHIP_TYPE_CODES: Record<OwnershipType, string[]> = {
  FINANCIAL_INTEREST: ["8"],
  SIGNATURE_AUTHORITY: ["9"],
  BOTH: ["8", "9"],
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
 * Parses the Client.usAddress JSON field into typed components.
 * Returns empty strings for missing fields.
 */
function parseUsAddress(
  usAddress: unknown
): { street: string; city: string; state: string; zip: string } {
  if (!usAddress || typeof usAddress !== "object") {
    return { street: "", city: "", state: "", zip: "" }
  }
  const addr = usAddress as Record<string, string | undefined>
  return {
    street: addr.street ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    zip: addr.zip ?? "",
  }
}

/**
 * Manages a monotonically increasing sequence counter for XML SeqNum
 * attributes. FinCEN requires each element to have a unique SeqNum.
 */
class SeqNumCounter {
  private current = 1

  next(): number {
    this.current += 1
    return this.current
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
 * containing the filer Party and one Party per foreign account.
 *
 * @param filingYearId - The FilingYear ID to generate XML for
 * @param prefetchedSummary - Optional pre-fetched review data (avoids redundant DB queries)
 * @returns Well-formed XML string with XML declaration
 *
 * @throws Error if filingYear or client data is missing required fields
 */
export async function generateFincenXml(
  filingYearId: string,
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
  // 2. Build filer Party (Part I)
  // -----------------------------------------------------------------------

  const filerAddress = parseUsAddress(client.usAddress)

  const filerPartySeq = seq.next() // Party element
  const filerNameSeq = seq.next() // PartyName element
  const filerAddressSeq = seq.next() // Address element
  const filerIdSeq = seq.next() // PartyIdentification element

  const filerParty: Record<string, unknown> = {
    "@_SeqNum": String(filerPartySeq),
    ActivityPartyTypeCode: "35",
    FilerFinancialInterest25ForeignAccountIndicator:
      filingYear.has25PlusAccounts ? "Y" : "N",
    FilerTypeIndividualIndicator: client.type === "INDIVIDUAL" ? "Y" : "N",
  }

  // Include date of birth for individuals
  if (client.dateOfBirth) {
    filerParty.IndividualBirthDateText = formatDateFincen(client.dateOfBirth)
  }

  filerParty.PartyName = {
    "@_SeqNum": String(filerNameSeq),
    PartyNameTypeCode: "L",
    RawIndividualLastName: client.lastName,
    RawIndividualFirstName: client.firstName ?? "",
  }

  filerParty.Address = {
    "@_SeqNum": String(filerAddressSeq),
    RawCityText: filerAddress.city,
    RawCountryCodeText: "US",
    RawStateCodeText: filerAddress.state,
    RawStreetAddress1Text: filerAddress.street,
    RawZIPCode: filerAddress.zip,
  }

  if (client.tin && client.tinType) {
    // Decrypt TIN for FinCEN XML export (required to be unmasked)
    const decryptedTin = safeDecrypt(client.tin)
    filerParty.PartyIdentification = {
      "@_SeqNum": String(filerIdSeq),
      PartyIdentificationNumberText: decryptedTin,
      PartyIdentificationTypeCode: TIN_TYPE_CODE[client.tinType],
    }
  }

  // -----------------------------------------------------------------------
  // 3. Build account Parties (Part II / Part III)
  // -----------------------------------------------------------------------

  const accountParties: Record<string, unknown>[] = []

  for (const ray of filingYear.reviewedAccountYears) {
    const fa = ray.foreignAccount

    const partySeq = seq.next()
    const nameSeq = seq.next()
    const addressSeq = seq.next()
    const accountSeq = seq.next()

    // Determine Party type code: 41 for individual accounts, 42 for joint
    const activityPartyTypeCode = fa.isJointlyOwned ? "42" : "41"

    // Calculate max value in whole USD dollars
    const maxValueUsd = ray.isValueUnknown
      ? 0
      : Math.round(Number(ray.maxValueUsd ?? 0))

    // Build account element
    const accountElement: Record<string, unknown> = {
      "@_SeqNum": String(accountSeq),
      AccountMaximumValueAmountText: String(maxValueUsd),
      EFilingAccountTypeCode: ACCOUNT_TYPE_CODE[fa.accountType],
    }

    // Add unknown value indicator if value is unknown
    if (ray.isValueUnknown) {
      accountElement.UnknownMaximumValueIndicator = "Y"
    }

    // Build PartyAccountAssociation(s) based on ownership type
    const associationCodes = OWNERSHIP_TYPE_CODES[fa.ownershipType]
    const associations = associationCodes.map((code) => {
      const assocSeq = seq.next()
      return {
        "@_SeqNum": String(assocSeq),
        PartyAccountAssociationTypeCode: code,
        AccountNumberText: fa.accountNumber,
      }
    })

    // fast-xml-parser: single item = object, multiple = array
    accountElement.PartyAccountAssociation =
      associations.length === 1 ? associations[0] : associations

    const accountParty: Record<string, unknown> = {
      "@_SeqNum": String(partySeq),
      ActivityPartyTypeCode: activityPartyTypeCode,
      PartyName: {
        "@_SeqNum": String(nameSeq),
        PartyNameTypeCode: "L",
        RawPartyFullName: fa.institutionName,
      },
      Address: {
        "@_SeqNum": String(addressSeq),
        RawCityText: fa.institutionAddressCity ?? "",
        RawCountryCodeText: fa.institutionAddressCountry ?? "",
        RawStateCodeText: fa.institutionAddressState ?? "",
        RawStreetAddress1Text: fa.institutionAddressStreet ?? "",
        RawZIPCode: fa.institutionAddressPostal ?? "",
      },
      Account: accountElement,
    }

    accountParties.push(accountParty)
  }

  // -----------------------------------------------------------------------
  // 4. Build Activity element
  // -----------------------------------------------------------------------

  const today = formatDateFincen(new Date())
  const isAmended = filingYear.filingType === ("AMENDED" as FilingType)

  const activitySeq = seq.next()
  const assocSeq = seq.next()

  const activity: Record<string, unknown> = {
    "@_SeqNum": String(activitySeq),
    ApprovalOfficialSignatureDateText: today,
    EFilingPriorDocumentNumber: "",
    FilingDateText: today,
    ActivityAssociation: {
      "@_SeqNum": String(assocSeq),
      CorrectsAmendsPriorReportIndicator: isAmended ? "Y" : "N",
    },
    Party: [filerParty, ...accountParties],
  }

  // -----------------------------------------------------------------------
  // 5. Build root element
  // -----------------------------------------------------------------------

  const totalPartyCount = 1 + accountParties.length // filer + accounts

  const root = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    EFilingBatchXML: {
      "@_xmlns": "www.fincen.gov/base",
      "@_xmlns:fc2": "www.fincen.gov/base",
      "@_SeqNum": "1",
      "@_StatusCode": "A",
      "@_TotalAmount": "0",
      "@_PartyCount": String(totalPartyCount),
      "@_ActivityCount": "1",
      "@_AccountCount": String(accountParties.length),
      Activity: activity,
    },
  }

  // -----------------------------------------------------------------------
  // 6. Serialize to XML
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
  // 1. Check required root element
  // -----------------------------------------------------------------------

  if (!xml.includes("<EFilingBatchXML")) {
    errors.push("Missing root element: EFilingBatchXML")
  }

  // -----------------------------------------------------------------------
  // 2. Check Activity element exists
  // -----------------------------------------------------------------------

  if (!xml.includes("<Activity")) {
    errors.push("Missing required element: Activity")
  }

  // -----------------------------------------------------------------------
  // 3. Check filer Party (ActivityPartyTypeCode 35)
  // -----------------------------------------------------------------------

  if (!xml.includes("<ActivityPartyTypeCode>35</ActivityPartyTypeCode>")) {
    errors.push(
      "Missing filer Party element (ActivityPartyTypeCode 35)"
    )
  }

  // -----------------------------------------------------------------------
  // 4. Check at least one account Party (type 41 or 42)
  // -----------------------------------------------------------------------

  const hasType41 = xml.includes(
    "<ActivityPartyTypeCode>41</ActivityPartyTypeCode>"
  )
  const hasType42 = xml.includes(
    "<ActivityPartyTypeCode>42</ActivityPartyTypeCode>"
  )

  if (!hasType41 && !hasType42) {
    errors.push(
      "Missing account Party element (ActivityPartyTypeCode 41 or 42)"
    )
  }

  // -----------------------------------------------------------------------
  // 5. Check SeqNum uniqueness
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
    const uniqueDuplicates = [...Array.from(new Set(duplicates))]
    errors.push(
      `Duplicate SeqNum values found: ${uniqueDuplicates.join(", ")}`
    )
  }

  // -----------------------------------------------------------------------
  // 6. Validate date formats (YYYYMMDD)
  // -----------------------------------------------------------------------

  const dateElements = [
    "ApprovalOfficialSignatureDateText",
    "FilingDateText",
    "IndividualBirthDateText",
  ]

  for (const elem of dateElements) {
    const datePattern = new RegExp(
      `<${elem}>([^<]+)</${elem}>`
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
  // 7. Validate AccountMaximumValueAmountText is a non-negative integer
  // -----------------------------------------------------------------------

  const amountPattern =
    /<AccountMaximumValueAmountText>([^<]+)<\/AccountMaximumValueAmountText>/g
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
