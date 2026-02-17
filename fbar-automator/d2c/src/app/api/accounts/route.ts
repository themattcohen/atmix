import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { foreignAccountSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";
import { mapAccountToDisplay } from "@/lib/account-mapper";
import { Prisma, AccountType, OwnershipType } from "@prisma/client";
import { PriorYearInfo } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const calendarYear = req.nextUrl.searchParams.get("calendarYear");

    const where: Prisma.ForeignAccountWhereInput = { userId: session.user.id };
    if (calendarYear) {
      where.calendarYear = parseInt(calendarYear);
    }

    const accounts = await prisma.foreignAccount.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    let priorYears: PriorYearInfo[] = [];
    if (calendarYear && accounts.length === 0) {
      const grouped = await prisma.foreignAccount.groupBy({
        by: ['calendarYear'],
        where: {
          userId: session.user.id,
          calendarYear: { lt: parseInt(calendarYear) },
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
    console.error("Accounts list error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    } = parsed.data;

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
        isJointAccount,
        jointOwnerInfo: jointOwnerInfo || null,
        calendarYear,
        institutionAddress: institutionAddress ? (institutionAddress as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: mapAccountToDisplay(account),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Account create error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
