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
      rawExtraction: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Backfill old data: if extractedAccounts entries lack statementPeriod/maxBalanceDetail,
  // pull them from rawExtraction.accounts
  for (const stmt of statements) {
    const extracted = stmt.extractedAccounts as any[];
    const raw = stmt.rawExtraction as any;
    if (!Array.isArray(extracted) || !raw?.accounts) continue;

    let patched = false;
    for (let i = 0; i < extracted.length; i++) {
      const rawAccount = raw.accounts[i];
      if (!rawAccount) continue;

      if (!extracted[i].statementPeriod && rawAccount.statement_period) {
        extracted[i].statementPeriod = {
          startDate: rawAccount.statement_period.start_date,
          endDate: rawAccount.statement_period.end_date,
        };
        patched = true;
      }
      if (!extracted[i].maxBalanceDetail && rawAccount.max_balance) {
        extracted[i].maxBalanceDetail = {
          amount: rawAccount.max_balance.amount,
          date: rawAccount.max_balance.date,
          label: rawAccount.max_balance.label,
        };
        patched = true;
      }
    }

    if (patched) {
      stmt.extractedAccounts = extracted;
    }

    // Strip rawExtraction from response — don't send to client
    (stmt as any).rawExtraction = undefined;
  }

  // Remove rawExtraction from serialized output
  const data = statements.map(({ rawExtraction: _, ...rest }) => rest);

  return NextResponse.json({ data });
});
