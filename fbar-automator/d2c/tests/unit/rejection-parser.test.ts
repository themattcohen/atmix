import { describe, it, expect } from "vitest";
import { parseRejectionReason, getRejectionSummary, type ParsedRejectionError } from "@/lib/rejection-parser";

// Real FinCEN rejection string (multi-part, semicolon-delimited)
const REAL_FINCEN_REJECTION =
  "This submission has been rejected because it contains significant errors. Please fix and re-submit the file.;" +
  " The element RawStateCodeText country is CA but state not recorded;" +
  " The element contains a value that is not a valid code.";

describe("parseRejectionReason", () => {
  it("returns [] for null", () => {
    expect(parseRejectionReason(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(parseRejectionReason(undefined)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(parseRejectionReason("")).toEqual([]);
  });

  it("parses a real FinCEN rejection into 2 clean errors with no dupes and no meta", () => {
    const result = parseRejectionReason(REAL_FINCEN_REJECTION);

    // Meta boilerplate should be filtered out
    expect(result.every(e => e.category !== "_meta")).toBe(true);

    // Should produce exactly 2 errors: state + field_format
    expect(result).toHaveLength(2);

    const categories = result.map(e => e.category);
    expect(categories).toContain("state");
    expect(categories).toContain("field_format");

    // No duplicate humanMessages
    const messages = result.map(e => e.humanMessage);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("returns 1 result for a single error with no semicolons", () => {
    const result = parseRejectionReason("The TIN is invalid");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("tin");
  });

  it("falls through to generic for unknown errors", () => {
    const result = parseRejectionReason("Something completely unexpected happened");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("generic");
    expect(result[0].humanMessage).toBe("Something completely unexpected happened");
  });

  it("returns [] for all-meta input", () => {
    const result = parseRejectionReason(
      "This submission has been rejected because it contains significant errors. Please fix and re-submit the file."
    );
    expect(result).toEqual([]);
  });
});

describe("getRejectionSummary", () => {
  it("returns fallback message for empty array", () => {
    expect(getRejectionSummary([])).toBe("Your filing was rejected by FinCEN.");
  });

  it("returns that error's message for 1 error", () => {
    const errors: ParsedRejectionError[] = [
      { raw: "TIN invalid", humanMessage: "There is an issue with the taxpayer identification number (SSN/ITIN). Please verify it is correct.", category: "tin" },
    ];
    expect(getRejectionSummary(errors)).toBe(errors[0].humanMessage);
  });

  it("returns count message for 2+ errors with different categories", () => {
    const errors: ParsedRejectionError[] = [
      { raw: "a", humanMessage: "Issue A", category: "tin" },
      { raw: "b", humanMessage: "Issue B", category: "state" },
    ];
    expect(getRejectionSummary(errors)).toBe("Your filing has 2 issues that need to be fixed.");
  });

  it("returns first message when multiple errors share one category", () => {
    const errors: ParsedRejectionError[] = [
      { raw: "a", humanMessage: "Issue A", category: "tin" },
      { raw: "b", humanMessage: "Issue B", category: "tin" },
    ];
    expect(getRejectionSummary(errors)).toBe("Issue A");
  });
});
