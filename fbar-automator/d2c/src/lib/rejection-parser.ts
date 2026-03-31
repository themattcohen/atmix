export interface ParsedRejectionError {
  raw: string;
  humanMessage: string;
  category: "tin" | "state" | "name" | "account" | "field_format" | "generic" | "_meta";
}

// Order matters — first match wins. Keep _meta last.
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
  {
    pattern: /not a valid code|invalid.*code|value.*not.*valid/i,
    category: "field_format",
    humanMessage: "One or more field values are not in the expected format. This is often caused by a missing province/state for Canadian or Mexican accounts.",
  },
  {
    pattern: /submission has been rejected|contains significant errors|please fix and re-submit/i,
    category: "_meta",
    humanMessage: "",
  },
];

export function parseRejectionReason(raw: string | null | undefined): ParsedRejectionError[] {
  if (!raw) return [];

  // Split on semicolons (FinCEN delimiter)
  const parts = raw.split(";").map(s => s.trim()).filter(Boolean);

  const matched = parts.map(part => {
    for (const { pattern, category, humanMessage } of KNOWN_PATTERNS) {
      if (pattern.test(part)) {
        return { raw: part, humanMessage, category };
      }
    }
    return { raw: part, humanMessage: part, category: "generic" as const };
  });

  // Filter out meta-errors (FinCEN boilerplate)
  const filtered = matched.filter(e => e.category !== "_meta");

  // Deduplicate by humanMessage
  const seen = new Set<string>();
  return filtered.filter(e => {
    if (seen.has(e.humanMessage)) return false;
    seen.add(e.humanMessage);
    return true;
  });
}

export function getRejectionSummary(errors: ParsedRejectionError[]): string {
  if (errors.length === 0) return "Your filing was rejected by FinCEN.";
  if (errors.length === 1) return errors[0].humanMessage;
  const categories = new Set(errors.map(e => e.category));
  if (categories.size === 1) return errors[0].humanMessage;
  return `Your filing has ${errors.length} issues that need to be fixed.`;
}
