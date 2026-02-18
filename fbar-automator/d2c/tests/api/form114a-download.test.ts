import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";

// Mock auth BEFORE importing the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET } from "@/app/api/filing/form114a/route";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { uploadFile, deleteFile } from "@/lib/s3";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(id?: string): NextRequest {
  const url = id
    ? `http://localhost:3001/api/filing/form114a?id=${id}`
    : "http://localhost:3001/api/filing/form114a";
  return new NextRequest(url, { method: "GET" });
}

function mockAuth(userId: string | null) {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(
    userId ? { user: { id: userId } } : null
  );
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

let testUser: { id: string; email: string };
let secondUser: { id: string; email: string };
let filingId: string;
let nullFormFilingId: string;
let secondUserFilingId: string;
let s3Key: string;

const testPdfBuffer = Buffer.from("%PDF-1.4 test content");

beforeAll(async () => {
  const ts = Date.now();
  s3Key = `test/form114a-${ts}.pdf`;

  // Upload test PDF to MinIO
  await uploadFile(s3Key, testPdfBuffer, "application/pdf");

  // Create primary test user
  const email = `test-form114a-${ts}@test.com`;
  const passwordHash = await bcrypt.hash("TestPassword1", 10);
  testUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Test",
      lastName: "User",
    },
  });

  // Create filing with form114aUrl pointing to the uploaded S3 key
  const filing = await prisma.filingYear.create({
    data: {
      userId: testUser.id,
      calendarYear: 2024,
      status: "SUBMITTED",
      form114aUrl: s3Key,
    },
  });
  filingId = filing.id;

  // Create a second filing for testUser with form114aUrl = null (unsigned)
  const nullFormFiling = await prisma.filingYear.create({
    data: {
      userId: testUser.id,
      calendarYear: 2023,
      status: "IN_PROGRESS",
      form114aUrl: null,
    },
  });
  nullFormFilingId = nullFormFiling.id;

  // Create second user with their own filing
  const email2 = `test-form114a-other-${ts}@test.com`;
  const passwordHash2 = await bcrypt.hash("TestPassword1", 10);
  secondUser = await prisma.user.create({
    data: {
      email: email2,
      passwordHash: passwordHash2,
      firstName: "Other",
      lastName: "User",
    },
  });

  const secondUserFiling = await prisma.filingYear.create({
    data: {
      userId: secondUser.id,
      calendarYear: 2024,
      status: "SUBMITTED",
      form114aUrl: s3Key,
    },
  });
  secondUserFilingId = secondUserFiling.id;
});

afterAll(async () => {
  // Cascade deletes clean up filingYear records
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.user.delete({ where: { id: secondUser.id } });
  await prisma.$disconnect();
  await deleteFile(s3Key);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/filing/form114a", () => {
  it("1. happy path: returns 200 PDF with correct headers and non-empty body", async () => {
    mockAuth(testUser.id);

    const res = await GET(makeRequest(filingId));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("form114a_");
    expect(disposition).toContain('.pdf"');

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("2. unauthenticated: returns 401", async () => {
    mockAuth(null);

    const res = await GET(makeRequest(filingId));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("3. missing id param: returns 400", async () => {
    mockAuth(testUser.id);

    const res = await GET(makeRequest());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/filing id required/i);
  });

  it("4. nonexistent filing ID: returns 404", async () => {
    mockAuth(testUser.id);

    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await GET(makeRequest(fakeId));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/form 114a not found/i);
  });

  it("5. filing exists but form114aUrl is null: returns 404", async () => {
    mockAuth(testUser.id);

    const res = await GET(makeRequest(nullFormFilingId));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/form 114a not found/i);
  });

  it("6. filing belongs to different user: returns 404", async () => {
    // Authenticate as testUser (first user), but request secondUser's filing
    mockAuth(testUser.id);

    const res = await GET(makeRequest(secondUserFilingId));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/form 114a not found/i);
  });
});
