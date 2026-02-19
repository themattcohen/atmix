import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
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

    // Verify filing belongs to user and is in correct state
    const filing = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filing) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    if (filing.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: `Filing is in ${filing.status} state, expected IN_PROGRESS` },
        { status: 400 }
      );
    }

    // Verify at least 1 account exists
    const accountCount = await prisma.foreignAccount.count({
      where: { userId: session.user.id, calendarYear: filing.calendarYear },
    });

    if (accountCount === 0) {
      return NextResponse.json(
        { error: "At least one foreign account is required" },
        { status: 400 }
      );
    }

    // Transition IN_PROGRESS -> REVIEWED
    const updated = await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId: session.user.id, status: "IN_PROGRESS" },
      data: { status: "REVIEWED" },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Failed to update filing status" }, { status: 409 });
    }

    return NextResponse.json({ success: true, status: "REVIEWED" });
  } catch (error) {
    console.error("Review confirmation error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
