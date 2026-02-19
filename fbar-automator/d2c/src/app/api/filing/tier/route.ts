import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
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
    const { filingYearId, tier } = body;

    if (!filingYearId || !tier) {
      return NextResponse.json({ error: "filingYearId and tier are required" }, { status: 400 });
    }

    if (!["BASIC", "PREMIUM"].includes(tier)) {
      return NextResponse.json({ error: "tier must be BASIC or PREMIUM" }, { status: 400 });
    }

    // Use updateMany with userId for defense-in-depth
    const result = await prisma.filingYear.updateMany({
      where: {
        id: filingYearId,
        userId: session.user.id,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      data: { tier },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Filing year not found or cannot be modified" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tier update error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
