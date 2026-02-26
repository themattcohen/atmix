// ---------------------------------------------------------------------------
// Integration Tests: Unified Extraction (CSV, XLSX, PDF, Images)
// ---------------------------------------------------------------------------
// Tests that all file types go through extractFromStatement() correctly.
// CSV/XLSX → text blocks, PDF → document blocks, Images → image blocks
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ExtractionResult } from "@/types/extraction"
import { extractFromStatement } from "@/lib/extraction"
import ExcelJS from "exceljs"

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

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Creates a minimal valid extraction result for testing
 */
function createValidExtractionResult(): ExtractionResult {
  return {
    accounts: [
      {
        bank_name: "Test Bank",
        bank_address: {
          street: null,
          city: "Zurich",
          state_province: null,
          country: "CH",
          postal_code: null,
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
      },
    ],
    document_language: "en",
    document_metadata: {
      page_count: 1,
      is_multi_account: false,
      is_transaction_only: false,
    },
  }
}

/**
 * Creates a mock Claude response with valid extraction result
 */
function createValidClaudeResponse() {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(createValidExtractionResult()),
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 200,
    },
  }
}

/**
 * Creates an XLSX buffer programmatically for testing
 */
async function createXlsxBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Sheet1")
  worksheet.addRows([
    ["Date", "Description", "Amount"],
    ["2024-01-15", "Transfer", "5000.00"],
    ["2024-02-20", "Payment", "2500.00"],
    ["2024-03-10", "Deposit", "7500.00"],
  ])
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Unified Extraction Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = "test-api-key-12345"
  })

  // -------------------------------------------------------------------------
  // 1. CSV sends text content block to Claude
  // -------------------------------------------------------------------------

  describe("CSV extraction", () => {
    it("sends CSV data as text content block to Claude", async () => {
      const csvContent = "Date,Description,Amount\n2024-01-15,Transfer,5000.00"
      mockGetFileBuffer.mockResolvedValue(Buffer.from(csvContent))
      mockCreate.mockResolvedValue(createValidClaudeResponse())

      const result = await extractFromStatement("path/to/file.csv", "csv")

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      // Verify the content block structure
      const callArgs = mockCreate.mock.calls[0][0]
      const messages = callArgs.messages

      expect(messages).toBeDefined()
      expect(messages[0].content).toBeDefined()

      // Find the text content block
      const textBlock = messages[0].content.find(
        (block: any) => block.type === "text" && block.text?.startsWith("CSV Bank Statement Data:")
      )
      expect(textBlock).toBeDefined()
      expect(textBlock.text).toContain(csvContent)

      // Verify NO base64/image/document blocks
      const hasImageBlock = messages[0].content.some(
        (block: any) => block.type === "image"
      )
      const hasDocumentBlock = messages[0].content.some(
        (block: any) => block.type === "document"
      )
      expect(hasImageBlock).toBe(false)
      expect(hasDocumentBlock).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 2. XLSX converts to text and sends to Claude
  // -------------------------------------------------------------------------

  describe("XLSX extraction", () => {
    it("converts XLSX to text and sends as text content block to Claude", async () => {
      const xlsxBuffer = await createXlsxBuffer()
      mockGetFileBuffer.mockResolvedValue(xlsxBuffer)
      mockCreate.mockResolvedValue(createValidClaudeResponse())

      const result = await extractFromStatement("path/to/file.xlsx", "xlsx")

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      // Verify the content block structure
      const callArgs = mockCreate.mock.calls[0][0]
      const messages = callArgs.messages

      expect(messages).toBeDefined()
      expect(messages[0].content).toBeDefined()

      // Find the text content block
      const textBlock = messages[0].content.find(
        (block: any) => block.type === "text" && block.text?.startsWith("Excel Bank Statement Data:")
      )
      expect(textBlock).toBeDefined()

      // Verify it contains the expected data
      expect(textBlock.text).toContain("Date")
      expect(textBlock.text).toContain("Description")
      expect(textBlock.text).toContain("Amount")

      // Verify NO base64/image/document blocks
      const hasImageBlock = messages[0].content.some(
        (block: any) => block.type === "image"
      )
      const hasDocumentBlock = messages[0].content.some(
        (block: any) => block.type === "document"
      )
      expect(hasImageBlock).toBe(false)
      expect(hasDocumentBlock).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 3. PDF still sends document block (backwards compatibility)
  // -------------------------------------------------------------------------

  describe("PDF extraction (backwards compatibility)", () => {
    it("sends PDF as document content block to Claude", async () => {
      mockGetFileBuffer.mockResolvedValue(Buffer.from("fake-pdf-content"))
      mockCreate.mockResolvedValue(createValidClaudeResponse())

      const result = await extractFromStatement("path/to/file.pdf", "pdf")

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      // Verify the content block structure
      const callArgs = mockCreate.mock.calls[0][0]
      const messages = callArgs.messages

      expect(messages).toBeDefined()
      expect(messages[0].content).toBeDefined()

      // Find the document content block
      const documentBlock = messages[0].content.find(
        (block: any) => block.type === "document"
      )
      expect(documentBlock).toBeDefined()
      expect(documentBlock.source).toBeDefined()
      expect(documentBlock.source.type).toBe("base64")
      expect(documentBlock.source.media_type).toBe("application/pdf")
    })
  })

  // -------------------------------------------------------------------------
  // 4. Image still sends image block (backwards compatibility)
  // -------------------------------------------------------------------------

  describe("Image extraction (backwards compatibility)", () => {
    it("sends JPG as image content block to Claude", async () => {
      mockGetFileBuffer.mockResolvedValue(Buffer.from("fake-image-data"))
      mockCreate.mockResolvedValue(createValidClaudeResponse())

      const result = await extractFromStatement("path/to/file.jpg", "jpg")

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      // Verify the content block structure
      const callArgs = mockCreate.mock.calls[0][0]
      const messages = callArgs.messages

      expect(messages).toBeDefined()
      expect(messages[0].content).toBeDefined()

      // Find the image content block
      const imageBlock = messages[0].content.find(
        (block: any) => block.type === "image"
      )
      expect(imageBlock).toBeDefined()
      expect(imageBlock.source).toBeDefined()
      expect(imageBlock.source.type).toBe("base64")
      expect(imageBlock.source.media_type).toBe("image/jpeg")
    })

    it("sends PNG as image content block to Claude", async () => {
      mockGetFileBuffer.mockResolvedValue(Buffer.from("fake-png-data"))
      mockCreate.mockResolvedValue(createValidClaudeResponse())

      const result = await extractFromStatement("path/to/file.png", "png")

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      const callArgs = mockCreate.mock.calls[0][0]
      const imageBlock = callArgs.messages[0].content.find(
        (block: any) => block.type === "image"
      )
      expect(imageBlock).toBeDefined()
      expect(imageBlock.source.media_type).toBe("image/png")
    })
  })

  // -------------------------------------------------------------------------
  // 5. Unsupported file type returns error
  // -------------------------------------------------------------------------

  describe("Unsupported file type handling", () => {
    it("rejects unsupported file types without calling Claude", async () => {
      const result = await extractFromStatement("path/to/file.xyz", "xyz")

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain("Unsupported file type")
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it("rejects .docx files", async () => {
      const result = await extractFromStatement("path/to/file.docx", "docx")

      expect(result.success).toBe(false)
      expect(result.error).toContain("Unsupported file type")
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it("rejects .txt files", async () => {
      const result = await extractFromStatement("path/to/file.txt", "txt")

      expect(result.success).toBe(false)
      expect(result.error).toContain("Unsupported file type")
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })
})
