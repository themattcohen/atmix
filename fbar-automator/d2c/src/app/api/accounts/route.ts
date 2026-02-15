import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { foreignAccountSchema } from "@/lib/validation";
import { encrypt, safeDecrypt } from "@/lib/encryption";
import { Prisma, AccountType, OwnershipType } from "@prisma/client";

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

    const data = accounts.map((a) => ({
      id: a.id,
      institutionName: a.institutionName,
      accountNumberLast4: safeDecrypt(a.accountNumber).slice(-4) || "****",
      accountType: a.accountType,
      ownershipType: a.ownershipType,
      countryCode: a.countryCode,
      currencyCode: a.currencyCode,
      maxValueLocal: Number(a.maxValueLocal),
      maxValueUsd: a.maxValueUsd ? Number(a.maxValueUsd) : null,
      exchangeRate: a.exchangeRate ? Number(a.exchangeRate) : null,
      isJointAccount: a.isJointAccount,
      jointOwnerInfo: a.jointOwnerInfo,
      calendarYear: a.calendarYear,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Accounts list error:", error);
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
        data: {
          id: account.id,
          institutionName: account.institutionName,
          accountNumberLast4: accountNumber.slice(-4),
          accountType: account.accountType,
          ownershipType: account.ownershipType,
          countryCode: account.countryCode,
          currencyCode: account.currencyCode,
          maxValueLocal: Number(account.maxValueLocal),
          calendarYear: account.calendarYear,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Account create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
