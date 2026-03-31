export interface ParsedRejectionError {
  raw: string;
  humanMessage: string;
  category: "tin" | "state" | "name" | "account" | "generic";
}

const KNOWN_PATTERNS: Array<{ pattern: RegExp; category: ParsedRejectionError["category"]; humanMessage: string }> = [
  {
    pattern: /TIN|taxpayer\s*id|identification\s*number/i,
    category: "tin",
    humanMessage: "There is an issue with the taxpayer identification number (SSN/ITIN). Please verify it is correct.",
  },
  {
    pattern: /country\s*is\s*(CA|MX)|state.*not\s*recorded|RawStateCodeText/i,
    category: "state",
    humanMessage: "A province or state is required for Canadian or Mexican account addresses.",
  },
  {
    pattern: /filer.*name|name.*required|RawEntityIndividualLastName|RawIndividualFirstName/i,
    category: "name",
    humanMessage: "There is an issue with the filer name on the filing.",
  },
  {
    pattern: /account\s*number|AccountNumberText/i,
    category: "account",
    humanMessage: "There is an issue with one or more account numbers.",
  },
];

export function parseRejectionReason(raw: string | null | undefined): ParsedRejectionError[] {
  if (!raw) return [];

  // Split on semicolons (FinCEN delimiter)
  const parts = raw.split(";").map(s => s.trim()).filter(Boolean);

  return parts.map(part => {
    for (const { pattern, category, humanMessage } of KNOWN_PATTERNS) {
      if (pattern.test(part)) {
        return { raw: part, humanMessage, category };
      }
    }
    return { raw: part, humanMessage: part, category: "generic" as const };
  });
}

export function getRejectionSummary(errors: ParsedRejectionError[]): string {
  if (errors.length === 0) return "Your filing was rejected by FinCEN.";

  // Deduplicate by category
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const err of errors) {
    if (!seen.has(err.category)) {
      seen.add(err.category);
      unique.push(err.humanMessage);
    }
  }

  if (unique.length === 1) return unique[0];
  return `Your filing has ${unique.length} issues that need to be fixed: ${unique.join(" ")}`;
}
