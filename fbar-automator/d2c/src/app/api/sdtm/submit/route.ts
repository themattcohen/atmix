import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { submitFiling } from "@/lib/fincen-submit";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { filingYearId } = body;
    if (!filingYearId) {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    const result = await submitFiling(filingYearId, session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    Sentry.captureException(error);
    console.error("SDTM submission failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
});
