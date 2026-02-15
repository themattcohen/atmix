import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const filings = await prisma.filingYear.findMany({
      where: { userId },
      include: {
        _count: { select: { payments: true } },
      },
      orderBy: { calendarYear: "desc" },
    });

    // Get account counts
    const filingData = await Promise.all(
      filings.map(async (f) => {
        const accountCount = await prisma.foreignAccount.count({
          where: { userId, calendarYear: f.calendarYear },
        });
        return {
          id: f.id,
          calendarYear: f.calendarYear,
          status: f.status,
          filingType: f.filingType,
          has25PlusAccounts: f.has25PlusAccounts,
          signedAt: f.signedAt?.toISOString() || null,
          form114aUrl: f.form114aUrl,
          stripePaymentId: f.stripePaymentId,
          bsaId: f.bsaId,
          submittedAt: f.submittedAt?.toISOString() || null,
          acknowledgedAt: f.acknowledgedAt?.toISOString() || null,
          rejectionReason: f.rejectionReason,
          accountCount,
        };
      })
    );

    return NextResponse.json({ data: filingData });
  } catch (error) {
    console.error("Filing list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { calendarYear, filingType = "ORIGINAL" } = await req.json();

    if (!calendarYear || calendarYear < 2010 || calendarYear > 2030) {
      return NextResponse.json({ error: "Invalid calendar year" }, { status: 400 });
    }

    const validFilingTypes = ["ORIGINAL", "AMENDED"];
    if (filingType && !validFilingTypes.includes(filingType)) {
      return NextResponse.json({ error: "Invalid filing type" }, { status: 400 });
    }

    // Check for existing filing (allow AMENDED if ORIGINAL exists)
    const existing = await prisma.filingYear.findFirst({
      where: {
        userId: session.user.id,
        calendarYear,
        filingType,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A filing for this year and type already exists", data: { id: existing.id } },
        { status: 409 }
      );
    }

    const filing = await prisma.filingYear.create({
      data: {
        userId: session.user.id,
        calendarYear,
        filingType,
        status: "IN_PROGRESS",
      },
    });

    return NextResponse.json(
      { success: true, data: { id: filing.id, calendarYear: filing.calendarYear } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Filing create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
