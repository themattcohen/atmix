import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch } from "@/lib/sdtm";
import { sendSubmissionEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // Track these outside try for status revert in catch
  let filingYearId: string | undefined;
  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    filingYearId = body.filingYearId;

    if (!filingYearId) {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    // Idempotency: if already submitted or beyond, return success without re-submitting
    if (["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(filingYear.status)) {
      return NextResponse.json({
        success: true,
        data: {
          batchId: filingYear.sdtmBatchId,
          alreadySubmitted: true,
          submittedAt: filingYear.submittedAt?.toISOString() || null,
        },
      });
    }

    // Atomic transition: PAID → SUBMITTING (prevents concurrent submissions)
    const locked = await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId: session.user.id, status: "PAID" },
      data: { status: "SUBMITTING" },
    });

    if (locked.count === 0) {
      // Race condition: someone else changed the status between the check above and now
      // Re-check current state
      const current = await prisma.filingYear.findFirst({
        where: { id: filingYearId, userId: session.user.id },
        select: { status: true, sdtmBatchId: true, submittedAt: true },
      });

      if (current && ["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(current.status)) {
        // Another request already started/completed submission — idempotent success
        return NextResponse.json({
          success: true,
          data: {
            batchId: current.sdtmBatchId,
            alreadySubmitted: true,
            submittedAt: current.submittedAt?.toISOString() || null,
          },
        });
      }

      return NextResponse.json(
        { error: "Filing is not in a state that allows submission" },
        { status: 409 }
      );
    }

    // Generate FinCEN XML
    const xml = await generateFincenXml(filingYearId);

    // Validate XML before sending to FinCEN
    if (!xml || xml.length < 100 || !xml.includes("<BSAMessage")) {
      // Revert SUBMITTING -> PAID
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId: session.user.id, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return NextResponse.json(
        { error: "XML validation failed — cannot submit malformed data to FinCEN" },
        { status: 500 }
      );
    }

    // Create batch ID
    const batchId = crypto.randomUUID();

    // Submit via SDTM
    const result = await submitBatch(xml, batchId);

    if (!result.success) {
      // Revert status back to PAID on failure (only from SUBMITTING)
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId: session.user.id, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return NextResponse.json(
        { error: "Submission failed", details: result.error },
        { status: 500 }
      );
    }

    // Atomic transition: SUBMITTING → SUBMITTED with submission details
    await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId: session.user.id, status: "SUBMITTING" },
      data: {
        status: "SUBMITTED",
        sdtmSubmissionId: result.remoteFilePath,
        sdtmBatchId: batchId,
        submittedAt: new Date(),
      },
    });

    // Send submission confirmation email
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.email) {
      try {
        await sendSubmissionEmail(user.email, {
          firstName: user.firstName || "",
          calendarYear: filingYear.calendarYear,
        });
      } catch (emailError) {
        console.error("Failed to send submission email:", emailError instanceof Error ? emailError.message : "Unknown error");
        // Don't block the submission on email failure
      }
    }

    return NextResponse.json({
      success: true,
      data: { batchId, submittedAt: new Date().toISOString() },
    });
  } catch (error) {
    // Revert SUBMITTING -> PAID to prevent stuck filings
    if (filingYearId && userId) {
      try {
        await prisma.filingYear.updateMany({
          where: { id: filingYearId, userId, status: "SUBMITTING" },
          data: { status: "PAID" },
        });
      } catch (revertError) {
        console.error("Failed to revert filing status:", revertError instanceof Error ? revertError.message : "Unknown error");
      }
    }
    console.error("SDTM submission failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
