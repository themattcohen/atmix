import { safeDecrypt } from "@/lib/encryption";
import { CA_PROVINCES, MX_STATES } from "@/lib/validation";

export interface FilingValidationError {
  field: string;
  message: string;
  accountId?: string;
}

interface ValidatableUser {
  firstName: string | null;
  lastName: string | null;
  tin: string | null;
}

interface ValidatableAccount {
  id: string;
  countryCode: string;
  institutionAddress: unknown;
  institutionName: string;
}

function parseAddress(addr: unknown): { state?: string } {
  if (!addr || typeof addr !== "object") return {};
  const a = addr as Record<string, string | undefined>;
  return { state: a.state ?? a.stateProvince };
}

export function validateFilingData(
  user: ValidatableUser,
  accounts: ValidatableAccount[]
): FilingValidationError[] {
  const errors: FilingValidationError[] = [];

  // User name
  if (!user.firstName || !user.lastName) {
    errors.push({ field: "user.name", message: "Filer first and last name are required" });
  }

  // TIN validation
  if (user.tin) {
    const raw = safeDecrypt(user.tin).replace(/\D/g, "");
    if (!/^\d{9}$/.test(raw)) {
      errors.push({ field: "user.tin", message: "Taxpayer ID must be exactly 9 digits" });
    }
  } else {
    errors.push({ field: "user.tin", message: "Taxpayer ID is required" });
  }

  // Account-level validation
  const validCaProvinces = CA_PROVINCES.map(p => p.code) as readonly string[];
  const validMxStates = MX_STATES.map(s => s.code) as readonly string[];

  for (const account of accounts) {
    if (account.countryCode === "CA" || account.countryCode === "MX") {
      const addr = parseAddress(account.institutionAddress);
      if (!addr.state) {
        errors.push({
          field: "institutionAddress.state",
          message: `${account.countryCode === "CA" ? "Province" : "State"} is required for ${account.institutionName} (${account.countryCode})`,
          accountId: account.id,
        });
      } else if (account.countryCode === "CA" && !validCaProvinces.includes(addr.state)) {
        errors.push({
          field: "institutionAddress.state",
          message: `Invalid province "${addr.state}" for ${account.institutionName}`,
          accountId: account.id,
        });
      } else if (account.countryCode === "MX" && !validMxStates.includes(addr.state)) {
        errors.push({
          field: "institutionAddress.state",
          message: `Invalid state "${addr.state}" for ${account.institutionName}`,
          accountId: account.id,
        });
      }
    }
  }

  return errors;
}
