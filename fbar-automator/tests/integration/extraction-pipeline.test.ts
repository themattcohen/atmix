// ---------------------------------------------------------------------------
// Integration Tests: Extraction Pipeline
// ---------------------------------------------------------------------------
// Tests the end-to-end extraction flow: extract -> validate -> store.
// Mocks Anthropic SDK, S3, and Prisma to verify module interactions.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"
import { extractFromStatement } from "@/lib/extraction"
import { validateExtractionResult } from "@/lib/validation"

// ---------------------------------------------------------------------------
// Hoisted shared mocks — survive vi.mock hoisting and module resets
// ---------------------------------------------------------------------------

const { mockCreate, mockGetFileBuffer, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  const mockGetFileBuffer = vi.fn()
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  ;(MockAnthropic as any).APIError = class APIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { mockCreate, mockGetFileBuffer, MockAnthropic }
})

vi.mock("@anthropic-ai/sdk", () => ({
  default: MockAnthropic,
}))

vi.mock("@/lib/s3", () => ({
  getFileBuffer: mockGetFileBuffer,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    statement: {
      update: vi.fn(),
    },
    foreignAccount: {
      upsert: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createValidAccount(
  overrides: Partial<ExtractedAccount> = {}
): ExtractedAccount {
  return {
    bank_name: "Swiss National Bank AG",
    bank_address: {
      street: "Bundesplatz 1",
      city: "Bern",
      state_province: "BE",
      country: "CH",
      postal_code: "3003",
    },
    account_number: "CH93-0076-2011-6238-5295-7",
    account_type: "bank",
    account_type_description: null,
    currency: "CHF",
    statement_period: {
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    },
    balances: [
      {
        date: "2024-03-31",
        amount: 45000,
        label: "Q1 closing balance",
        is_maximum: false,
      },
      {
        date: "2024-06-30",
        amount: 52000,
        label: "Q2 closing balance",
        is_maximum: false,
      },
      {
        date: "2024-09-30",
        amount: 78000,
        label: "Q3 closing balance",
        is_maximum: true,
      },
      {
        date: "2024-12-31",
        amount: 61000,
        label: "Q4 closing balance",
        is_maximum: false,
      },
    ],
    max_balance: {
      amount: 78000,
      date: "2024-09-30",
      label: "Q3 closing balance",
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
  }
}

function createValidExtractionResult(
  overrides: Partial<ExtractionResult> = {},
  accountOverrides: Partial<ExtractedAccount>[] = []
): ExtractionResult {
  const accounts =
    accountOverrides.length > 0
      ? accountOverrides.map((o) => createValidAccount(o))
      : [createValidAccount()]

  return {
    accounts,
    document_language: "de",
    document_metadata: {
      page_count: 4,
      is_multi_account: accountOverrides.length > 1,
      is_transaction_only: false,
    },
    ...overrides,
  }
}

/**
 * Builds a mock Anthropic API response from an ExtractionResult object.
 * Wraps the JSON in the expected response.content structure.
 */
function createAnthropicResponse(
  result: ExtractionResult,
  inputTokens = 1500,
  outputTokens = 800
) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  }
}

/**
 * Builds a mock Anthropic response with JSON wrapped in markdown fences.
 */
function createFencedAnthropicResponse(
  result: ExtractionResult,
  inputTokens = 1500,
  outputTokens = 800
) {
  return {
    content: [
      {
        type: "text",
        text: "```json\n" + JSON.stringify(result, null, 2) + "\n```",
      },
    ],
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Extraction Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = "test-api-key-12345"
    mockGetFileBuffer.mockResolvedValue(Buffer.from("fake-pdf-content"))
  })

  // -------------------------------------------------------------------------
  // 1. Happy path: extract -> validate -> pass
  // -------------------------------------------------------------------------

  describe("happy path extraction", () => {
    it("extracts valid data from a PDF and passes validation", async () => {
      const expectedResult = createValidExtractionResult()
      mockCreate.mockResolvedValue(createAnthropicResponse(expectedResult))

      // Step 1: Extract
      const extraction = await extractFromStatement(
        "uploads/client-123/statement.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(true)
      expect(extraction.result).not.toBeNull()
      expect(extraction.model).toBeDefined()
      expect(extraction.tokensUsed).toBeGreaterThan(0)

      // Step 2: Validate the extraction result
      const validation = validateExtractionResult(extraction.result!)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Step 3: Verify the data structure
      const account = extraction.result!.accounts[0]
      expect(account.bank_name).toBe("Swiss National Bank AG")
      expect(account.account_number).toBe("CH93-0076-2011-6238-5295-7")
      expect(account.currency).toBe("CHF")
      expect(account.max_balance.amount).toBe(78000)
      expect(account.bank_address.country).toBe("CH")
    })

    it("handles markdown-fenced JSON responses from Claude", async () => {
      const expectedResult = createValidExtractionResult()
      mockCreate.mockResolvedValue(
        createFencedAnthropicResponse(expectedResult)
      )


      const extraction = await extractFromStatement(
        "uploads/client-123/statement.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(true)

      const validation = validateExtractionResult(extraction.result!)
      expect(validation.isValid).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Multi-account extraction
  // -------------------------------------------------------------------------

  describe("multi-account extraction", () => {
    it("extracts 3 accounts and all pass validation", async () => {
      const multiAccountResult = createValidExtractionResult(
        {
          document_metadata: {
            page_count: 12,
            is_multi_account: true,
            is_transaction_only: false,
          },
        },
        [
          {
            bank_name: "Swiss National Bank AG",
            account_number: "CH93-0076-2011-6238-5295-7",
            currency: "CHF",
            max_balance: {
              amount: 78000,
              date: "2024-09-30",
              label: "Q3 balance",
            },
          },
          {
            bank_name: "Deutsche Bank AG",
            account_number: "DE89-3704-0044-0532-0130-00",
            currency: "EUR",
            bank_address: {
              street: "Taunusanlage 12",
              city: "Frankfurt",
              state_province: "Hessen",
              country: "DE",
              postal_code: "60325",
            },
            max_balance: {
              amount: 125000,
              date: "2024-07-15",
              label: "Peak balance",
            },
          },
          {
            bank_name: "Barclays Bank PLC",
            account_number: "GB82-WEST-1234-5698-7654-32",
            currency: "GBP",
            bank_address: {
              street: "1 Churchill Place",
              city: "London",
              state_province: null,
              country: "GB",
              postal_code: "E14 5HP",
            },
            max_balance: {
              amount: 34500,
              date: "2024-11-01",
              label: "November statement",
            },
          },
        ]
      )

      mockCreate.mockResolvedValue(
        createAnthropicResponse(multiAccountResult, 3000, 2000)
      )


      const extraction = await extractFromStatement(
        "uploads/client-456/multi-account.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(true)
      expect(extraction.result!.accounts).toHaveLength(3)
      expect(extraction.tokensUsed).toBe(5000) // 3000 + 2000

      // Validate all accounts pass
      const validation = validateExtractionResult(extraction.result!)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Verify each account has distinct data
      const accounts = extraction.result!.accounts
      const accountNumbers = accounts.map((a) => a.account_number)
      expect(new Set(accountNumbers).size).toBe(3)

      const currencies = accounts.map((a) => a.currency)
      expect(currencies).toContain("CHF")
      expect(currencies).toContain("EUR")
      expect(currencies).toContain("GBP")
    })
  })

  // -------------------------------------------------------------------------
  // 3. Low confidence handling
  // -------------------------------------------------------------------------

  describe("low confidence handling", () => {
    it("generates warnings for low-confidence fields but remains valid", async () => {
      const lowConfidenceResult = createValidExtractionResult({}, [
        {
          confidence: {
            bank_name: "low",
            account_number: "high",
            currency: "medium",
            max_balance: "low",
            overall: "medium",
          },
          warnings: [
            "Bank name partially obscured by stamp",
            "Balance figure may include pending transactions",
          ],
        },
      ])

      mockCreate.mockResolvedValue(
        createAnthropicResponse(lowConfidenceResult)
      )


      const extraction = await extractFromStatement(
        "uploads/client-789/blurry-scan.jpg",
        "jpeg"
      )

      expect(extraction.success).toBe(true)

      const validation = validateExtractionResult(extraction.result!)

      // Still valid because low confidence is a warning, not an error
      expect(validation.isValid).toBe(true)

      // Should have a confidence warning
      const confidenceWarnings = validation.warnings.filter(
        (w) => w.field === "confidence"
      )
      expect(confidenceWarnings.length).toBeGreaterThan(0)

      // Warning should mention the low-confidence fields
      const warningMessage = confidenceWarnings[0].message
      expect(warningMessage).toContain("bank_name")
      expect(warningMessage).toContain("max_balance")
    })
  })

  // -------------------------------------------------------------------------
  // 4. Invalid JSON response from Claude
  // -------------------------------------------------------------------------

  describe("invalid JSON response handling", () => {
    it("fails gracefully when Claude returns malformed JSON", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "I'm sorry, I cannot process this image because {invalid json",
          },
        ],
        usage: { input_tokens: 500, output_tokens: 50 },
      })


      const extraction = await extractFromStatement(
        "uploads/client-123/corrupt.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(false)
      expect(extraction.result).toBeNull()
      expect(extraction.error).toBeDefined()
      expect(extraction.error).toContain("Failed to parse extraction response")
    })

    it("fails gracefully when Claude returns empty content", async () => {
      mockCreate.mockResolvedValue({
        content: [],
        usage: { input_tokens: 500, output_tokens: 0 },
      })


      const extraction = await extractFromStatement(
        "uploads/client-123/blank.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(false)
      expect(extraction.result).toBeNull()
      expect(extraction.error).toContain("no text content")
    })

    it("fails gracefully when Claude returns only non-text blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "123", name: "test", input: {} }],
        usage: { input_tokens: 500, output_tokens: 100 },
      })


      const extraction = await extractFromStatement(
        "uploads/client-123/weird.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(false)
      expect(extraction.result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // 5. Missing required fields -> validation catches error
  // -------------------------------------------------------------------------

  describe("missing required fields", () => {
    it("catches missing account_number as a validation error", async () => {
      const missingFieldResult = createValidExtractionResult({}, [
        {
          account_number: "", // empty account number
        },
      ])

      mockCreate.mockResolvedValue(
        createAnthropicResponse(missingFieldResult)
      )


      // Extraction succeeds (Claude returned valid JSON)
      const extraction = await extractFromStatement(
        "uploads/client-123/statement.pdf",
        "pdf"
      )
      expect(extraction.success).toBe(true)

      // But validation catches the missing field
      const validation = validateExtractionResult(extraction.result!)
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)

      const accountNumberError = validation.errors.find(
        (e) => e.field === "account_number"
      )
      expect(accountNumberError).toBeDefined()
      expect(accountNumberError!.message).toContain("missing")
    })

    it("catches negative max balance as a validation error", async () => {
      const negativeBalanceResult = createValidExtractionResult({}, [
        {
          max_balance: {
            amount: -1500.5,
            date: "2024-12-31",
            label: "Year-end balance",
          },
        },
      ])

      mockCreate.mockResolvedValue(
        createAnthropicResponse(negativeBalanceResult)
      )


      const extraction = await extractFromStatement(
        "uploads/client-123/statement.pdf",
        "pdf"
      )
      expect(extraction.success).toBe(true)

      const validation = validateExtractionResult(extraction.result!)
      expect(validation.isValid).toBe(false)

      const balanceError = validation.errors.find(
        (e) => e.field === "max_balance.amount"
      )
      expect(balanceError).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // 6. Pipeline integration: extraction -> validation -> correct pass/fail
  // -------------------------------------------------------------------------

  describe("pipeline integration: extraction result -> validation -> pass/fail", () => {
    it("valid extraction result passes validation end-to-end", async () => {
      const validResult = createValidExtractionResult()
      mockCreate.mockResolvedValue(createAnthropicResponse(validResult))


      const extraction = await extractFromStatement(
        "uploads/client-100/good-statement.pdf",
        "pdf"
      )
      expect(extraction.success).toBe(true)

      const validation = validateExtractionResult(extraction.result!)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it("extraction with multiple issues correctly aggregates validation results", async () => {
      const problematicResult = createValidExtractionResult(
        {
          document_metadata: {
            page_count: 1,
            is_multi_account: true,
            is_transaction_only: true, // triggers document-level warning
          },
        },
        [
          // Account 0: missing account number (error)
          {
            account_number: "",
            confidence: {
              bank_name: "low", // triggers confidence warning
              account_number: "low",
              currency: "high",
              max_balance: "high",
              overall: "low",
            },
          },
          // Account 1: valid but with uncommon currency (warning)
          {
            currency: "XYZ",
            bank_address: {
              street: "Unknown",
              city: "Unknown",
              state_province: null,
              country: "XX", // invalid country code (warning)
              postal_code: null,
            },
          },
        ]
      )

      mockCreate.mockResolvedValue(
        createAnthropicResponse(problematicResult)
      )


      const extraction = await extractFromStatement(
        "uploads/client-200/messy-statement.pdf",
        "pdf"
      )
      expect(extraction.success).toBe(true)
      expect(extraction.result!.accounts).toHaveLength(2)

      const validation = validateExtractionResult(extraction.result!)

      // Should fail because account 0 has missing account_number
      expect(validation.isValid).toBe(false)

      // At least 1 error (missing account number on account 0)
      expect(validation.errors.length).toBeGreaterThanOrEqual(1)

      // Multiple warnings expected: low confidence, unknown currency, invalid country,
      // transaction-only document
      expect(validation.warnings.length).toBeGreaterThanOrEqual(3)

      // Verify the account indices are correctly set
      const errorAccountIndices = validation.errors.map(
        (e) => e.accountIndex
      )
      expect(errorAccountIndices).toContain(0)

      // Verify transaction-only warning is at document level (accountIndex = -1)
      const transactionWarning = validation.warnings.find(
        (w) => w.field === "document_metadata.is_transaction_only"
      )
      expect(transactionWarning).toBeDefined()
      expect(transactionWarning!.accountIndex).toBe(-1)
    })
  })

  // -------------------------------------------------------------------------
  // Edge cases: unsupported file types, S3 failures
  // -------------------------------------------------------------------------

  describe("error handling edge cases", () => {
    it("rejects unsupported file types before calling Claude", async () => {

      const extraction = await extractFromStatement(
        "uploads/client-123/statement.docx",
        "docx"
      )

      expect(extraction.success).toBe(false)
      expect(extraction.error).toContain("Unsupported file type")
      expect(extraction.tokensUsed).toBe(0)

      // Claude should not have been called
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it("handles S3 fetch failures gracefully", async () => {
      mockGetFileBuffer.mockRejectedValue(
        new Error("NoSuchKey: The specified key does not exist")
      )


      const extraction = await extractFromStatement(
        "uploads/client-123/missing.pdf",
        "pdf"
      )

      expect(extraction.success).toBe(false)
      expect(extraction.error).toContain("Failed to fetch file from S3")
      expect(extraction.tokensUsed).toBe(0)
    })

    it("handles image file types correctly", async () => {
      const validResult = createValidExtractionResult()
      mockCreate.mockResolvedValue(createAnthropicResponse(validResult))


      const imageTypes = ["jpeg", "jpg", "png", "gif", "webp"]

      for (const imageType of imageTypes) {
        const extraction = await extractFromStatement(
          `uploads/client-123/statement.${imageType}`,
          imageType
        )
        expect(extraction.success).toBe(true)
      }
    })
  })
})
