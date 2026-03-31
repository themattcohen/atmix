import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { submitFiling } from "@/lib/fincen-submit";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Bearer token auth against ADMIN_SECRET
    const authHeader = req.headers.get("authorization") ?? "";
    const expectedToken = process.env.ADMIN_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filingYearId } = body;

    if (!filingYearId || typeof filingYearId !== "string") {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    // Find filing (no user filter — admin can access any filing)
    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId },
      include: { user: true },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    if (filingYear.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Only rejected filings can be resubmitted" },
        { status: 400 }
      );
    }

    // Archive current rejection data into rejectionHistory
    const raw = filingYear as Record<string, unknown>;
    const existingHistory = Array.isArray(raw.rejectionHistory)
      ? (raw.rejectionHistory as Array<Record<string, unknown>>)
      : [];

    const historyEntry = {
      reason: filingYear.rejectionReason,
      submittedAt: filingYear.submittedAt?.toISOString() ?? null,
      acknowledgedAt: filingYear.acknowledgedAt?.toISOString() ?? null,
      sdtmSubmissionId: filingYear.sdtmSubmissionId,
      sdtmBatchId: filingYear.sdtmBatchId,
      bsaId: filingYear.bsaId,
      archivedAt: new Date().toISOString(),
    };

    // Reset to PAID, preserving signature data so user does not need to re-sign.
    // Set updatedAt to 10 minutes ago so the submit-paid cron picks it up immediately.
    await prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "PAID",
        rejectionHistory: [...existingHistory, historyEntry] as unknown as Prisma.InputJsonValue,
        rejectionReason: null,
        submittedAt: null,
        acknowledgedAt: null,
        sdtmSubmissionId: null,
        sdtmBatchId: null,
        bsaId: null,
        // PRESERVE: signedAt, signatureData, signatureIp, form114aUrl
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      } as Prisma.FilingYearUpdateInput,
    });

    log("info", "admin_resubmit_reset", {
      filingYearId,
      userId: filingYear.userId,
      previousRejection: filingYear.rejectionReason,
    });

    // Submit immediately
    const result = await submitFiling(filingYear.id, filingYear.userId);

    if (result.success) {
      log("info", "admin_resubmit_submitted", {
        filingYearId,
        batchId: result.batchId,
      });
      return NextResponse.json({ success: true, batchId: result.batchId });
    } else {
      log("error", "admin_resubmit_submit_failed", {
        filingYearId,
        error: result.error,
      });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    Sentry.captureException(error);
    log("error", "admin_resubmit_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
