// ---------------------------------------------------------------------------
// FinCEN BSA E-Filing XML Export Module — D2C (Self-Filed)
// ---------------------------------------------------------------------------
// Generates FinCEN-compliant XML for FBAR (Form 114) batch e-filing.
// Follows the EFL_FBARXBatchSchema.xsd v1.2 structure and FinCEN Line Item
// Filing Instructions v1.4 (August 2021).
//
// D2C DIFFERENCES FROM B2B:
//   - Self-filed (PreparerFilingSignatureIndicator = "Y"); no party 57 or 56.
//   - Transmitter config comes from FINCEN_TRANSMITTER_* environment variables.
//   - Accounts queried directly from ForeignAccount table (no reviewedAccountYears).
//   - User IS the filer (no separate Client model).
//   - TINType enum only has SSN and ITIN (both map to code "1").
//   - institutionAddress is a Json? field, parsed via parseAddress().
//   - isJointAccount (not isJointlyOwned).
//   - maxValueUsd must not be null; throws if null (run treasury rate sync first).
//
// IMPORTANT: This module produces XML containing unmasked TINs and full
// account numbers. Output must be treated as PII/sensitive data at rest
// and in transit.
// ---------------------------------------------------------------------------

import { XMLBuilder } from "fast-xml-parser"
import { prisma } from "@/lib/db"
import { safeDecrypt } from "@/lib/encryption"
import type { AccountType, TINType } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransmitterConfig {
  name: string
  tin: string
  tcc: string
  phone: string
  address: { street: string; city: string; state: string; zip: string; country: string }
  contactName: string
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

/**
 * Maps Prisma TINType enum to FinCEN PartyIdentificationTypeCode.
 * D2C only has SSN and ITIN — both map to code "1".
 */
const TIN_TYPE_CODE: Record<TINType, string> = {
  SSN: "1",
  ITIN: "1",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transliterates non-ASCII characters to their closest ASCII equivalents.
 * FinCEN recommends ASCII-only content in XML submissions.
 * Uses Unicode NFD decomposition to strip combining diacritical marks.
 */
function toAscii(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
}

/**
 * Sanitizes an account number for FinCEN XML:
 * - Strips leading/trailing whitespace
 * - Truncates to 40 characters (XSD max for AccountNumberText)
 */
function sanitizeAccountNumber(raw: string): string {
  return raw.replace(/[\s\-]/g, "").slice(0, 40)
}

/**
 * Reads transmitter configuration from FINCEN_TRANSMITTER_* environment variables.
 * Parses the address from the format "123 Main St, Denver, CO 80202".
 *
 * @throws Error if any required variable is missing
 */
function getTransmitterConfig(): TransmitterConfig {
  const name = process.env.FINCEN_TRANSMITTER_NAME
  const tin = process.env.FINCEN_TRANSMITTER_TIN
  const tcc = process.env.FINCEN_TRANSMITTER_TCC
  const phone = process.env.FINCEN_TRANSMITTER_CONTACT_PHONE
  const contactName = process.env.FINCEN_TRANSMITTER_CONTACT_NAME
  const addressRaw = process.env.FINCEN_TRANSMITTER_ADDRESS

  if (!name || !tin || !tcc || !phone || !contactName || !addressRaw) {
    throw new Error("Missing required FINCEN_TRANSMITTER_* environment variables")
  }

  // Parse "123 Main St, Denver, CO 80202" format
  const parts = addressRaw.split(",").map((s) => s.trim())
  const street = parts[0] ?? ""
  const city = parts[1] ?? ""
  const stateZip = (parts[2] ?? "").split(" ").filter(Boolean)
  const state = stateZip[0] ?? ""
  const zip = stateZip[1] ?? ""

  return {
    name,
    tin,
    tcc,
    phone,
    address: { street, city, state, zip, country: "US" },
    contactName,
  }
}

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
 * Formats a Date as YYYYMMDD in US Eastern Time (America/New_York).
 * FinCEN HQ is in Vienna, VA — signature dates must match their local date.
 */
function formatDateEastern(date: Date): string {
  return date
    .toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    .replace(/-/g, "")
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
  isJointAccount: boolean
): string {
  if (ownershipType === "SIGNATURE_AUTHORITY") return "143"
  if (isJointAccount) return "142"
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
 * (Form 114) filing year (D2C self-filed version).
 *
 * The XML follows the EFilingBatchXML schema with one Activity element
 * containing activity-level Parties (transmitter, contact, filer — no preparer),
 * Account elements (each with a nested financial institution Party), and
 * a ForeignAccountActivity element.
 *
 * @param filingYearId - The FilingYear ID to generate XML for
 * @returns Well-formed XML string with XML declaration
 *
 * @throws Error if filingYear or user data is missing required fields
 * @throws Error if transmitter env vars are not set
 * @throws Error if any account has null maxValueUsd (run treasury rate sync first)
 */
export async function generateFincenXml(filingYearId: string): Promise<string> {
  // -----------------------------------------------------------------------
  // 1. Fetch data
  // -----------------------------------------------------------------------

  const transmitter = getTransmitterConfig()

  const filingYear = await prisma.filingYear.findUniqueOrThrow({
    where: { id: filingYearId },
    include: { user: true },
  })

  const accounts = await prisma.foreignAccount.findMany({
    where: { userId: filingYear.userId, calendarYear: filingYear.calendarYear },
  })

  const { user } = filingYear
  const seq = new SeqNumCounter()

  // -----------------------------------------------------------------------
  // 2. Build Activity element
  // -----------------------------------------------------------------------

  const signatureDate = formatDateEastern(filingYear.signedAt ?? new Date())
  const isAmended = filingYear.filingType === "AMENDED"

  const activitySeq = seq.next() // 1

  // Activity-level fields (in schema order)
  const activity: Record<string, unknown> = {
    "@_SeqNum": String(activitySeq),
    "fc2:ApprovalOfficialSignatureDateText": signatureDate,
    // EFilingPriorDocumentNumber: omitted for non-amendments (type is xsd:long,
    // empty string is invalid). Only emit for amendments with a valid BSA ID.
    // D2C is self-filed → PreparerFilingSignatureIndicator = "Y" (no third-party preparer).
    // XSD sequence: ApprovalOfficialSignatureDateText → EFilingPriorDocumentNumber →
    //   PreparerFilingSignatureIndicator → ThirdPartyPreparerIndicator
    "fc2:PreparerFilingSignatureIndicator": "Y",
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
      "fc2:RawPartyFullName": toAscii(transmitter.name),
    },
    "fc2:Address": {
      "@_SeqNum": String(txAddrSeq),
      "fc2:RawCityText": toAscii(transmitter.address.city),
      "fc2:RawCountryCodeText": transmitter.address.country,
      "fc2:RawStateCodeText": transmitter.address.state,
      "fc2:RawStreetAddress1Text": toAscii(transmitter.address.street),
      "fc2:RawZIPCode": (transmitter.address.zip || "").replace(/[-\s]/g, ""),
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

  activityParties.push({
    "@_SeqNum": String(tcPartySeq),
    "fc2:ActivityPartyTypeCode": "37",
    "fc2:PartyName": {
      "@_SeqNum": String(tcNameSeq),
      "fc2:PartyNameTypeCode": "L",
      "fc2:RawPartyFullName": toAscii(transmitter.contactName),
    },
  })

  // --- Party[2]: Foreign Account Filer (type 15) — user IS the filer ---
  const filerPartySeq = seq.next()

  // D2C users are US persons — always use usAddress, no foreign address logic
  const filerAddr = parseAddress(user.usAddress)

  // Determine if any account has signature authority
  const hasSignatureAuthority = accounts.some(
    (a) =>
      a.ownershipType === "SIGNATURE_AUTHORITY" ||
      a.ownershipType === "BOTH"
  )

  const filerParty: Record<string, unknown> = {
    "@_SeqNum": String(filerPartySeq),
    "fc2:ActivityPartyTypeCode": "15",
    "fc2:FilerFinancialInterest25ForeignAccountIndicator":
      filingYear.has25PlusAccounts ? "Y" : "N",
    "fc2:FilerTypeIndividualIndicator": "Y",
  }

  if (user.dateOfBirth) {
    filerParty["fc2:IndividualBirthDateText"] = formatDateFincen(user.dateOfBirth)
  }

  filerParty["fc2:SignatureAuthoritiesIndicator"] = hasSignatureAuthority ? "Y" : "N"

  const filerNameSeq = seq.next()
  filerParty["fc2:PartyName"] = {
    "@_SeqNum": String(filerNameSeq),
    "fc2:PartyNameTypeCode": "L",
    "fc2:RawEntityIndividualLastName": toAscii(user.lastName ?? ""),
    "fc2:RawIndividualFirstName": toAscii(user.firstName ?? ""),
  }

  const filerAddrSeq = seq.next()
  filerParty["fc2:Address"] = {
    "@_SeqNum": String(filerAddrSeq),
    "fc2:RawCityText": toAscii(filerAddr.city),
    "fc2:RawCountryCodeText": "US",
    "fc2:RawStateCodeText": filerAddr.state,
    "fc2:RawStreetAddress1Text": toAscii(filerAddr.street),
    "fc2:RawZIPCode": (filerAddr.zip || "").replace(/[-\s]/g, ""),
  }

  if (user.tin && user.tinType) {
    const filerIdSeq = seq.next()
    const decryptedTin = safeDecrypt(user.tin).replace(/\D/g, "")
    filerParty["fc2:PartyIdentification"] = {
      "@_SeqNum": String(filerIdSeq),
      "fc2:PartyIdentificationNumberText": decryptedTin,
      "fc2:PartyIdentificationTypeCode": TIN_TYPE_CODE[user.tinType],
    }
  }

  activityParties.push(filerParty)

  // NOTE: No Party 57 (preparer) or Party 56 (preparer firm) — this is self-filed D2C.

  // -----------------------------------------------------------------------
  // 4. Build Account elements (siblings of Party at Activity level)
  // -----------------------------------------------------------------------

  const accountElements: Record<string, unknown>[] = []
  let type41Count = 0

  for (const account of accounts) {
    // Throw if maxValueUsd is null — caller must run treasury rate sync first
    if (account.maxValueUsd === null) {
      throw new Error(
        `Account ${account.id} has null maxValueUsd — run treasury rate sync first`
      )
    }

    const maxValueUsd = Math.round(Number(account.maxValueUsd))

    // Decrypt account number
    const decryptedAccountNumber = safeDecrypt(account.accountNumber)

    const accountSeq = seq.next()

    // Build account element step-by-step to maintain schema element order
    const accountElement: Record<string, unknown> = {
      "@_SeqNum": String(accountSeq),
      "fc2:AccountMaximumValueAmountText": String(maxValueUsd),
      "fc2:AccountNumberText": sanitizeAccountNumber(decryptedAccountNumber),
      "fc2:AccountTypeCode": ACCOUNT_TYPE_CODE[account.accountType],
      "fc2:EFilingAccountTypeCode": getEFilingAccountTypeCode(
        account.ownershipType,
        account.isJointAccount
      ),
    }

    // Nested Party: Financial Institution (type 41)
    const fiPartySeq = seq.next()
    const fiNameSeq = seq.next()
    const fiAddrSeq = seq.next()
    type41Count++

    // Parse Json institutionAddress field
    const fiAddr = parseAddress(account.institutionAddress)

    // Build FI address step-by-step to maintain schema element order
    // (RawStateCodeText must come between RawCountryCodeText and RawStreetAddress1Text)
    const fiAddress: Record<string, unknown> = {
      "@_SeqNum": String(fiAddrSeq),
      "fc2:RawCityText": toAscii(fiAddr.city),
      "fc2:RawCountryCodeText": fiAddr.country || account.countryCode,
    }
    if (fiAddr.state) {
      fiAddress["fc2:RawStateCodeText"] = fiAddr.state
    }
    fiAddress["fc2:RawStreetAddress1Text"] = toAscii(fiAddr.street)
    fiAddress["fc2:RawZIPCode"] = (fiAddr.zip || "").replace(/[-\s]/g, "")

    const fiParty: Record<string, unknown> = {
      "@_SeqNum": String(fiPartySeq),
      "fc2:ActivityPartyTypeCode": "41",
      "fc2:PartyName": {
        "@_SeqNum": String(fiNameSeq),
        "fc2:PartyNameTypeCode": "L",
        "fc2:RawPartyFullName": toAscii(account.institutionName),
      },
      "fc2:Address": fiAddress,
    }

    // Signature authority accounts (type 143) require a Party type 43
    // ("No Financial Interest Account Owner") — the filer who has signature
    // authority but no financial interest in the account.
    const isSigAuth =
      account.ownershipType === "SIGNATURE_AUTHORITY" ||
      account.ownershipType === "BOTH"

    if (isSigAuth) {
      const noFiPartySeq = seq.next()
      const noFiNameSeq = seq.next()
      const noFiAddrSeq = seq.next()

      const noFiParty: Record<string, unknown> = {
        "@_SeqNum": String(noFiPartySeq),
        "fc2:ActivityPartyTypeCode": "43",
        "fc2:PartyName": {
          "@_SeqNum": String(noFiNameSeq),
          "fc2:PartyNameTypeCode": "L",
          "fc2:RawEntityIndividualLastName": toAscii(user.lastName ?? ""),
          "fc2:RawIndividualFirstName": toAscii(user.firstName ?? ""),
        },
        "fc2:Address": {
          "@_SeqNum": String(noFiAddrSeq),
          "fc2:RawCityText": toAscii(filerAddr.city),
          "fc2:RawCountryCodeText": "US",
          "fc2:RawStateCodeText": filerAddr.state,
          "fc2:RawStreetAddress1Text": toAscii(filerAddr.street),
          "fc2:RawZIPCode": (filerAddr.zip || "").replace(/[-\s]/g, ""),
        },
      }

      if (user.tin && user.tinType) {
        const noFiIdSeq = seq.next()
        const decryptedTin = safeDecrypt(user.tin).replace(/\D/g, "")
        noFiParty["fc2:PartyIdentification"] = {
          "@_SeqNum": String(noFiIdSeq),
          "fc2:PartyIdentificationNumberText": decryptedTin,
          "fc2:PartyIdentificationTypeCode": TIN_TYPE_CODE[user.tinType],
        }
      }

      accountElement["fc2:Party"] = [fiParty, noFiParty]
    } else {
      accountElement["fc2:Party"] = fiParty
    }

    accountElements.push(accountElement)
  }

  // -----------------------------------------------------------------------
  // 5. Assemble Activity children
  // -----------------------------------------------------------------------

  // Parties array
  activity["fc2:Party"] =
    activityParties.length === 1 ? activityParties[0] : activityParties

  // Accounts
  if (accountElements.length === 1) {
    activity["fc2:Account"] = accountElements[0]
  } else if (accountElements.length > 1) {
    activity["fc2:Account"] = accountElements
  }

  // ForeignAccountActivity (required)
  const faaSeq = seq.next()
  const faa: Record<string, unknown> = {
    "@_SeqNum": String(faaSeq),
  }
  if (filingYear.has25PlusAccounts) {
    faa["fc2:ForeignAccountHeldQuantityText"] = String(
      Math.max(accounts.length, 25)
    )
  }
  faa["fc2:ReportCalendarYearText"] = String(filingYear.calendarYear)

  // SignatureAuthoritiesQuantityText: only required when filer has 25+ sig auth accounts
  // (FinCEN C52 warning fires if emitted with count < 25)
  if (hasSignatureAuthority) {
    const sigAuthCount = accounts.filter(
      (a) => a.ownershipType === "SIGNATURE_AUTHORITY" || a.ownershipType === "BOTH"
    ).length
    if (sigAuthCount >= 25) {
      faa["fc2:SignatureAuthoritiesQuantityText"] = String(sigAuthCount)
    }
  }

  activity["fc2:ForeignAccountActivity"] = faa

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
      "@_NoFIOwnerCount": String(
        accounts.filter(
          (a) => a.ownershipType === "SIGNATURE_AUTHORITY" || a.ownershipType === "BOTH"
        ).length
      ),
      "@_ConsolidatedOwnerCount": "0",
      "@_xsi:schemaLocation": "www.fincen.gov/base https://www.fincen.gov/base/EFL_FBARXBatchSchema.xsd",
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
    errors.push("Missing filer Party element (ActivityPartyTypeCode 15)")
  }

  // -----------------------------------------------------------------------
  // 5. Check transmitter Party (ActivityPartyTypeCode 35)
  // -----------------------------------------------------------------------

  if (!xml.includes("<fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>")) {
    errors.push("Missing transmitter Party element (ActivityPartyTypeCode 35)")
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
    const duplicates = seqNums.filter((num, idx) => seqNums.indexOf(num) !== idx)
    const uniqueDuplicates = Array.from(new Set(duplicates))
    errors.push(`Duplicate SeqNum values found: ${uniqueDuplicates.join(", ")}`)
  }

  // -----------------------------------------------------------------------
  // 9. Validate date formats (YYYYMMDD)
  // -----------------------------------------------------------------------

  const dateElements = [
    "ApprovalOfficialSignatureDateText",
    "IndividualBirthDateText",
  ]

  for (const elem of dateElements) {
    const datePattern = new RegExp(`<fc2:${elem}>([^<]+)</fc2:${elem}>`)
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

  // -----------------------------------------------------------------------
  // 11. Validate no conflicting PreparerFilingSignatureIndicator with ThirdPartyPreparer
  //     (D2C uses PreparerFilingSignatureIndicator=Y; this guards against both appearing)
  // -----------------------------------------------------------------------

  if (
    xml.includes("<fc2:PreparerFilingSignatureIndicator>") &&
    xml.includes("<fc2:ThirdPartyPreparerIndicator>Y</fc2:ThirdPartyPreparerIndicator>")
  ) {
    errors.push(
      "PreparerFilingSignatureIndicator conflicts with ThirdPartyPreparerIndicator=Y"
    )
  }

  // -----------------------------------------------------------------------
  // 12. Validate UnknownMaximumValueIndicator not paired with amount
  //     (D2C throws on null maxValueUsd so this should never fire, but keep as a guard)
  // -----------------------------------------------------------------------

  const accountBlocks = xml.split("<fc2:Account ")
  for (let i = 1; i < accountBlocks.length; i++) {
    const block = accountBlocks[i].split("</fc2:Account>")[0] ?? ""
    if (
      block.includes(
        "<fc2:UnknownMaximumValueIndicator>Y</fc2:UnknownMaximumValueIndicator>"
      ) &&
      block.includes("<fc2:AccountMaximumValueAmountText>")
    ) {
      errors.push(
        "Account has both UnknownMaximumValueIndicator=Y and AccountMaximumValueAmountText"
      )
    }
  }

  // -----------------------------------------------------------------------
  // 13. Validate CA/MX accounts have RawStateCodeText
  // -----------------------------------------------------------------------

  const partyBlocks = xml.split("<fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>");
  for (let i = 1; i < partyBlocks.length; i++) {
    const block = partyBlocks[i].split("</fc2:Party>")[0] ?? "";
    const countryMatch = /<fc2:RawCountryCodeText>([^<]+)<\/fc2:RawCountryCodeText>/.exec(block);
    if (countryMatch) {
      const country = countryMatch[1].trim();
      if ((country === "CA" || country === "MX") && !block.includes("<fc2:RawStateCodeText>")) {
        errors.push(
          `Financial institution in ${country} is missing RawStateCodeText (province/state required for CA/MX)`
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // 14. Validate filer TIN is exactly 9 digits
  // -----------------------------------------------------------------------

  const filerPartyBlocks = xml.split("<fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>");
  for (let i = 1; i < filerPartyBlocks.length; i++) {
    const block = filerPartyBlocks[i].split("</fc2:Party>")[0] ?? "";
    const tinMatch = /<fc2:PartyIdentificationNumberText>([^<]+)<\/fc2:PartyIdentificationNumberText>/.exec(block);
    if (tinMatch) {
      const tin = tinMatch[1].trim();
      if (!/^\d{9}$/.test(tin)) {
        errors.push(
          `Filer TIN "${tin}" is not exactly 9 digits`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
