import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { importAccountsSchema } from "@/lib/validation";
import { mapAccountToDisplay } from "@/lib/account-mapper";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = importAccountsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { sourceCalendarYear } = parsed.data;

    // Find active filing
    const activeFiling = await prisma.filingYear.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["IN_PROGRESS", "REVIEWED"] },
      },
      orderBy: { calendarYear: "desc" },
    });

    if (!activeFiling) {
      return NextResponse.json({ error: "No active filing found" }, { status: 400 });
    }

    const targetCalendarYear = activeFiling.calendarYear;

    if (sourceCalendarYear >= targetCalendarYear) {
      return NextResponse.json({ error: "Source year must be before target year" }, { status: 400 });
    }

    // Transaction with advisory lock
    const result = await prisma.$transaction(async (tx) => {
      // Advisory lock to prevent concurrent imports
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.id + ':import:' + targetCalendarYear}))`;

      // Check target year doesn't already have accounts
      const existingCount = await tx.foreignAccount.count({
        where: { userId: session.user.id, calendarYear: targetCalendarYear },
      });
      if (existingCount > 0) {
        return { conflict: true };
      }

      // Get source accounts
      const sourceAccounts = await tx.foreignAccount.findMany({
        where: { userId: session.user.id, calendarYear: sourceCalendarYear },
      });

      if (sourceAccounts.length === 0) {
        return { importedCount: 0, accounts: [] as typeof sourceAccounts };
      }

      // Map source → target
      const mappedAccounts = sourceAccounts.map(a => ({
        userId: session.user.id,
        calendarYear: targetCalendarYear,
        institutionName: a.institutionName,
        accountNumber: a.accountNumber, // raw ciphertext copy
        accountType: a.accountType,
        ownershipType: a.ownershipType,
        countryCode: a.countryCode,
        currencyCode: a.currencyCode,
        isJointAccount: a.isJointAccount,
        jointOwnerInfo: a.jointOwnerInfo,
        institutionAddress: a.institutionAddress ?? undefined,
        maxValueLocal: 0,
        maxValueUsd: null,
        exchangeRate: null,
        exchangeRateSource: null,
      }));

      await tx.foreignAccount.createMany({ data: mappedAccounts });

      // Update has25PlusAccounts if needed
      if (sourceAccounts.length >= 25) {
        await tx.filingYear.updateMany({
          where: { userId: session.user.id, calendarYear: targetCalendarYear },
          data: { has25PlusAccounts: true },
        });
      }

      const newAccounts = await tx.foreignAccount.findMany({
        where: { userId: session.user.id, calendarYear: targetCalendarYear },
        orderBy: { createdAt: "asc" },
      });

      return { importedCount: newAccounts.length, accounts: newAccounts };
    });

    // Handle transaction results
    if ('conflict' in result) {
      return NextResponse.json({ error: "Target year already has accounts" }, { status: 409 });
    }

    if (result.importedCount === 0) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        targetCalendarYear,
        data: [],
      });
    }

    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      targetCalendarYear,
      data: result.accounts.map(mapAccountToDisplay),
    }, { status: 201 });
  } catch (error) {
    console.error("Account import error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
