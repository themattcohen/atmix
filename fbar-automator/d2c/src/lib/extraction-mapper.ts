import type { ExtractedAccount } from "@/types/extraction";
import type { CreateAccountRequest } from "@/types";

export interface MappedAccount {
  account: CreateAccountRequest;
  confidence: ExtractedAccount["confidence"];
  warnings: string[];
  sourceIndex: number;
}

function mapAccountType(type: "bank" | "securities" | "other"): "BANK" | "SECURITIES" | "OTHER" {
  switch (type) {
    case "bank": return "BANK";
    case "securities": return "SECURITIES";
    case "other": return "OTHER";
  }
}

function mapOwnershipType(type?: string | null): "FINANCIAL_INTEREST" | "SIGNATURE_AUTHORITY" | "BOTH" {
  if (!type) return "FINANCIAL_INTEREST";
  const normalized = type.toLowerCase().trim();
  switch (normalized) {
    case "signature_authority": return "SIGNATURE_AUTHORITY";
    case "both": return "BOTH";
    case "financial_interest": return "FINANCIAL_INTEREST";
    default: return "FINANCIAL_INTEREST";
  }
}

export function mapExtractedAccounts(
  accounts: ExtractedAccount[],
  calendarYear: number
): MappedAccount[] {
  return accounts.map((extracted, index) => {
    const warnings = [...extracted.warnings];

    if (!extracted.bank_name) {
      warnings.push("Institution name could not be determined from the document.");
    }
    if (!extracted.account_number) {
      warnings.push("Account number could not be determined from the document.");
    }

    const account: CreateAccountRequest = {
      institutionName: extracted.bank_name || "Unknown Institution",
      accountNumber: extracted.account_number || "",
      accountType: mapAccountType(extracted.account_type),
      ownershipType: mapOwnershipType(extracted.ownership_type),
      countryCode: extracted.bank_address.country || "",
      currencyCode: extracted.currency || "",
      maxValueLocal: extracted.max_balance?.amount ?? 0,
      isJointAccount: false,
      calendarYear,
    };

    if (extracted.bank_address.street || extracted.bank_address.city) {
      account.institutionAddress = {
        street: extracted.bank_address.street || undefined,
        city: extracted.bank_address.city || undefined,
        country: extracted.bank_address.country || undefined,
      };
    }

    return {
      account,
      confidence: extracted.confidence,
      warnings,
      sourceIndex: index,
    };
  });
}
