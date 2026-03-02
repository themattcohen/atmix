import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";

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
        await prisma.filingYear.update({
          where: { id: filing.id },
          data: { status: "ACCEPTED", bsaId: ack.bsaId, acknowledgedAt: new Date() },
        });
        if (filing.user.email) {
          sendConfirmationEmail(filing.user.email, {
            firstName: filing.user.firstName ?? "",
            calendarYear: filing.calendarYear,
            bsaId: ack.bsaId,
          }).catch(() => {});
        }
        results.push({ id: filing.id, outcome: "accepted" });
      } else if (ack.status === "rejected") {
        await prisma.filingYear.update({
          where: { id: filing.id },
          data: {
            status: "REJECTED",
            rejectionReason: ack.rejectionReason ?? null,
            acknowledgedAt: new Date(),
          },
        });
        if (filing.user.email) {
          sendRejectionEmail(filing.user.email, {
            firstName: filing.user.firstName ?? "",
            calendarYear: filing.calendarYear,
            reason: ack.rejectionReason ?? "Unknown reason",
          }).catch(() => {});
        }
        results.push({ id: filing.id, outcome: "rejected" });
      } else {
        results.push({ id: filing.id, outcome: "pending" });
      }
    } catch (err) {
      console.error(`[Cron] Failed to check acknowledgement for filing ${filing.id}:`, err);
      results.push({ id: filing.id, outcome: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
