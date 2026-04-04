import { prisma } from "@/lib/db";
import { generateFincenXml, validateFincenXml } from "@/lib/fincen-xml";
import { validateFilingData } from "@/lib/filing-validator";
import { submitBatch } from "@/lib/sdtm";
import { sendSubmissionEmail } from "@/lib/email";
import { log } from "@/lib/logger";
import { validateXmlAgainstXsd } from "@/lib/xsd-validator";
import crypto from "crypto";

export type SubmitFilingResult =
  | { success: true; batchId: string; submittedAt: string; alreadySubmitted?: boolean }
  | { success: false; error: string; conflict?: boolean; validationErrors?: string[] };

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
    // Pre-submission data validation
    const filingData = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId },
      include: { user: true },
    });
    const filingAccounts = await prisma.foreignAccount.findMany({
      where: { userId, calendarYear: filingData!.calendarYear },
    });

    const dataErrors = validateFilingData(filingData!.user, filingAccounts);
    if (dataErrors.length > 0) {
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return {
        success: false,
        error: "Filing data validation failed: " + dataErrors.map(e => e.message).join("; "),
        validationErrors: dataErrors.map(e => e.message),
      };
    }

    const xml = await generateFincenXml(filingYearId);

    if (!xml || xml.length < 100 || !xml.includes("<fc2:EFilingBatchXML")) {
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return { success: false, error: "XML generation failed" };
    }

    // Structural XML validation
    const xmlValidation = validateFincenXml(xml);
    if (!xmlValidation.isValid) {
      log("error", "fincen_xml_validation_failed", { filingYearId, errors: xmlValidation.errors });
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return {
        success: false,
        error: "XML validation failed: " + xmlValidation.errors.join("; "),
        validationErrors: xmlValidation.errors,
      };
    }

    // XSD schema validation (non-fatal — external schema imports may fail in Docker)
    const xsdResult = validateXmlAgainstXsd(xml);
    if (!xsdResult.isValid) {
      log("warn", "fincen_xsd_validation_warnings", {
        filingYearId,
        errors: xsdResult.errors.map(e => e.message),
      });
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
