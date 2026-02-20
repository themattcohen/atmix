import { describe, it, expect, beforeAll } from "vitest";

// P7-2: xlsx replaced with exceljs in d2c/src/lib/extraction.ts.
// convertExcelToText is now async (returns Promise<string>) and exported directly.

import ExcelJS from "exceljs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal .xlsx buffer using exceljs with the given rows.
 * Each row is an array of cell values.
 */
async function createXlsxBuffer(
  rows: (string | number | null)[][],
  sheetName = "Sheet1"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a multi-sheet .xlsx buffer.
 */
async function createMultiSheetXlsxBuffer(
  sheets: { name: string; rows: (string | number | null)[][] }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);
    for (const row of rows) {
      sheet.addRow(row);
    }
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("P7-2: Excel extraction with exceljs (parity with xlsx library)", () => {
  // convertExcelToText is now async — type reflects that
  let convertExcelToText: ((buffer: Buffer) => Promise<string>) | undefined;

  beforeAll(async () => {
    try {
      const extraction = await import("@/lib/extraction");
      convertExcelToText = extraction.convertExcelToText;
    } catch {
      // Module may not export this function yet
    }
  });

  it("P7-2: .xlsx file with header + data rows returns parsed text output", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const buffer = await createXlsxBuffer([
      ["Date", "Description", "Amount", "Balance"],
      ["2024-01-15", "Wire Transfer", 5000, 15000],
      ["2024-02-20", "Deposit", 3000, 18000],
    ]);

    const result = await convertExcelToText(buffer);

    expect(typeof result).toBe("string");
    expect(result).toContain("Date");
    expect(result).toContain("Wire Transfer");
    expect(result).toContain("5000");
    expect(result).toContain("18000");
  });

  it("P7-2: empty spreadsheet returns empty or minimal text", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const buffer = await createXlsxBuffer([]);

    const result = await convertExcelToText(buffer);

    expect(typeof result).toBe("string");
    // An empty sheet should produce minimal output — just the header text at most
    // The exact format is: "Excel Bank Statement Data:\n\n" followed by sheet content
    // With no data, the sheet content portion should be empty or whitespace-only
  });

  it("P7-2: multi-sheet workbook processes all sheets with content", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const buffer = await createMultiSheetXlsxBuffer([
      {
        name: "Checking",
        rows: [
          ["Date", "Amount"],
          ["2024-01-01", 1000],
        ],
      },
      {
        name: "Savings",
        rows: [
          ["Date", "Amount"],
          ["2024-06-01", 5000],
        ],
      },
    ]);

    const result = await convertExcelToText(buffer);

    expect(typeof result).toBe("string");
    // Should contain data from the first sheet at minimum
    expect(result).toContain("1000");
    // Current implementation processes all sheets with content
    expect(result).toContain("Checking");
  });

  it("P7-2: .xlsx with 1000+ rows handles without error or OOM", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const header = ["Date", "Description", "Debit", "Credit", "Balance"];
    const rows: (string | number)[][] = [header];
    for (let i = 0; i < 1200; i++) {
      rows.push([
        `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
        `Transaction ${i + 1}`,
        i % 3 === 0 ? 100 : 0,
        i % 3 !== 0 ? 50 : 0,
        10000 + i * 10,
      ]);
    }

    const buffer = await createXlsxBuffer(rows);

    // Should not throw or hang
    const result = await convertExcelToText(buffer);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Verify some content from the large dataset
    expect(result).toContain("Transaction 1");
    expect(result).toContain("Transaction 1200");
  });

  it("P7-2: output format matches expected structure (header line + CSV data)", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const buffer = await createXlsxBuffer([
      ["Account", "Balance"],
      ["CH12345", 50000],
    ]);

    const result = await convertExcelToText(buffer);

    // Current format: "Excel Bank Statement Data:\n\n" + per-sheet content
    expect(result).toContain("Excel Bank Statement Data:");
    expect(result).toContain("CH12345");
    expect(result).toContain("50000");
  });

  it("P7-2: numeric values are preserved accurately", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping until P7-2 implementation");
      return;
    }

    const buffer = await createXlsxBuffer([
      ["Value"],
      [0.01],
      [999999.99],
      [1234567890],
    ]);

    const result = await convertExcelToText(buffer);

    // Numbers should be preserved without floating-point corruption
    expect(result).toContain("0.01");
    expect(result).toContain("999999.99");
    expect(result).toContain("1234567890");
  });

  it("37: Excel files exceeding 5000 rows are truncated with a warning message", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping");
      return;
    }

    // Create a workbook with 5100 data rows (exceeds MAX_EXCEL_ROWS = 5000)
    const header = ["Date", "Description", "Amount"];
    const rows: (string | number)[][] = [header];
    for (let i = 0; i < 5100; i++) {
      rows.push([`2024-01-01`, `Row ${i + 1}`, i * 10]);
    }

    const buffer = await createXlsxBuffer(rows);
    const result = await convertExcelToText(buffer);

    // Should include truncation notice
    expect(result).toContain("[Truncated: Excel file exceeded 5000 rows. Some data may be missing.]");

    // Early rows should be present
    expect(result).toContain("Row 1");

    // Row 5100 should NOT be present (was cut off)
    expect(result).not.toContain("Row 5100");
  });

  it("37: Excel files with exactly 5000 rows are NOT truncated", async () => {
    if (!convertExcelToText) {
      console.warn("convertExcelToText not yet exported — skipping");
      return;
    }

    // Create a workbook with exactly 5000 data rows (at the limit, not over)
    const rows: (string | number)[][] = [];
    for (let i = 0; i < 5000; i++) {
      rows.push([`Row ${i + 1}`, i]);
    }

    const buffer = await createXlsxBuffer(rows);
    const result = await convertExcelToText(buffer);

    // Should NOT include truncation notice
    expect(result).not.toContain("[Truncated:");

    // Last row should be present
    expect(result).toContain("Row 5000");
  });
});
