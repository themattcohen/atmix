import { describe, it, expect } from "vitest";
import {
  validateFile,
  normalizeMimeType,
  validateMagicBytes,
  getFileExtension,
} from "@/lib/upload-validation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function makeFile(
  name: string,
  type: string,
  size: number
): { name: string; type: string; size: number } {
  return { name, type, size };
}

// ─── validateFile — Rejected types ───────────────────────────────────────────

describe("validateFile — rejected types", () => {
  it("1. TIFF file (.tiff, image/tiff) → returns error message", () => {
    const result = validateFile(makeFile("scan.tiff", "image/tiff", 1024));
    expect(result).not.toBeNull();
    expect(result).toContain("image/tiff");
    expect(result).toContain("not supported");
  });

  it("2. BMP file (.bmp, image/bmp) → returns error message", () => {
    const result = validateFile(makeFile("photo.bmp", "image/bmp", 1024));
    expect(result).not.toBeNull();
    expect(result).toContain("image/bmp");
    expect(result).toContain("not supported");
  });

  it("3. HEIC file (.heic, image/heic) → returns error message", () => {
    const result = validateFile(makeFile("photo.heic", "image/heic", 1024));
    expect(result).not.toBeNull();
    expect(result).toContain("image/heic");
    expect(result).toContain("not supported");
  });

  it("4. HEIF file (.heif, image/heif) → returns error message", () => {
    const result = validateFile(makeFile("photo.heif", "image/heif", 1024));
    expect(result).not.toBeNull();
    expect(result).toContain("image/heif");
    expect(result).toContain("not supported");
  });

  it("5. arbitrary type (application/zip) → returns error message", () => {
    const result = validateFile(makeFile("archive.zip", "application/zip", 1024));
    expect(result).not.toBeNull();
    expect(result).toContain("application/zip");
    expect(result).toContain("not supported");
  });
});

// ─── validateFile — Accepted types ───────────────────────────────────────────

describe("validateFile — accepted types", () => {
  it("6. PDF file → returns null (valid)", () => {
    const result = validateFile(makeFile("return.pdf", "application/pdf", 1024));
    expect(result).toBeNull();
  });

  it("7. JPEG file → returns null", () => {
    const result = validateFile(makeFile("photo.jpg", "image/jpeg", 1024));
    expect(result).toBeNull();
  });

  it("8. PNG file → returns null", () => {
    const result = validateFile(makeFile("screenshot.png", "image/png", 1024));
    expect(result).toBeNull();
  });

  it("9. GIF file → returns null", () => {
    const result = validateFile(makeFile("animation.gif", "image/gif", 1024));
    expect(result).toBeNull();
  });

  it("10. WebP file → returns null", () => {
    const result = validateFile(makeFile("image.webp", "image/webp", 1024));
    expect(result).toBeNull();
  });

  it("11. CSV file → returns null", () => {
    const result = validateFile(makeFile("data.csv", "text/csv", 1024));
    expect(result).toBeNull();
  });

  it("12. XLSX file → returns null", () => {
    const result = validateFile(
      makeFile(
        "report.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024
      )
    );
    expect(result).toBeNull();
  });
});

// ─── validateFile — Size limits ───────────────────────────────────────────────

describe("validateFile — size limits", () => {
  it("13. file exactly at 50 MB → returns null", () => {
    const result = validateFile(makeFile("exact.pdf", "application/pdf", MAX_FILE_SIZE));
    expect(result).toBeNull();
  });

  it("14. file over 50 MB → returns error with size in message", () => {
    const overLimit = MAX_FILE_SIZE + 1;
    const result = validateFile(makeFile("huge.pdf", "application/pdf", overLimit));
    expect(result).not.toBeNull();
    expect(result).toContain("exceeds the 50MB limit");
  });

  it("15. empty file (size 0) → returns error 'File is empty.'", () => {
    const result = validateFile(makeFile("empty.pdf", "application/pdf", 0));
    expect(result).toBe("File is empty.");
  });
});

// ─── normalizeMimeType ────────────────────────────────────────────────────────

describe("normalizeMimeType", () => {
  it("16. CSV with text/plain type → normalizes to text/csv", () => {
    const result = normalizeMimeType({ name: "data.csv", type: "text/plain" });
    expect(result).toBe("text/csv");
  });

  it("17. CSV with application/octet-stream → normalizes to text/csv", () => {
    const result = normalizeMimeType({
      name: "export.csv",
      type: "application/octet-stream",
    });
    expect(result).toBe("text/csv");
  });

  it("18. CSV with empty type → normalizes to text/csv", () => {
    const result = normalizeMimeType({ name: "accounts.csv", type: "" });
    expect(result).toBe("text/csv");
  });

  it("19. XLSX with application/octet-stream → normalizes to xlsx mime", () => {
    const result = normalizeMimeType({
      name: "report.xlsx",
      type: "application/octet-stream",
    });
    expect(result).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("20. XLSX with empty type → normalizes to xlsx mime", () => {
    const result = normalizeMimeType({ name: "data.xlsx", type: "" });
    expect(result).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("21. PDF with application/pdf → returns type as-is", () => {
    const result = normalizeMimeType({ name: "return.pdf", type: "application/pdf" });
    expect(result).toBe("application/pdf");
  });
});

// ─── validateMagicBytes ───────────────────────────────────────────────────────

describe("validateMagicBytes", () => {
  it("22. PDF magic bytes (0x25504446) → true", () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(validateMagicBytes(buf, "application/pdf")).toBe(true);
  });

  it("23. JPEG magic bytes (0xFFD8FF) → true", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateMagicBytes(buf, "image/jpeg")).toBe(true);
  });

  it("24. PNG magic bytes (0x89504E47) → true", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateMagicBytes(buf, "image/png")).toBe(true);
  });

  it("25. wrong magic bytes for PDF → false", () => {
    // GIF header instead of PDF
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateMagicBytes(buf, "application/pdf")).toBe(false);
  });

  it("26. CSV (no magic bytes check) → true regardless of content", () => {
    const buf = Buffer.from("account_number,balance\n123,456\n");
    expect(validateMagicBytes(buf, "text/csv")).toBe(true);
  });

  it("27. buffer too short for magic bytes → false", () => {
    // PDF magic requires 4 bytes; provide only 2
    const buf = Buffer.from([0x25, 0x50]);
    expect(validateMagicBytes(buf, "application/pdf")).toBe(false);
  });
});

// ─── getFileExtension ─────────────────────────────────────────────────────────

describe("getFileExtension", () => {
  it('28. "document.pdf" → "pdf"', () => {
    expect(getFileExtension("document.pdf")).toBe("pdf");
  });

  it('29. "image.JPEG" → "jpeg" (lowercase)', () => {
    expect(getFileExtension("image.JPEG")).toBe("jpeg");
  });

  it('30. "no-extension" (no dot) → returns the full name lowercased (no real extension)', () => {
    // split(".").pop() on a string with no dot returns the whole string.
    // The function returns "" only when pop() yields undefined, which cannot
    // happen here. This test documents the actual boundary behaviour.
    expect(getFileExtension("no-extension")).toBe("no-extension");
  });
});
