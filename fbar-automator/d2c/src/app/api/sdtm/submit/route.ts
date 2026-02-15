import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch } from "@/lib/sdtm";
import { sendSubmissionEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filingYearId } = await req.json();

    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    // Generate FinCEN XML
    const xml = await generateFincenXml(filingYearId);

    // Create batch ID
    const batchId = crypto.randomUUID();

    // Submit via SDTM
    const result = await submitBatch(xml, batchId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Submission failed", details: result.error },
        { status: 500 }
      );
    }

    // Update filing year atomically to prevent double-submission
    const updated = await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId: session.user.id, status: "PAID" },
      data: {
        status: "SUBMITTED",
        sdtmSubmissionId: result.remoteFilePath,
        sdtmBatchId: batchId,
        submittedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Filing is not in a state that allows submission" },
        { status: 409 }
      );
    }

    // Send submission confirmation email
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.email) {
      try {
        await sendSubmissionEmail(user.email, {
          firstName: user.firstName || "",
          calendarYear: filingYear.calendarYear,
        });
      } catch (emailError) {
        console.error("Failed to send submission email:", emailError);
        // Don't block the submission on email failure
      }
    }

    return NextResponse.json({
      success: true,
      data: { batchId, submittedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("SDTM submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
