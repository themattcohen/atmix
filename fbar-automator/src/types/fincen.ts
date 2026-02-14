// ---------------------------------------------------------------------------
// FinCEN Form 114 (FBAR) Types
// ---------------------------------------------------------------------------
// Types representing the FinCEN BSA E-Filing XML schema fields for Form 114.
// These map directly to the EFL_FBARXBatchSchema.xsd structure and the
// FinCEN Line Item Filing Instructions.
// ---------------------------------------------------------------------------

/**
 * Complete FBAR filing for a single filer in a single calendar year.
 * Maps to one Activity element in the BSA E-Filing XML batch.
 */
export interface FBARFiling {
  filingId: string
  filer: FBARFiler
  accounts: FBARAccount[]
  filingYear: number
  filingType: "initial" | "amended"
  signatureDate: string
}

/**
 * Part I: Filer information.
 * Identifies the U.S. person with a financial interest in or
 * signature authority over foreign financial accounts.
 */
export interface FBARFiler {
  tin: string
  tinType: "SSN" | "EIN" | "ITIN" | "FOREIGN"
  lastName: string
  firstName: string
  middleName?: string
  dateOfBirth?: string
  address: FBARAddress
  filingType: "individual" | "joint" | "entity"
}

/**
 * Part II (individually owned) / Part III (jointly owned) account record.
 * Each foreign financial account is reported as a separate entry.
 */
export interface FBARAccount {
  accountNumber: string // Item 18/28
  accountType: "bank" | "securities" | "other" // Item 16/26
  accountTypeDescription?: string // Required if accountType is "other"
  maxValueUSD: number // Item 15 - maximum value in USD (whole dollars)
  isValueUnknown: boolean // Item 15a - check if value cannot be determined
  institutionName: string // Item 17/27
  institutionAddress: FBARAddress // Items 19-23 / 29-33
  isJointlyOwned: boolean
  jointOwnerCount?: number // Item 24 - number of joint owners excluding filer
}

/**
 * Address structure used for both filer and institution addresses.
 * Maps to the FinCEN address fields across Parts I-III.
 */
export interface FBARAddress {
  street: string
  city: string
  stateProvince?: string
  country: string // ISO 3166-1 alpha-2
  postalCode?: string
}

/**
 * Country code to name mapping for FBAR-relevant countries.
 * Subset of ISO 3166-1 alpha-2 codes covering the most common
 * countries encountered in FBAR filings.
 */
export const COUNTRY_CODES: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AG: "Antigua and Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BM: "Bermuda",
  BO: "Bolivia",
  BR: "Brazil",
  BG: "Bulgaria",
  CA: "Canada",
  KY: "Cayman Islands",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GT: "Guatemala",
  GG: "Guernsey",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JE: "Jersey",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KR: "South Korea",
  KW: "Kuwait",
  LV: "Latvia",
  LB: "Lebanon",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macau",
  MY: "Malaysia",
  MT: "Malta",
  MX: "Mexico",
  MC: "Monaco",
  MA: "Morocco",
  NL: "Netherlands",
  NZ: "New Zealand",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  SA: "Saudi Arabia",
  RS: "Serbia",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SE: "Sweden",
  CH: "Switzerland",
  TW: "Taiwan",
  TH: "Thailand",
  TT: "Trinidad and Tobago",
  TN: "Tunisia",
  TR: "Turkey",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  VE: "Venezuela",
  VN: "Vietnam",
}
