import { prisma } from "@/lib/db";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch } from "@/lib/sdtm";
import { sendSubmissionEmail } from "@/lib/email";
import { log } from "@/lib/logger";
import crypto from "crypto";

export type SubmitFilingResult =
  | { success: true; batchId: string; submittedAt: string; alreadySubmitted?: boolean }
  | { success: false; error: string; conflict?: boolean };

export async function submitFiling(
  filingYearId: string,
  userId: string
): Promise<SubmitFilingResult> {
  const filingYear = await prisma.filingYear.findFirst({
    where: { id: filingYearId, userId },
  });

  if (!filingYear) {
    return { success: false, error: "Filing year not found" };
  }

  // Idempotency: already past submission
  if (["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(filingYear.status)) {
    return {
      success: true,
      batchId: filingYear.sdtmBatchId ?? "",
      submittedAt: filingYear.submittedAt?.toISOString() ?? "",
      alreadySubmitted: true,
    };
  }

  // Atomic PAID → SUBMITTING lock
  const locked = await prisma.filingYear.updateMany({
    where: { id: filingYearId, userId, status: "PAID" },
    data: { status: "SUBMITTING" },
  });

  if (locked.count === 0) {
    const current = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId },
      select: { status: true, sdtmBatchId: true, submittedAt: true },
    });
    if (current && ["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(current.status)) {
      return {
        success: true,
        batchId: current.sdtmBatchId ?? "",
        submittedAt: current.submittedAt?.toISOString() ?? "",
        alreadySubmitted: true,
      };
    }
    return { success: false, error: "Filing is not in a submittable state", conflict: true };
  }

  try {
    const xml = await generateFincenXml(filingYearId);

    if (!xml || xml.length < 100 || !xml.includes("<fc2:EFilingBatchXML")) {
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return { success: false, error: "XML validation failed" };
    }

    const batchId = crypto.randomUUID();
    const result = await submitBatch(xml, batchId);

    if (!result.success) {
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return { success: false, error: result.error ?? "Submission failed" };
    }

    await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId, status: "SUBMITTING" },
      data: {
        status: "SUBMITTED",
        sdtmSubmissionId: result.remoteFilePath,
        sdtmBatchId: batchId,
        submittedAt: new Date(),
      },
    });

    // Non-blocking email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      sendSubmissionEmail(user.email, {
        firstName: user.firstName ?? "",
        calendarYear: filingYear.calendarYear,
      }).catch((err) =>
        log("warn", "fincen_email_send_failed", { error: err instanceof Error ? err.message : String(err) })
      );
    }

    return { success: true, batchId, submittedAt: new Date().toISOString() };
  } catch (err) {
    await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId, status: "SUBMITTING" },
      data: { status: "PAID" },
    }).catch(() => {});
    return { success: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}
