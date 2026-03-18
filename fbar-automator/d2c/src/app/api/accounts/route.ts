import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { foreignAccountSchema, calendarYearSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";
import { mapAccountToDisplay } from "@/lib/account-mapper";
import { getRate } from "@/lib/treasury";
import { Prisma, AccountType, OwnershipType } from "@prisma/client";
import { PriorYearInfo } from "@/types";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const calendarYearParam = req.nextUrl.searchParams.get("calendarYear");

    const where: Prisma.ForeignAccountWhereInput = { userId: session.user.id };
    if (calendarYearParam) {
      const parsed = calendarYearSchema.safeParse(parseInt(calendarYearParam, 10));
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid calendar year (must be 2010-2030)" }, { status: 400 });
      }
      where.calendarYear = parsed.data;
    }

    const accounts = await prisma.foreignAccount.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    let priorYears: PriorYearInfo[] = [];
    if (calendarYearParam && accounts.length === 0) {
      const parsedYear = parseInt(calendarYearParam, 10);
      const grouped = await prisma.foreignAccount.groupBy({
        by: ['calendarYear'],
        where: {
          userId: session.user.id,
          calendarYear: { lt: parsedYear },
        },
        _count: { id: true },
        orderBy: { calendarYear: 'desc' },
      });
      priorYears = grouped.map(g => ({
        calendarYear: g.calendarYear,
        count: g._count.id,
      }));
    }

    const data = accounts.map(mapAccountToDisplay);

    return NextResponse.json({ data, priorYears });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Accounts list error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = apiHandler(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = foreignAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      institutionName,
      accountNumber,
      accountType,
      ownershipType,
      countryCode,
      currencyCode,
      maxValueLocal,
      isJointAccount,
      jointOwnerInfo,
      calendarYear,
      institutionAddress,
      sourceStatementId,
    } = parsed.data;

    // Compute maxValueUsd before create
    let maxValueUsd: number | null = null;
    if (currencyCode.toUpperCase() === "USD" && maxValueLocal) {
      maxValueUsd = maxValueLocal;
    } else if (currencyCode && currencyCode.toUpperCase() !== "USD" && maxValueLocal) {
      const rateResult = await getRate(currencyCode.toUpperCase(), calendarYear);
      maxValueUsd = rateResult ? Number(maxValueLocal) * rateResult.rate : null;
    }

    const account = await prisma.foreignAccount.create({
      data: {
        userId: session.user.id,
        institutionName,
        accountNumber: encrypt(accountNumber),
        accountType: accountType as AccountType,
        ownershipType: ownershipType as OwnershipType,
        countryCode: countryCode.toUpperCase(),
        currencyCode: currencyCode.toUpperCase(),
        maxValueLocal,
        maxValueUsd,
        isJointAccount,
        jointOwnerInfo: jointOwnerInfo || null,
        calendarYear,
        institutionAddress: institutionAddress ? (institutionAddress as unknown as Prisma.InputJsonValue) : undefined,
        sourceStatementId: sourceStatementId || null,
      },
    });

    // Recompute has25PlusAccounts flag after account creation
    const accountCount = await prisma.foreignAccount.count({
      where: { userId: session.user.id, calendarYear },
    });
    await prisma.filingYear.updateMany({
      where: { userId: session.user.id, calendarYear, status: "IN_PROGRESS" },
      data: { has25PlusAccounts: accountCount >= 25 },
    });

    return NextResponse.json(
      {
        success: true,
        data: mapAccountToDisplay(account),
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Account create error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
