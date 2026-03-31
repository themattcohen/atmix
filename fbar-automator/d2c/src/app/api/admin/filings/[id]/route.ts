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
    const filing = await prisma.filingYear.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            stripeSessionId: true,
            stripePaymentIntentId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!filing) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    // ForeignAccount has NO filingYearId — query by userId + calendarYear
    const rawAccounts = await prisma.foreignAccount.findMany({
      where: { userId: filing.userId, calendarYear: filing.calendarYear },
    });

    const accounts = rawAccounts.map((a) => {
      const decrypted = safeDecrypt(a.accountNumber);
      const decryptionFailed = a.accountNumber !== null && a.accountNumber !== "" && decrypted === "";
      const accountNumberLast4 = decrypted ? decrypted.replace(/[\s\-]/g, "").slice(-4) : null;
      return {
        id: a.id,
        institutionName: a.institutionName,
        countryCode: a.countryCode,
        accountType: a.accountType,
        ownershipType: a.ownershipType,
        maxValueUsd: a.maxValueUsd,
        currencyCode: a.currencyCode,
        accountNumberLast4,
        decryptionFailed,
      };
    });

    return NextResponse.json({
      data: {
        filing: {
          id: filing.id,
          calendarYear: filing.calendarYear,
          status: filing.status,
          filingType: filing.filingType,
          tier: filing.tier,
          has25PlusAccounts: filing.has25PlusAccounts,
          signedAt: filing.signedAt,
          signatureIp: filing.signatureIp,
          submittedAt: filing.submittedAt,
          acknowledgedAt: filing.acknowledgedAt,
          bsaId: filing.bsaId,
          rejectionReason: filing.rejectionReason,
          sdtmSubmissionId: filing.sdtmSubmissionId,
          sdtmBatchId: filing.sdtmBatchId,
          stripeSessionId: filing.stripeSessionId,
          createdAt: filing.createdAt,
          updatedAt: filing.updatedAt,
        },
        user: filing.user,
        accounts,
        payments: filing.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      },
    });
  } catch (err) {
    log("error", "admin_filing_detail_error", { error: String(err), filingId: params.id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
