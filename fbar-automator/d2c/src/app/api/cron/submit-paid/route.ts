import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitFiling } from "@/lib/fincen-submit";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Revert stale SUBMITTING filings (stuck >10 minutes) back to PAID for retry
  const staleSubmitting = await prisma.filingYear.updateMany({
    where: {
      status: "SUBMITTING",
      updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    data: { status: "PAID" },
  });

  if (staleSubmitting.count > 0) {
    console.log(`[Cron] Reverted ${staleSubmitting.count} stale SUBMITTING filings to PAID`);
  }

  // Find filings stuck in PAID for >5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stuckFilings = await prisma.filingYear.findMany({
    where: {
      status: "PAID",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, userId: true, calendarYear: true },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const filing of stuckFilings) {
    const result = await submitFiling(filing.id, filing.userId);
    results.push({
      id: filing.id,
      outcome: result.success
        ? result.alreadySubmitted
          ? "already_submitted"
          : "submitted"
        : `failed: ${result.error}`,
    });
  }

  return NextResponse.json({
    staleReverted: staleSubmitting.count,
    processed: results.length,
    results,
  });
}
