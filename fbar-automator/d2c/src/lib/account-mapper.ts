import { ForeignAccount } from "@prisma/client";
import { safeDecrypt } from "@/lib/encryption";
import { AccountDisplay } from "@/types";

export function mapAccountToDisplay(a: ForeignAccount): AccountDisplay {
  return {
    id: a.id,
    institutionName: a.institutionName,
    accountNumberLast4: safeDecrypt(a.accountNumber).replace(/[\s\-]/g, "").slice(-4) || "****",
    accountType: a.accountType,
    ownershipType: a.ownershipType,
    countryCode: a.countryCode,
    currencyCode: a.currencyCode,
    maxValueLocal: Number(a.maxValueLocal),
    maxValueUsd: a.maxValueUsd ? Number(a.maxValueUsd) : null,
    exchangeRate: a.exchangeRate ? Number(a.exchangeRate) : null,
    isJointAccount: a.isJointAccount,
    jointOwnerInfo: a.jointOwnerInfo,
    calendarYear: a.calendarYear,
    sourceStatementId: a.sourceStatementId ?? null,
    institutionAddress: a.institutionAddress as AccountDisplay["institutionAddress"] ?? null,
  };
}
