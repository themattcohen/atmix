import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { foreignAccountSchema } from "@/lib/validation";
import { encrypt, safeDecrypt } from "@/lib/encryption";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.foreignAccount.findFirst({
      where: { id: params.accountId, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: account.id,
        institutionName: account.institutionName,
        accountNumberLast4: safeDecrypt(account.accountNumber).slice(-4) || "****",
        accountType: account.accountType,
        ownershipType: account.ownershipType,
        countryCode: account.countryCode,
        currencyCode: account.currencyCode,
        maxValueLocal: Number(account.maxValueLocal),
        maxValueUsd: account.maxValueUsd ? Number(account.maxValueUsd) : null,
        exchangeRate: account.exchangeRate ? Number(account.exchangeRate) : null,
        isJointAccount: account.isJointAccount,
        jointOwnerInfo: account.jointOwnerInfo,
        calendarYear: account.calendarYear,
        institutionAddress: account.institutionAddress,
      },
    });
  } catch (error) {
    console.error("Account get error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.foreignAccount.findFirst({
      where: { id: params.accountId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = foreignAccountSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const d = parsed.data;

    if (d.institutionName !== undefined) updateData.institutionName = d.institutionName;
    if (d.accountNumber !== undefined) updateData.accountNumber = encrypt(d.accountNumber);
    if (d.accountType !== undefined) updateData.accountType = d.accountType;
    if (d.ownershipType !== undefined) updateData.ownershipType = d.ownershipType;
    if (d.countryCode !== undefined) updateData.countryCode = d.countryCode.toUpperCase();
    if (d.currencyCode !== undefined) updateData.currencyCode = d.currencyCode.toUpperCase();
    if (d.maxValueLocal !== undefined) updateData.maxValueLocal = d.maxValueLocal;
    if (d.isJointAccount !== undefined) updateData.isJointAccount = d.isJointAccount;
    if (d.jointOwnerInfo !== undefined) updateData.jointOwnerInfo = d.jointOwnerInfo || null;
    if (d.institutionAddress !== undefined) updateData.institutionAddress = d.institutionAddress as unknown as Prisma.InputJsonValue;

    const account = await prisma.foreignAccount.update({
      where: { id: params.accountId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        institutionName: account.institutionName,
        accountType: account.accountType,
        countryCode: account.countryCode,
        maxValueLocal: Number(account.maxValueLocal),
      },
    });
  } catch (error) {
    console.error("Account update error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.foreignAccount.findFirst({
      where: { id: params.accountId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await prisma.foreignAccount.delete({ where: { id: params.accountId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account delete error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
