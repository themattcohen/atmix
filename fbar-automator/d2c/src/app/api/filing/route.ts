import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FilingType } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [filings, accountCounts] = await Promise.all([
      prisma.filingYear.findMany({
        where: { userId },
        include: {
          _count: { select: { payments: true } },
        },
        orderBy: { calendarYear: "desc" },
      }),
      prisma.foreignAccount.groupBy({
        by: ['calendarYear'],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    const countMap = new Map(accountCounts.map(c => [c.calendarYear, c._count.id]));

    const filingData = filings.map((f) => ({
      id: f.id,
      calendarYear: f.calendarYear,
      status: f.status,
      filingType: f.filingType,
      has25PlusAccounts: f.has25PlusAccounts,
      tier: f.tier,
      signedAt: f.signedAt?.toISOString() || null,
      form114aUrl: f.form114aUrl,
      stripePaymentId: f.stripePaymentId,
      bsaId: f.bsaId,
      submittedAt: f.submittedAt?.toISOString() || null,
      acknowledgedAt: f.acknowledgedAt?.toISOString() || null,
      rejectionReason: f.rejectionReason,
      accountCount: countMap.get(f.calendarYear) ?? 0,
    }));

    return NextResponse.json({ data: filingData });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Filing list error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let calendarYear: unknown;
    let filingType: FilingType = FilingType.ORIGINAL;
    try {
      const body = await req.json();
      calendarYear = body.calendarYear;
      const rawType = body.filingType ?? "ORIGINAL";
      if (!Object.values(FilingType).includes(rawType)) {
        return NextResponse.json({ error: "Invalid filing type" }, { status: 400 });
      }
      filingType = rawType as FilingType;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Verify user still exists in DB (prevents FK violation from ghost sessions)
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    if (typeof calendarYear !== "number" || !Number.isInteger(calendarYear) || calendarYear < 2010 || calendarYear > 2030) {
      return NextResponse.json({ error: "Invalid calendar year" }, { status: 400 });
    }

    const validFilingTypes = ["ORIGINAL", "AMENDED"];
    if (filingType && !validFilingTypes.includes(filingType)) {
      return NextResponse.json({ error: "Invalid filing type" }, { status: 400 });
    }

    // AMENDED filings require an existing ACCEPTED filing for the same year
    if (filingType === "AMENDED") {
      const acceptedFiling = await prisma.filingYear.findFirst({
        where: { userId: session.user.id, calendarYear, status: "ACCEPTED" },
      });
      if (!acceptedFiling) {
        return NextResponse.json(
          { error: "Cannot create amended filing: original filing must be in ACCEPTED status" },
          { status: 400 }
        );
      }
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
    Sentry.captureException(error);
    console.error("Filing create error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
