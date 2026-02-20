import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

// IMPLEMENTATION NEEDED: P4-3 will create the following route handlers:
//   d2c/src/app/api/cron/submit-paid/route.ts — picks up PAID filings, generates XML, submits via SDTM
//   d2c/src/app/api/cron/poll-submitted/route.ts — polls SUBMITTED filings for acknowledgements
//   d2c/src/lib/fincen-submit.ts — shared submission logic (optional extraction)
//
// These tests mock the downstream dependencies (fincen-xml, sdtm, email)
// and validate the cron route contracts.

// Mocks MUST be declared before any imports that depend on them
vi.mock("@/lib/fincen-xml", () => ({
  generateFincenXml: vi.fn(),
}));
vi.mock("@/lib/sdtm", () => ({
  submitBatch: vi.fn(),
  checkAcknowledgement: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendSubmissionEmail: vi.fn().mockResolvedValue(undefined),
  sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

// IMPLEMENTATION NEEDED: P4-3 will create these route files.
// Uncomment imports once the routes exist:
//
// import { POST as submitPaidHandler } from "@/app/api/cron/submit-paid/route";
// import { POST as pollSubmittedHandler } from "@/app/api/cron/poll-submitted/route";
//
// For now, we define placeholder functions that will be swapped once P4-3 is implemented.
// This allows the test file to be syntactically valid and ready to run.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch, checkAcknowledgement } from "@/lib/sdtm";
import { sendSubmissionEmail, sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `cron-test-${Date.now()}@test.com`;
let testUserId: string;
let testFiling1Id: string; // PAID filing
let testFiling2Id: string; // IN_PROGRESS filing (should be skipped)
let testFiling3Id: string; // SUBMITTED filing (for acknowledgement polling)

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?><BSAMessage>${"x".repeat(100)}</BSAMessage>`;

// IMPLEMENTATION NEEDED: P4-3 cron routes will likely use a shared secret or
// internal-only auth mechanism (not user auth). Adjust the request builder
// to include whatever auth the cron routes require.
const CRON_SECRET = "test-cron-secret";

function makeSubmitPaidRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/submit-paid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // IMPLEMENTATION NEEDED: P4-3 may use Authorization header, x-cron-secret,
      // or Vercel cron auth. Adjust as needed.
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });
}

function makePollSubmittedRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/poll-submitted", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });
}

/**
 * Reset all test filings to their initial states between tests.
 */
async function resetFilings() {
  await prisma.filingYear.update({
    where: { id: testFiling1Id },
    data: {
      status: "PAID",
      sdtmBatchId: null,
      sdtmSubmissionId: null,
      submittedAt: null,
      bsaId: null,
      acknowledgedAt: null,
      rejectionReason: null,
    },
  });

  await prisma.filingYear.update({
    where: { id: testFiling2Id },
    data: {
      status: "IN_PROGRESS",
      sdtmBatchId: null,
      sdtmSubmissionId: null,
      submittedAt: null,
      bsaId: null,
      acknowledgedAt: null,
      rejectionReason: null,
    },
  });

  await prisma.filingYear.update({
    where: { id: testFiling3Id },
    data: {
      status: "SUBMITTED",
      sdtmBatchId: "existing-batch-id",
      submittedAt: new Date("2024-10-01T00:00:00Z"),
      bsaId: null,
      acknowledgedAt: null,
      rejectionReason: null,
    },
  });
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // IMPLEMENTATION NEEDED: Set the cron secret env var that P4-3 routes will check
  process.env.CRON_SECRET = CRON_SECRET;

  const passwordHash = await bcrypt.hash("TestPassword1!", 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      firstName: "Cron",
      lastName: "Tester",
    },
  });
  testUserId = user.id;

  // Filing 1: PAID — should be picked up by submit-paid cron
  const filing1 = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "PAID",
      filingType: "ORIGINAL",
    },
  });
  testFiling1Id = filing1.id;

  // Filing 2: IN_PROGRESS — should be SKIPPED by submit-paid cron
  const filing2 = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2023,
      status: "IN_PROGRESS",
      filingType: "ORIGINAL",
    },
  });
  testFiling2Id = filing2.id;

  // Filing 3: SUBMITTED — should be picked up by poll-submitted cron
  const filing3 = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2022,
      status: "SUBMITTED",
      filingType: "ORIGINAL",
      sdtmBatchId: "existing-batch-id",
      submittedAt: new Date("2024-10-01T00:00:00Z"),
    },
  });
  testFiling3Id = filing3.id;

  // Create a test account for the PAID filing so XML generation has data
  await prisma.foreignAccount.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      institutionName: "Cron Test Bank",
      accountNumber: "encrypted-cron-acct",
      accountType: "BANK",
      ownershipType: "FINANCIAL_INTEREST",
      countryCode: "CH",
      currencyCode: "CHF",
      maxValueLocal: 25000,
      isJointAccount: false,
    },
  });
});

afterAll(async () => {
  delete process.env.CRON_SECRET;
  // Cascade deletes clean up filings, accounts
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await resetFilings();
  vi.resetAllMocks();
  // Re-mock email functions to default no-op after resetAllMocks
  (sendSubmissionEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (sendConfirmationEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (sendRejectionEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

// ─── Tests: submit-paid cron ─────────────────────────────────────────────────

describe("P4-3: POST /api/cron/submit-paid — filing pickup", () => {
  // IMPLEMENTATION NEEDED: P4-3 will create d2c/src/app/api/cron/submit-paid/route.ts
  // that queries for all PAID filings and submits each via SDTM.

  it.todo("P4-3: cron picks up PAID filing and transitions to SUBMITTED");

  it.todo("P4-3: cron skips non-PAID filings (IN_PROGRESS is not picked up)");

  it.todo("P4-3: cron skips already-SUBMITTED filings");
});

describe("P4-3: POST /api/cron/submit-paid — idempotency", () => {
  it.todo("P4-3: calling cron twice does not double-submit SUBMITTING filings");
});

describe("P4-3: POST /api/cron/submit-paid — error handling", () => {
  it.todo("P4-3: submitBatch failure reverts filing from SUBMITTING to PAID");

  it.todo("P4-3: generateFincenXml failure reverts filing from SUBMITTING to PAID");

  it.todo("P4-3: generateFincenXml returns null — filing reverts to PAID");
});

// ─── Tests: poll-submitted cron ──────────────────────────────────────────────

describe("P4-3: POST /api/cron/poll-submitted — acknowledgement polling", () => {
  // IMPLEMENTATION NEEDED: P4-3 will create d2c/src/app/api/cron/poll-submitted/route.ts
  // that queries for all SUBMITTED filings and checks for acknowledgements.

  it.todo("P4-3: accepted acknowledgement transitions filing to ACCEPTED + stores bsaId");

  it.todo("P4-3: rejected acknowledgement transitions filing to REJECTED + stores reason");

  it.todo("P4-3: pending acknowledgement keeps filing in SUBMITTED state");

  it.todo("P4-3: poll-submitted only checks SUBMITTED filings, not PAID or IN_PROGRESS");
});

describe("P4-3: POST /api/cron/poll-submitted — error handling", () => {
  it.todo("P4-3: checkAcknowledgement throws — filing remains SUBMITTED");
});

describe("P4-3: POST /api/cron/submit-paid — email notification", () => {
  it.todo("P4-3: successful submission sends submission email to user");

  it.todo("P4-3: email send failure does not prevent filing status update");
});

describe("P4-3: POST /api/cron/* — auth guard", () => {
  // IMPLEMENTATION NEEDED: P4-3 cron routes must be protected.
  // They should only be callable with the correct CRON_SECRET or internal auth.

  it.todo("P4-3: submit-paid without auth header returns 401 or 403");

  it.todo("P4-3: submit-paid with wrong secret returns 401 or 403");

  it.todo("P4-3: poll-submitted without auth header returns 401 or 403");
});

describe("P4-3: multiple PAID filings — batch processing", () => {
  it.todo("P4-3: cron processes multiple PAID filings in a single run");
});
