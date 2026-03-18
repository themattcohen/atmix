import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { safeDecrypt } from "@/lib/encryption";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        tin: true,
        tinType: true,
        dateOfBirth: true,
        phone: true,
        usAddress: true,
        createdAt: true,
        emailVerified: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        role: true,
        filingYears: {
          select: {
            id: true,
            calendarYear: true,
            status: true,
            filingType: true,
            tier: true,
            createdAt: true,
            updatedAt: true,
            signedAt: true,
            submittedAt: true,
            acknowledgedAt: true,
            bsaId: true,
            rejectionReason: true,
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                stripeSessionId: true,
                stripePaymentIntentId: true,
                createdAt: true,
              },
            },
          },
          orderBy: { calendarYear: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // TIN handling: decrypt and expose only last 4
    const rawTin = safeDecrypt(user.tin);
    const tinLast4 = rawTin ? rawTin.slice(-4) : null;
    const tinDecryptionFailed = !!(user.tin && !rawTin);

    // Get foreign account counts per calendar year
    const accountCounts = await prisma.foreignAccount.groupBy({
      by: ["calendarYear"],
      where: { userId: params.id },
      _count: { id: true },
    });

    const accountCountMap: Record<number, number> = {};
    for (const row of accountCounts) {
      accountCountMap[row.calendarYear] = row._count.id;
    }

    // Build response — strip raw tin
    const { tin: _tin, ...userWithoutTin } = user;

    return NextResponse.json({
      ...userWithoutTin,
      tinLast4,
      tinDecryptionFailed,
      filingYears: user.filingYears.map((fy) => ({
        ...fy,
        accountCount: accountCountMap[fy.calendarYear] || 0,
      })),
    });
  } catch (err) {
    log("error", "admin_user_detail_error", {
      userId: params.id,
      error: String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const adminId = (session.user as any).id;

  // Cannot delete self
  if (adminId === params.id) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  try {
    // Check for in-flight filings
    const inFlightCount = await prisma.filingYear.count({
      where: {
        userId: params.id,
        status: { in: ["SUBMITTING", "SUBMITTED"] },
      },
    });

    if (inFlightCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete user with in-flight FinCEN filings" },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id: params.id } });

    log("warn", "admin_user_deleted", {
      userId: params.id,
      adminId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // User not found
    if ((err as any)?.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    log("error", "admin_user_delete_error", {
      userId: params.id,
      error: String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
