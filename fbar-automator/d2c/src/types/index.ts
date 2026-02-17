// Re-export Prisma enums for use without Prisma import
export {
  TINType,
  AccountType,
  OwnershipType,
  FilingStatus,
  FilingType,
  PaymentStatus,
  ExchangeRateSource,
} from "@prisma/client";

// Re-export Prisma model types
export type {
  User,
  ForeignAccount,
  FilingYear,
  Payment,
  ExchangeRate,
} from "@prisma/client";

// --- API Request/Response Types ---

export interface ApiError {
  error: string;
  details?: string;
}

export interface ApiSuccess<T = void> {
  success: true;
  data?: T;
}

// User
export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  tin: string;
  tinType: "SSN" | "ITIN";
  dateOfBirth: string; // ISO date
  usAddress: USAddress;
  phone?: string;
}

export interface USAddress {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  suffix: string | null;
  tinLast4: string | null;
  tinType: "SSN" | "ITIN" | null;
  dateOfBirth: string | null;
  usAddress: USAddress | null;
  phone: string | null;
}

// Accounts
export interface CreateAccountRequest {
  institutionName: string;
  accountNumber: string;
  accountType: "BANK" | "SECURITIES" | "OTHER";
  ownershipType: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH";
  countryCode: string;
  currencyCode: string;
  maxValueLocal: number;
  isJointAccount: boolean;
  jointOwnerInfo?: string;
  calendarYear: number;
  institutionAddress?: {
    street?: string;
    city?: string;
    country?: string;
  };
}

export interface AccountDisplay {
  id: string;
  institutionName: string;
  accountNumberLast4: string;
  accountType: "BANK" | "SECURITIES" | "OTHER";
  ownershipType: "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH";
  countryCode: string;
  currencyCode: string;
  maxValueLocal: number;
  maxValueUsd: number | null;
  exchangeRate: number | null;
  isJointAccount: boolean;
  jointOwnerInfo: string | null;
  calendarYear: number;
}

export interface PriorYearInfo {
  calendarYear: number;
  count: number;
}

export interface AccountsListResponse {
  data: AccountDisplay[];
  priorYears: PriorYearInfo[];
}

export interface ImportAccountsResponse {
  success: boolean;
  importedCount: number;
  targetCalendarYear: number;
  data: AccountDisplay[];
}

// Filing
export interface CreateFilingRequest {
  calendarYear: number;
  filingType?: "ORIGINAL" | "AMENDED";
}

export interface FilingDisplay {
  id: string;
  calendarYear: number;
  status: string;
  filingType: string;
  has25PlusAccounts: boolean;
  signedAt: string | null;
  form114aUrl: string | null;
  stripePaymentId: string | null;
  bsaId: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  rejectionReason: string | null;
  accountCount: number;
}

// Signature
export interface SignFilingRequest {
  filingYearId: string;
  fullName: string;
  agreed: boolean;
  signatureData: string; // base64 drawn signature or typed name
  signatureType: "typed" | "drawn";
}

// Stripe
export interface CheckoutRequest {
  filingYearId: string;
}

export interface CheckoutResponse {
  url: string;
}

// SDTM
export interface SubmitRequest {
  filingYearId: string;
}

export interface SubmissionStatus {
  status: "pending" | "submitted" | "accepted" | "rejected";
  bsaId?: string;
  rejectionReason?: string;
  submittedAt?: string;
  acknowledgedAt?: string;
}

// Wizard
export type WizardStep =
  | "threshold"
  | "personal"
  | "accounts"
  | "review"
  | "sign"
  | "payment"
  | "confirmation";

export const WIZARD_STEPS: { key: WizardStep; label: string; path: string }[] = [
  { key: "threshold", label: "Threshold", path: "/threshold" },
  { key: "personal", label: "Personal Info", path: "/personal" },
  { key: "accounts", label: "Accounts", path: "/accounts" },
  { key: "review", label: "Review", path: "/review" },
  { key: "sign", label: "Sign", path: "/sign" },
  { key: "payment", label: "Payment", path: "/payment" },
  { key: "confirmation", label: "Confirmation", path: "/confirmation" },
];

// Threshold
export interface ThresholdAnswers {
  hadForeignAccounts: boolean;
  aggregateValueExceeded: boolean;
  calendarYear: number;
}
