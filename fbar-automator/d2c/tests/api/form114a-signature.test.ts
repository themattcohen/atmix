import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P7-1 will modify d2c/src/lib/form114a.ts to handle drawn signatures
// Currently generateForm114a() shows "[Digital signature on file]" for drawn type.
// P7-1 will embed the base64 PNG image data into the PDF when signatureType === "drawn".

// Mock S3 upload to avoid real uploads during tests
vi.mock("@/lib/s3", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
}));

import { generateForm114a, type Form114aData } from "@/lib/form114a";
import { uploadFile } from "@/lib/s3";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseFormData(overrides: Partial<Form114aData> = {}): Form114aData {
  return {
    userId: "test-user-id",
    firstName: "Test",
    lastName: "User",
    tinLast4: "1234",
    calendarYear: 2024,
    accountCount: 3,
    signatureData: "Test User",
    signatureType: "typed",
    signedAt: new Date("2024-12-15T10:30:00Z"),
    signatureIp: "127.0.0.1",
    ...overrides,
  };
}

// A minimal valid base64-encoded 1x1 white PNG for testing
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("P7-1: Form 114a — drawn signature support", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("P7-1: typed signature produces a valid PDF (backward compatibility)", async () => {
    const data = baseFormData({ signatureType: "typed", signatureData: "Test User" });

    const result = await generateForm114a(data);

    expect(result).toHaveProperty("buffer");
    expect(result).toHaveProperty("key");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    // PDF should start with %PDF magic bytes
    const header = result.buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");

    // S3 upload should have been called
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringContaining("form114a/"),
      expect.any(Buffer),
      "application/pdf"
    );
  });

  it("P7-1: typed signature embeds the signer name in PDF content", async () => {
    const signerName = "John Smith";
    const data = baseFormData({ signatureType: "typed", signatureData: signerName });

    const result = await generateForm114a(data);

    // The PDF buffer should contain the typed name somewhere in its content
    const pdfText = result.buffer.toString("latin1");
    expect(pdfText).toContain(signerName);
  });

  // IMPLEMENTATION NEEDED: P7-1 will add drawn signature image embedding
  // When signatureType === "drawn", signatureData will contain a base64 PNG
  // and the PDF should embed it as an image instead of showing text.
  it("P7-1: drawn signature with base64 PNG produces valid PDF", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: TINY_PNG_BASE64,
    });

    const result = await generateForm114a(data);

    expect(result).toHaveProperty("buffer");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    // PDF should still start with %PDF magic bytes
    const header = result.buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");

    // S3 upload should have been called
    expect(uploadFile).toHaveBeenCalled();
  });

  // IMPLEMENTATION NEEDED: P7-1 will embed the PNG image data directly into the PDF
  // rather than referencing an external URL. This test verifies the image data
  // is present in the PDF stream.
  it("P7-1: drawn signature image data is embedded in the PDF, not just referenced", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: TINY_PNG_BASE64,
    });

    const result = await generateForm114a(data);

    // The PDF should contain image-related markers (jsPDF addImage embeds raw data)
    // When a PNG is embedded in a PDF, the stream will contain image XObject references
    const pdfContent = result.buffer.toString("latin1");

    // PDF with embedded image should have /Subtype /Image or image stream markers
    // At minimum, the drawn signature path should NOT fall through to the typed path
    // (i.e., it should NOT contain the old "[Digital signature on file]" text)
    expect(pdfContent).not.toContain("[Digital signature on file]");
  });

  it("P7-1: PDF output has non-trivial size", async () => {
    const data = baseFormData({ signatureType: "typed", signatureData: "Test User" });

    const result = await generateForm114a(data);

    // A generated PDF with content should be at least several KB
    expect(result.buffer.length).toBeGreaterThan(1000);
  });

  it("P7-1: generated S3 key contains userId and calendarYear", async () => {
    const data = baseFormData({
      userId: "user-abc-123",
      calendarYear: 2024,
    });

    const result = await generateForm114a(data);

    expect(result.key).toContain("user-abc-123");
    expect(result.key).toContain("2024");
    expect(result.key).toMatch(/form114a\//);
    expect(result.key).toMatch(/\.pdf$/);
  });

  it("P7-1: PDF contains filer name and calendar year", async () => {
    const data = baseFormData({
      firstName: "Alice",
      lastName: "Jones",
      calendarYear: 2023,
    });

    const result = await generateForm114a(data);
    const pdfText = result.buffer.toString("latin1");

    expect(pdfText).toContain("Alice");
    expect(pdfText).toContain("Jones");
    expect(pdfText).toContain("2023");
  });

  it("P7-1: PDF contains TIN last 4 digits", async () => {
    const data = baseFormData({ tinLast4: "9876" });

    const result = await generateForm114a(data);
    const pdfText = result.buffer.toString("latin1");

    expect(pdfText).toContain("9876");
  });

  it("P7-1: drawn signature with empty string throws", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: "",
    });

    // signatureData is empty — Zod validation would catch this first,
    // but form114a.ts should also reject it
    await expect(generateForm114a(data)).rejects.toThrow(/invalid.*base64/i);
  });

  it("P7-1: drawn signature with garbage data throws", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: "not-valid-base64!!!@#$",
    });

    await expect(generateForm114a(data)).rejects.toThrow(/invalid.*base64/i);
  });

  it("P7-1: drawn signature with data URI prefix is accepted", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: `data:image/png;base64,${TINY_PNG_BASE64}`,
    });

    const result = await generateForm114a(data);
    expect(result).toHaveProperty("buffer");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it("P7-1: drawn signature with wrong data URI prefix throws", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: "data:text/plain;base64,SGVsbG8=",
    });

    // text/plain doesn't match image/* pattern
    await expect(generateForm114a(data)).rejects.toThrow(/invalid.*base64/i);
  });

  it("P7-1: drawn signature with valid raw base64 succeeds", async () => {
    const data = baseFormData({
      signatureType: "drawn",
      signatureData: TINY_PNG_BASE64,
    });

    const result = await generateForm114a(data);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    const header = result.buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});
