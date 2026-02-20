import { describe, it, expect, vi } from "vitest";

// IMPLEMENTATION NEEDED: P7-11 will modify two files:
//   1. d2c/src/lib/prompts.ts — add ownership type question to EXTRACTION_SYSTEM_PROMPT
//      (e.g., "ownership_type": "FINANCIAL_INTEREST | SIGNATURE_AUTHORITY | BOTH")
//   2. d2c/src/lib/extraction-mapper.ts — handle ownershipType from LLM output
//      instead of always defaulting to "FINANCIAL_INTEREST"

import { mapExtractedAccounts, type MappedAccount } from "@/lib/extraction-mapper";
import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ExtractedAccount } from "@/types/extraction";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal ExtractedAccount for testing the mapper.
 * Uses required fields with sensible defaults.
 */
function makeExtractedAccount(
  overrides: Partial<ExtractedAccount> = {}
): ExtractedAccount {
  return {
    bank_name: "Test Bank",
    bank_address: {
      street: "123 Main St",
      city: "Zurich",
      state_province: null,
      country: "CH",
      postal_code: "8001",
    },
    account_number: "CH1234567890",
    account_type: "bank",
    account_type_description: null,
    currency: "CHF",
    statement_period: {
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    },
    balances: [
      {
        date: "2024-12-31",
        amount: 50000,
        label: "Closing balance",
        is_maximum: true,
      },
    ],
    max_balance: {
      amount: 50000,
      date: "2024-12-31",
      label: "Closing balance",
    },
    confidence: {
      bank_name: "high",
      account_number: "high",
      currency: "high",
      max_balance: "high",
      overall: "high",
    },
    warnings: [],
    ...overrides,
  };
}

// ─── Tests: Extraction Prompt ────────────────────────────────────────────────

describe("P7-11: Extraction prompt includes ownership type", () => {
  // IMPLEMENTATION NEEDED: P7-11 will add ownership_type field to the extraction schema
  // in EXTRACTION_SYSTEM_PROMPT. The LLM should be asked to determine the ownership type.

  it("P7-11: extraction system prompt contains ownership type instruction", () => {
    const prompt = EXTRACTION_SYSTEM_PROMPT;

    // After P7-11, the prompt should include ownership type in the schema
    expect(prompt.toLowerCase()).toContain("ownership");
    // It should mention the valid values
    expect(prompt).toMatch(/FINANCIAL_INTEREST|financial_interest/);
    expect(prompt).toMatch(/SIGNATURE_AUTHORITY|signature_authority/);
  });

  it("P7-11: extraction prompt schema lists ownership_type field", () => {
    const prompt = EXTRACTION_SYSTEM_PROMPT;

    // The JSON schema in the prompt should include an ownership_type field
    expect(prompt).toMatch(/ownership[_\s]type/i);
  });
});

// ─── Tests: Extraction Mapper ────────────────────────────────────────────────

describe("P7-11: Extraction mapper handles ownership types", () => {
  it("P7-11: mapper handles FINANCIAL_INTEREST ownership type", () => {
    const accounts = [makeExtractedAccount()];
    // IMPLEMENTATION NEEDED: P7-11 will add ownership_type to ExtractedAccount
    // and mapExtractedAccounts will read it. For now, the mapper defaults to FINANCIAL_INTEREST.

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].account.ownershipType).toBe("FINANCIAL_INTEREST");
  });

  // IMPLEMENTATION NEEDED: P7-11 will make the mapper read ownership_type from
  // the extracted account data and map it to the Prisma enum values.
  it("P7-11: mapper maps SIGNATURE_AUTHORITY ownership type when provided", () => {
    const accounts = [
      makeExtractedAccount({
        ownership_type: "signature_authority",
      }),
    ];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].account.ownershipType).toBe("SIGNATURE_AUTHORITY");
    expect(mapped[0].account.isJointAccount).toBe(false);
  });

  it("P7-11: mapper maps BOTH ownership type when provided", () => {
    const accounts = [
      makeExtractedAccount({
        ownership_type: "both",
      }),
    ];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].account.ownershipType).toBe("BOTH");
    expect(mapped[0].account.isJointAccount).toBe(true);
  });

  it("P7-11: mapper defaults to FINANCIAL_INTEREST when ownership type is null", () => {
    const accounts = [
      makeExtractedAccount({
        ownership_type: null,
      }),
    ];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].account.ownershipType).toBe("FINANCIAL_INTEREST");
  });

  it("P7-11: mapper defaults to FINANCIAL_INTEREST when ownership type is missing", () => {
    // No ownership_type property at all — should default gracefully
    const accounts = [makeExtractedAccount()];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].account.ownershipType).toBe("FINANCIAL_INTEREST");
  });

  it("P7-11: mapper defaults to FINANCIAL_INTEREST for unknown ownership type string", () => {
    const accounts = [
      makeExtractedAccount({
        // Cast needed: "UNKNOWN_VALUE" is not in the union type, simulating LLM hallucination
        ownership_type: "UNKNOWN_VALUE" as "financial_interest",
      }),
    ];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped).toHaveLength(1);
    // Unknown values should default to FINANCIAL_INTEREST, not crash
    expect(mapped[0].account.ownershipType).toBe("FINANCIAL_INTEREST");
  });

  it("P7-11: mapper preserves all other account fields regardless of ownership type", () => {
    const accounts = [
      makeExtractedAccount({
        bank_name: "Swiss Credit",
        account_number: "CH9999999",
        currency: "EUR",
        ownership_type: "signature_authority",
      }),
    ];

    const mapped = mapExtractedAccounts(accounts, 2024);

    expect(mapped[0].account.institutionName).toBe("Swiss Credit");
    expect(mapped[0].account.accountNumber).toBe("CH9999999");
    expect(mapped[0].account.currencyCode).toBe("EUR");
    expect(mapped[0].account.calendarYear).toBe(2024);
    expect(mapped[0].account.accountType).toBe("BANK");
  });
});
