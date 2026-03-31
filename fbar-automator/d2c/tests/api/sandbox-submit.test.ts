import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";

import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch, checkAcknowledgement } from "@/lib/sdtm";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Sandbox SFTP submission test
// ---------------------------------------------------------------------------
// Skipped by default — only runs when SDTM_SANDBOX_HOST is set.
// Invoke manually:
//   SDTM_SANDBOX_HOST=bsaefiling-direct-transfer-sandbox.fincen.gov \
//   SDTM_USERNAME=... SDTM_PASSWORD=... \
//   npx vitest run tests/api/sandbox-submit.test.ts
// ---------------------------------------------------------------------------

const TEST_EMAIL = `sandbox-submit-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

// Stash original env vars for restore
const originalEnv: Record<string, string | undefined> = {};

function stashEnv(...keys: string[]) {
  for (const key of keys) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe.skipIf(!process.env.SDTM_SANDBOX_HOST)("Sandbox SFTP submission", () => {
  beforeAll(async () => {
    // Stash env vars we will override
    stashEnv(
      "FINCEN_TRANSMITTER_NAME",
      "FINCEN_TRANSMITTER_TIN",
      "FINCEN_TRANSMITTER_TCC",
      "FINCEN_TRANSMITTER_ADDRESS",
      "FINCEN_TRANSMITTER_CONTACT_NAME",
      "FINCEN_TRANSMITTER_CONTACT_PHONE",
      "SDTM_HOST",
      "SDTM_SANDBOX_MODE",
    );

    // Transmitter config — use TBSATEST TCC for sandbox
    process.env.FINCEN_TRANSMITTER_NAME = "FBAR Direct LLC";
    process.env.FINCEN_TRANSMITTER_TIN = "123456789";
    process.env.FINCEN_TRANSMITTER_TCC = "TBSATEST";
    process.env.FINCEN_TRANSMITTER_ADDRESS = "123 Main St, Denver, CO 80202";
    process.env.FINCEN_TRANSMITTER_CONTACT_NAME = "Test Admin";
    process.env.FINCEN_TRANSMITTER_CONTACT_PHONE = "3035551234";

    // Point SFTP at the sandbox host and disable sandbox mock mode
    // so submitBatch actually connects via SFTP instead of logging.
    process.env.SDTM_HOST = process.env.SDTM_SANDBOX_HOST;
    process.env.SDTM_SANDBOX_MODE = "false";

    // Create test user + filing + account
    const passwordHash = await bcrypt.hash("SandboxTest1!", 10);
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash,
        firstName: "Sandbox",
        lastName: "Tester",
        tin: encrypt("900000001"),
        tinType: "SSN",
        dateOfBirth: new Date("1990-01-15"),
        usAddress: {
          street: "789 Sandbox Blvd",
          city: "Denver",
          state: "CO",
          zip: "80202",
        },
      },
    });
    testUserId = user.id;

    const filing = await prisma.filingYear.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        status: "PAID",
        filingType: "ORIGINAL",
      },
    });
    testFilingId = filing.id;

    await prisma.foreignAccount.create({
      data: {
        userId: testUserId,
        calendarYear: 2024,
        institutionName: "Sandbox Test Bank AG",
        accountNumber: encrypt("CH0000000000SANDBOX1"),
        accountType: "BANK",
        ownershipType: "FINANCIAL_INTEREST",
        countryCode: "CH",
        currencyCode: "CHF",
        maxValueLocal: 10000,
        maxValueUsd: 10000,
        exchangeRate: 1.0,
        exchangeRateSource: "TREASURY",
        isJointAccount: false,
        jointOwnerInfo: null,
        institutionAddress: Prisma.DbNull,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    restoreEnv();
    await prisma.$disconnect();
  });

  it("generates valid XML and sandbox accepts it", async () => {
    // 1. Generate XML
    const xml = await generateFincenXml(testFilingId);
    expect(xml).toContain("<fc2:EFilingBatchXML");
    expect(xml.length).toBeGreaterThan(100);

    // 2. Submit to sandbox SFTP
    const batchId = crypto.randomUUID();
    const submitResult = await submitBatch(xml, batchId);
    expect(submitResult.success).toBe(true);
    console.log("[SANDBOX] Submitted:", submitResult.remoteFilePath);

    // 3. Poll for acknowledgement (up to 15 minutes, check every 30 seconds)
    const MAX_POLLS = 30; // 30 * 30s = 15 minutes
    const POLL_INTERVAL_MS = 30_000;

    let finalStatus: "pending" | "accepted" | "rejected" = "pending";
    let rejectionReason: string | undefined;

    for (let i = 0; i < MAX_POLLS; i++) {
      // Wait before checking (FinCEN needs time to process)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const ackResult = await checkAcknowledgement(submitResult.remoteFilePath);
      console.log(`[SANDBOX] Poll ${i + 1}/${MAX_POLLS}: status=${ackResult.status}`);

      if (ackResult.status === "accepted") {
        finalStatus = "accepted";
        console.log("[SANDBOX] ACCEPTED! BSA ID:", ackResult.bsaId);
        break;
      }

      if (ackResult.status === "rejected") {
        finalStatus = "rejected";
        rejectionReason = ackResult.rejectionReason;
        console.error("[SANDBOX] REJECTED:", rejectionReason);
        break;
      }
    }

    if (finalStatus === "rejected") {
      expect.fail(`Sandbox rejected the filing: ${rejectionReason}`);
    }

    if (finalStatus === "pending") {
      expect.fail(
        `Sandbox did not acknowledge the filing within 15 minutes. ` +
        `Submission: ${submitResult.remoteFilePath}`
      );
    }

    expect(finalStatus).toBe("accepted");
  }, { timeout: 20 * 60 * 1000 }); // 20 minute timeout for this individual test
}, { timeout: 20 * 60 * 1000 });
