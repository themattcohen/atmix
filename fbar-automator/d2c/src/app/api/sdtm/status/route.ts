import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filingYearId = req.nextUrl.searchParams.get("filingYearId");
    if (!filingYearId) {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    // If already finalized, return current status
    if (filingYear.status === "ACCEPTED" || filingYear.status === "REJECTED") {
      return NextResponse.json({
        data: {
          status: filingYear.status.toLowerCase(),
          bsaId: filingYear.bsaId,
          rejectionReason: filingYear.rejectionReason,
          submittedAt: filingYear.submittedAt?.toISOString(),
          acknowledgedAt: filingYear.acknowledgedAt?.toISOString(),
        },
      });
    }

    if (!filingYear.sdtmBatchId) {
      return NextResponse.json({ data: { status: "pending" } });
    }

    // Check for acknowledgement — prefer submission path for filename-based matching
    const submissionId = filingYear.sdtmSubmissionId ?? filingYear.sdtmBatchId;
    const ack = await checkAcknowledgement(submissionId);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });

    if (ack.status === "accepted" && ack.bsaId) {
      const updateResult = await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId: session.user.id },
        data: {
          status: "ACCEPTED",
          bsaId: ack.bsaId,
          acknowledgedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return NextResponse.json({ error: "Filing year not found or access denied" }, { status: 404 });
      }

      // Send confirmation email on acceptance
      if (user?.email) {
        try {
          await sendConfirmationEmail(user.email, {
            firstName: user.firstName || "",
            calendarYear: filingYear.calendarYear,
            bsaId: ack.bsaId,
          });
        } catch (emailError) {
          Sentry.captureException(emailError, { extra: { context: "sdtm_confirmation_email", filingYearId } });
          console.error("Failed to send confirmation email:", emailError instanceof Error ? emailError.message : "Unknown error");
        }
      }
    } else if (ack.status === "rejected") {
      const updateResult = await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId: session.user.id },
        data: {
          status: "REJECTED",
          rejectionReason: ack.rejectionReason,
          acknowledgedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return NextResponse.json({ error: "Filing year not found or access denied" }, { status: 404 });
      }

      // Send rejection email on rejection
      if (user?.email) {
        try {
          await sendRejectionEmail(user.email, {
            firstName: user.firstName || "",
            calendarYear: filingYear.calendarYear,
            reason: ack.rejectionReason || "Unknown reason",
          });
        } catch (emailError) {
          Sentry.captureException(emailError, { extra: { context: "sdtm_rejection_email", filingYearId } });
          console.error("Failed to send rejection email:", emailError instanceof Error ? emailError.message : "Unknown error");
        }
      }
    }

    return NextResponse.json({
      data: {
        status: ack.status,
        bsaId: ack.bsaId,
        rejectionReason: ack.rejectionReason,
        submittedAt: filingYear.submittedAt?.toISOString(),
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("SDTM status error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
