import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedUrl } from "@/lib/s3";
import type { ExtractionResult } from "@/types/extraction";
import type { AccountProvenance, ProvenanceBalance } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.foreignAccount.findUnique({
      where: { id: params.accountId },
      select: { userId: true, sourceStatementId: true },
    });

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!account.sourceStatementId) {
      const noProvenance: AccountProvenance = {
        hasProvenance: false,
        confidence: null,
        balances: [],
        maxExplanation: null,
        source: null,
        warnings: [],
      };
      return NextResponse.json(noProvenance);
    }

    const statement = await prisma.statement.findUnique({
      where: { id: account.sourceStatementId },
      select: {
        fileName: true,
        filePath: true,
        rawExtraction: true,
        extractedAccounts: true,
      },
    });

    if (!statement) {
      const noProvenance: AccountProvenance = {
        hasProvenance: false,
        confidence: null,
        balances: [],
        maxExplanation: null,
        source: null,
        warnings: [],
      };
      return NextResponse.json(noProvenance);
    }

    const rawExtraction = statement.rawExtraction as unknown as ExtractionResult | null;
    if (!rawExtraction?.accounts?.length) {
      const noProvenance: AccountProvenance = {
        hasProvenance: false,
        confidence: null,
        balances: [],
        maxExplanation: null,
        source: null,
        warnings: [],
      };
      return NextResponse.json(noProvenance);
    }

    // Find matching account in extractedAccounts by sourceIndex
    const extractedAccounts = statement.extractedAccounts as unknown as Array<{
      sourceIndex: number;
    }> | null;

    let matchedIndex = 0;
    if (extractedAccounts?.length) {
      matchedIndex = extractedAccounts[0]?.sourceIndex ?? 0;
    }

    const rawAccount = rawExtraction.accounts[matchedIndex] ?? rawExtraction.accounts[0];
    if (!rawAccount) {
      const noProvenance: AccountProvenance = {
        hasProvenance: false,
        confidence: null,
        balances: [],
        maxExplanation: null,
        source: null,
        warnings: [],
      };
      return NextResponse.json(noProvenance);
    }

    // Build balance history
    const balances: ProvenanceBalance[] = (rawAccount.balances ?? []).map((b) => ({
      date: b.date,
      amount: b.amount,
      label: b.label,
      isMaximum: b.is_maximum,
    }));

    // Build max explanation
    let maxExplanation: string | null = null;
    if (rawAccount.max_balance) {
      const dateStr = rawAccount.max_balance.date
        ? ` on ${rawAccount.max_balance.date}`
        : "";
      maxExplanation = `Maximum value of ${rawAccount.max_balance.amount.toLocaleString()} (${rawAccount.max_balance.label})${dateStr}`;
    }

    // Generate presigned URL for viewing the source statement
    let viewUrl = "";
    try {
      viewUrl = await getPresignedUrl(statement.filePath, 300);
    } catch {
      // Non-critical — omit link if S3 is unavailable
    }

    const provenance: AccountProvenance = {
      hasProvenance: true,
      confidence: rawAccount.confidence ?? null,
      balances,
      maxExplanation,
      source: {
        fileName: statement.fileName,
        periodStart: rawAccount.statement_period?.start_date ?? null,
        periodEnd: rawAccount.statement_period?.end_date ?? null,
        viewUrl,
      },
      warnings: rawAccount.warnings ?? [],
    };

    return NextResponse.json(provenance);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Provenance error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
