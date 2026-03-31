import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filingYearId } = body;

    if (!filingYearId || typeof filingYearId !== "string") {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    // Verify filing belongs to user and is REJECTED
    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
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

    // Reset filing to IN_PROGRESS, preserving payment fields
    // rejectionHistory is a new JSONB column — cast data to bypass Prisma type lag
    await prisma.filingYear.update({
      where: { id: filingYearId },
      data: {
        status: "IN_PROGRESS",
        rejectionHistory: [...existingHistory, historyEntry] as unknown as Prisma.InputJsonValue,
        rejectionReason: null,
        submittedAt: null,
        acknowledgedAt: null,
        sdtmSubmissionId: null,
        sdtmBatchId: null,
        bsaId: null,
        signedAt: null,
        signatureData: Prisma.DbNull,
        signatureIp: null,
        form114aUrl: null,
      } as Prisma.FilingYearUpdateInput,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Resubmit error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
