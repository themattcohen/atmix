import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { foreignAccountSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";
import { mapAccountToDisplay } from "@/lib/account-mapper";
import { getRate } from "@/lib/treasury";
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
        ...mapAccountToDisplay(account),
        institutionAddress: account.institutionAddress,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
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
    if (d.institutionAddress !== undefined) updateData.institutionAddress = (d.institutionAddress || null) as any;

    const { count } = await prisma.foreignAccount.updateMany({
      where: { id: params.accountId, userId: session.user.id },
      data: updateData,
    });

    if (count === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Re-fetch for response since updateMany doesn't return the record
    const account = await prisma.foreignAccount.findUnique({
      where: { id: params.accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Recompute maxValueUsd if relevant fields changed
    if (d.currencyCode !== undefined || d.maxValueLocal !== undefined) {
      const updated = await prisma.foreignAccount.findUnique({ where: { id: params.accountId } });
      if (updated && updated.currencyCode && updated.maxValueLocal) {
        if (updated.currencyCode === "USD") {
          await prisma.foreignAccount.update({
            where: { id: updated.id },
            data: { maxValueUsd: updated.maxValueLocal },
          });
        } else {
          const rateResult = await getRate(updated.currencyCode, updated.calendarYear);
          await prisma.foreignAccount.update({
            where: { id: updated.id },
            data: { maxValueUsd: rateResult ? Number(updated.maxValueLocal) * rateResult.rate : null },
          });
        }
      }
    }

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
    Sentry.captureException(error);
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

    const { calendarYear } = existing;

    const { count: deleteCount } = await prisma.foreignAccount.deleteMany({
      where: { id: params.accountId, userId: session.user.id },
    });

    if (deleteCount === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Recompute has25PlusAccounts flag after account deletion
    const accountCount = await prisma.foreignAccount.count({
      where: { userId: session.user.id, calendarYear },
    });
    await prisma.filingYear.updateMany({
      where: { userId: session.user.id, calendarYear, status: "IN_PROGRESS" },
      data: { has25PlusAccounts: accountCount >= 25 },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Account delete error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
