/**
 * One-off script: Resubmit REJECTED FBAR filing (FXST26-00035130).
 *
 * The XML generation code had bugs (Party 43 missing, wrong PartyCount, etc.)
 * that caused FinCEN rejection. The code is now fixed (b440a1f). This script
 * resets the filing to PAID (preserving signature data) and triggers resubmission
 * via the submit-paid cron endpoint, which calls submitFiling() to regenerate
 * the XML with the fixed code and upload via SFTP.
 *
 * Usage (inside d2c-app container):
 *   npx tsx scripts/resubmit-rejected.ts
 *
 * Or from the host:
 *   docker compose -f docker-compose.prod.yml exec d2c-app npx tsx scripts/resubmit-rejected.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Find the single REJECTED filing
  const rejected = await prisma.filingYear.findMany({
    where: { status: "REJECTED" },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });

  if (rejected.length === 0) {
    console.error("No REJECTED filings found. Nothing to do.");
    process.exit(1);
  }
  if (rejected.length > 1) {
    console.error(
      `Expected exactly 1 REJECTED filing, found ${rejected.length}. Aborting for safety.`
    );
    for (const f of rejected) {
      console.error(`  - ${f.id} (user: ${f.user.email}, year: ${f.calendarYear})`);
    }
    process.exit(1);
  }

  const filing = rejected[0];
  console.log(`Found REJECTED filing:`);
  console.log(`  ID:    ${filing.id}`);
  console.log(`  User:  ${filing.user.email} (${filing.user.firstName})`);
  console.log(`  Year:  ${filing.calendarYear}`);
  console.log(`  Reason: ${filing.rejectionReason}`);
  console.log(`  Batch: ${filing.sdtmBatchId}`);
  console.log();

  // 2. Archive rejection to rejectionHistory (same logic as /api/filing/resubmit)
  const raw = filing as Record<string, unknown>;
  const existingHistory = Array.isArray(raw.rejectionHistory)
    ? (raw.rejectionHistory as Array<Record<string, unknown>>)
    : [];

  const historyEntry = {
    reason: filing.rejectionReason,
    submittedAt: filing.submittedAt?.toISOString() ?? null,
    acknowledgedAt: filing.acknowledgedAt?.toISOString() ?? null,
    sdtmSubmissionId: filing.sdtmSubmissionId,
    sdtmBatchId: filing.sdtmBatchId,
    bsaId: filing.bsaId,
    archivedAt: new Date().toISOString(),
  };

  const updatedHistory = [...existingHistory, historyEntry];
  console.log(`Archived rejection to rejectionHistory (${updatedHistory.length} total entries)`);

  // 3. Reset to PAID — keep signature data intact (unlike /api/filing/resubmit which clears it)
  //    Set updatedAt to 10 minutes ago so the submit-paid cron picks it up immediately
  //    (cron filters for updatedAt < 5 minutes ago)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  await prisma.filingYear.update({
    where: { id: filing.id },
    data: {
      status: "PAID",
      rejectionReason: null,
      submittedAt: null,
      acknowledgedAt: null,
      sdtmSubmissionId: null,
      sdtmBatchId: null,
      bsaId: null,
      rejectionHistory: updatedHistory as unknown as Prisma.InputJsonValue,
      updatedAt: tenMinAgo,
      // NOTE: signedAt, signatureData, signatureIp, form114aUrl PRESERVED
    } as Prisma.FilingYearUpdateInput,
  });

  console.log(`Reset filing to PAID (signedAt/signatureData preserved)`);
  console.log();

  // 4. Trigger submission via the submit-paid cron endpoint
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET not set — cannot trigger submission automatically.");
    console.log("The filing is now PAID. The next cron run will pick it up,");
    console.log("or you can manually hit: GET /api/cron/submit-paid");
    process.exit(0);
  }

  console.log("Triggering submit-paid cron endpoint...");
  const port = process.env.PORT || "3000";
  const res = await fetch(`http://localhost:${port}/api/cron/submit-paid`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Cron endpoint returned ${res.status}: ${text}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log("Cron response:", JSON.stringify(result, null, 2));

  if (result.results?.length > 0) {
    for (const r of result.results) {
      if (r.outcome === "submitted") {
        console.log(`\n✓ Filing ${r.id} submitted successfully!`);
        console.log("  The poll-submitted cron will detect the FinCEN acknowledgement");
        console.log("  and update status to ACCEPTED with a BSA ID (1-2 business days).");
      } else {
        console.error(`\n✗ Filing ${r.id}: ${r.outcome}`);
      }
    }
  } else {
    console.log("\nNo filings were processed. Check that the filing status is PAID");
    console.log("and updatedAt is older than 5 minutes.");
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
