import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filingYearId = req.nextUrl.searchParams.get("filingYearId");
  if (!filingYearId) {
    return NextResponse.json(
      { error: "filingYearId is required" },
      { status: 400 }
    );
  }

  // Verify filing year belongs to user
  const filingYear = await prisma.filingYear.findFirst({
    where: { id: filingYearId, userId: session.user.id },
    select: { id: true },
  });

  if (!filingYear) {
    return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
  }

  const statements = await prisma.statement.findMany({
    where: {
      filingYearId,
      userId: session.user.id,
      extractionStatus: "COMPLETED",
    },
    select: {
      id: true,
      fileName: true,
      fileSizeBytes: true,
      extractedAccounts: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: statements });
});
