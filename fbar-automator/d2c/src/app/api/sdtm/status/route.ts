import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail, sendAdminAckNotification } from "@/lib/email";

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
        where: { id: filingYearId, userId: session.user.id, status: "SUBMITTED" },
        data: {
          status: "ACCEPTED",
          bsaId: ack.bsaId,
          acknowledgedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        // Already processed by cron — return current status instead of 404
        const current = await prisma.filingYear.findFirst({
          where: { id: filingYearId, userId: session.user.id },
        });
        console.log(`[Status] Filing ${filingYearId} already processed (status: ${current?.status}), skipping emails`);
        return NextResponse.json({
          data: {
            status: current?.status?.toLowerCase() ?? ack.status,
            bsaId: current?.bsaId ?? ack.bsaId,
            rejectionReason: current?.rejectionReason,
            submittedAt: current?.submittedAt?.toISOString(),
            acknowledgedAt: current?.acknowledgedAt?.toISOString(),
          },
        });
      }

      // Send confirmation email on acceptance
      if (user?.email) {
        try {
          await sendConfirmationEmail(user.email, {
            firstName: user.firstName || "",
            calendarYear: filingYear.calendarYear,
            bsaId: ack.bsaId,
          });
          console.log(`[Status] Confirmation email queued for ${user.email}, filing ${filingYearId}`);
        } catch (emailError) {
          Sentry.captureException(emailError, { extra: { context: "sdtm_confirmation_email", filingYearId } });
          console.error("[Status] Confirmation email failed:", emailError instanceof Error ? emailError.message : "Unknown error");
        }
      }

      // Send admin notification on acceptance
      sendAdminAckNotification({
        filingId: filingYearId,
        userEmail: user?.email ?? "",
        calendarYear: filingYear.calendarYear,
        status: "accepted",
        bsaId: ack.bsaId,
      }).then(() => {
        console.log(`[Status] Admin accepted notification queued for filing ${filingYearId}`);
      }).catch((err) => {
        Sentry.captureException(err, { extra: { filingId: filingYearId, context: "status_admin_accepted_notification" } });
        console.error("[Status] Admin accepted notification failed:", err);
      });
    } else if (ack.status === "rejected") {
      const updateResult = await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId: session.user.id, status: "SUBMITTED" },
        data: {
          status: "REJECTED",
          rejectionReason: ack.rejectionReason,
          acknowledgedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        // Already processed by cron — return current status instead of 404
        const current = await prisma.filingYear.findFirst({
          where: { id: filingYearId, userId: session.user.id },
        });
        console.log(`[Status] Filing ${filingYearId} already processed (status: ${current?.status}), skipping emails`);
        return NextResponse.json({
          data: {
            status: current?.status?.toLowerCase() ?? ack.status,
            bsaId: current?.bsaId,
            rejectionReason: current?.rejectionReason ?? ack.rejectionReason,
            submittedAt: current?.submittedAt?.toISOString(),
            acknowledgedAt: current?.acknowledgedAt?.toISOString(),
          },
        });
      }

      // Send rejection email on rejection
      if (user?.email) {
        try {
          await sendRejectionEmail(user.email, {
            firstName: user.firstName || "",
            calendarYear: filingYear.calendarYear,
            reason: ack.rejectionReason || "Unknown reason",
          });
          console.log(`[Status] Rejection email queued for ${user.email}, filing ${filingYearId}`);
        } catch (emailError) {
          Sentry.captureException(emailError, { extra: { context: "sdtm_rejection_email", filingYearId } });
          console.error("[Status] Rejection email failed:", emailError instanceof Error ? emailError.message : "Unknown error");
        }
      }

      // Send admin notification on rejection
      sendAdminAckNotification({
        filingId: filingYearId,
        userEmail: user?.email ?? "",
        calendarYear: filingYear.calendarYear,
        status: "rejected",
        rejectionReason: ack.rejectionReason ?? undefined,
      }).then(() => {
        console.log(`[Status] Admin rejected notification queued for filing ${filingYearId}`);
      }).catch((err) => {
        Sentry.captureException(err, { extra: { filingId: filingYearId, context: "status_admin_rejected_notification" } });
        console.error("[Status] Admin rejected notification failed:", err);
      });
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
