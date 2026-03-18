import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail, sendAdminAckNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submittedFilings = await prisma.filingYear.findMany({
    where: { status: "SUBMITTED", sdtmBatchId: { not: null } },
    include: { user: { select: { email: true, firstName: true } } },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const filing of submittedFilings) {
    if (!filing.sdtmBatchId) continue;

    try {
      const submissionId = filing.sdtmSubmissionId ?? filing.sdtmBatchId;
      const ack = await checkAcknowledgement(submissionId);

      if (ack.status === "accepted" && ack.bsaId) {
        const updateResult = await prisma.filingYear.updateMany({
          where: { id: filing.id, status: "SUBMITTED" },
          data: { status: "ACCEPTED", bsaId: ack.bsaId, acknowledgedAt: new Date() },
        });
        if (updateResult.count === 0) {
          console.log(`[Cron] Filing ${filing.id} already processed, skipping emails`);
          results.push({ id: filing.id, outcome: "already_processed" });
          continue;
        }
        if (filing.user.email) {
          sendConfirmationEmail(filing.user.email, {
            firstName: filing.user.firstName ?? "",
            calendarYear: filing.calendarYear,
            bsaId: ack.bsaId,
          }).then(() => {
            console.log(`[Cron] Confirmation email queued for ${filing.user.email}, filing ${filing.id}`);
          }).catch((err) => {
            Sentry.captureException(err, { extra: { filingId: filing.id, context: "cron_confirmation_email" } });
            console.error("[Cron] Confirmation email failed for filing:", err);
          });
        }
        sendAdminAckNotification({
          filingId: filing.id,
          userEmail: filing.user.email ?? "",
          calendarYear: filing.calendarYear,
          status: "accepted",
          bsaId: ack.bsaId,
        }).then(() => {
          console.log(`[Cron] Admin accepted notification queued for filing ${filing.id}`);
        }).catch((err) => {
          Sentry.captureException(err, { extra: { filingId: filing.id, context: "cron_admin_accepted_notification" } });
          console.error("[Cron] Admin accepted notification failed:", err);
        });
        results.push({ id: filing.id, outcome: "accepted" });
      } else if (ack.status === "rejected") {
        const updateResult = await prisma.filingYear.updateMany({
          where: { id: filing.id, status: "SUBMITTED" },
          data: {
            status: "REJECTED",
            rejectionReason: ack.rejectionReason ?? null,
            acknowledgedAt: new Date(),
          },
        });
        if (updateResult.count === 0) {
          console.log(`[Cron] Filing ${filing.id} already processed, skipping emails`);
          results.push({ id: filing.id, outcome: "already_processed" });
          continue;
        }
        if (filing.user.email) {
          sendRejectionEmail(filing.user.email, {
            firstName: filing.user.firstName ?? "",
            calendarYear: filing.calendarYear,
            reason: ack.rejectionReason ?? "Unknown reason",
          }).then(() => {
            console.log(`[Cron] Rejection email queued for ${filing.user.email}, filing ${filing.id}`);
          }).catch((err) => {
            Sentry.captureException(err, { extra: { filingId: filing.id, context: "cron_rejection_email" } });
            console.error("[Cron] Rejection email failed for filing:", err);
          });
        }
        sendAdminAckNotification({
          filingId: filing.id,
          userEmail: filing.user.email ?? "",
          calendarYear: filing.calendarYear,
          status: "rejected",
          rejectionReason: ack.rejectionReason ?? undefined,
        }).then(() => {
          console.log(`[Cron] Admin rejected notification queued for filing ${filing.id}`);
        }).catch((err) => {
          Sentry.captureException(err, { extra: { filingId: filing.id, context: "cron_admin_rejected_notification" } });
          console.error("[Cron] Admin rejected notification failed:", err);
        });
        results.push({ id: filing.id, outcome: "rejected" });
      } else {
        results.push({ id: filing.id, outcome: "pending" });
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error(`[Cron] Failed to check acknowledgement for filing ${filing.id}:`, err);
      results.push({ id: filing.id, outcome: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
