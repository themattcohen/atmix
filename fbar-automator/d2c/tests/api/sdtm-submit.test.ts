import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// Mocks MUST be declared before any imports that depend on them
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/fincen-xml", () => ({
  generateFincenXml: vi.fn(),
}));
vi.mock("@/lib/sdtm", () => ({
  submitBatch: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendSubmissionEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/sdtm/submit/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch } from "@/lib/sdtm";
import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `sdtm-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/sdtm/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Valid XML that passes all three validation gates:
//   1. non-null
//   2. length >= 100
//   3. contains "<BSAMessage"
const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?><BSAMessage>${"x".repeat(100)}</BSAMessage>`;

async function resetFilingToPaid() {
  await prisma.filingYear.update({
    where: { id: testFilingId },
    data: {
      status: "PAID",
      sdtmBatchId: null,
      sdtmSubmissionId: null,
      submittedAt: null,
    },
  });
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "SDTM",
      lastName: "Tester",
    },
  });
  testUserId = user.id;

  const filing = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "PAID",
    },
  });
  testFilingId = filing.id;
});

afterAll(async () => {
  // Cascade deletes will remove the filing and any related records
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Reset the filing back to PAID after every test so each test starts clean
  await resetFilingToPaid();
  vi.resetAllMocks();
  // Re-mock sendSubmissionEmail so the default no-op is always in place
  const { sendSubmissionEmail } = await import("@/lib/email");
  (sendSubmissionEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/sdtm/submit", () => {
  // ── Happy Path ────────────────────────────────────────────────────────────

  it("8. happy path: PAID filing → SUBMITTED + returns batchId", async () => {
    mockAuth(testUserId);
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_XML);
    (submitBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      batchId: "test-batch-happy",
      remoteFilePath: "/upload/test-happy.xml",
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.batchId).toBeTruthy();
    expect(json.data.submittedAt).toBeTruthy();

    // Verify DB was updated to SUBMITTED
    const filing = await prisma.filingYear.findUnique({
      where: { id: testFilingId },
    });
    expect(filing!.status).toBe("SUBMITTED");
    expect(filing!.sdtmBatchId).toBeTruthy();
    expect(filing!.submittedAt).not.toBeNull();
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it("9. already SUBMITTED → returns success with alreadySubmitted=true", async () => {
    mockAuth(testUserId);

    // Manually set the filing to SUBMITTED
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: {
        status: "SUBMITTED",
        sdtmBatchId: "pre-existing-batch",
        submittedAt: new Date("2024-06-01T00:00:00Z"),
      },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.alreadySubmitted).toBe(true);
    expect(json.data.batchId).toBe("pre-existing-batch");

    // Neither XML generation nor SFTP should have been called
    expect(generateFincenXml).not.toHaveBeenCalled();
    expect(submitBatch).not.toHaveBeenCalled();
  });

  // ── State Guard ───────────────────────────────────────────────────────────

  it("10. filing not in PAID state (IN_PROGRESS) → 409", async () => {
    mockAuth(testUserId);

    // Put filing in a non-PAID, non-idempotent state
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "IN_PROGRESS" },
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/not in a state that allows submission/i);
  });

  // ── Auth Guard ────────────────────────────────────────────────────────────

  it("11. unauthenticated → 401", async () => {
    mockAuth(null);

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  // ── Not Found ─────────────────────────────────────────────────────────────

  it("12. filing not found → 404", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRequest({ filingYearId: "nonexistent-id-000" }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("13. missing filingYearId → 400", async () => {
    mockAuth(testUserId);

    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/filingYearId is required/i);
  });

  // ── P1-3: Invalid JSON body ───────────────────────────────────────────────

  it("7. invalid JSON body → 400 'Invalid JSON body'", async () => {
    mockAuth(testUserId);

    // Send a raw request with a non-JSON body to trigger req.json() to throw
    const req = new NextRequest("http://localhost:3000/api/sdtm/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not { valid json ]",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid json body/i);
  });

  // ── P1-6: XML Validation Gate ─────────────────────────────────────────────

  it("3. generateFincenXml returns null → 500 + filing reverts to PAID", async () => {
    mockAuth(testUserId);
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/xml validation failed/i);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("PAID");
  });

  it("4. generateFincenXml returns short string (<100 chars) → 500 + filing reverts to PAID", async () => {
    mockAuth(testUserId);
    // Valid-looking XML but too short to pass the length gate
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(
      "<BSAMessage>short</BSAMessage>"
    );

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/xml validation failed/i);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("PAID");
  });

  it("5. generateFincenXml returns string without <BSAMessage → 500 + filing reverts to PAID", async () => {
    mockAuth(testUserId);
    // Long enough but missing the required <BSAMessage tag
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(
      `<?xml version="1.0"?><SomeOtherElement>${"x".repeat(100)}</SomeOtherElement>`
    );

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/xml validation failed/i);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("PAID");
  });

  it("6. generateFincenXml returns valid XML (>100 chars + contains <BSAMessage) → proceeds to submitBatch", async () => {
    mockAuth(testUserId);
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_XML);
    (submitBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      batchId: "valid-xml-batch",
      remoteFilePath: "/upload/valid.xml",
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));

    expect(res.status).toBe(200);
    // submitBatch must have been called because XML passed the gate
    expect(submitBatch).toHaveBeenCalledTimes(1);
    expect(submitBatch).toHaveBeenCalledWith(VALID_XML, expect.any(String));
  });

  // ── P1-5: Error Handling Reverts SUBMITTING → PAID ────────────────────────

  it("1. submitBatch fails → filing reverts from SUBMITTING to PAID", async () => {
    mockAuth(testUserId);
    (generateFincenXml as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_XML);
    (submitBatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "SFTP connection refused",
    });

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/submission failed/i);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("PAID");
    // Must not have been marked as SUBMITTED
    expect(filing!.sdtmBatchId).toBeNull();
    expect(filing!.submittedAt).toBeNull();
  });

  it("2. generateFincenXml throws → filing reverts from SUBMITTING to PAID", async () => {
    mockAuth(testUserId);
    (generateFincenXml as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("XML generation exploded")
    );

    const res = await POST(makeRequest({ filingYearId: testFilingId }));
    const json = await res.json();

    // The outer catch should have reverted SUBMITTING → PAID and returned 500
    expect(res.status).toBe(500);
    expect(json.error).toMatch(/submission failed/i);

    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing!.status).toBe("PAID");
  });
});
