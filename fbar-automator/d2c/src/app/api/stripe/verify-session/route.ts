import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Check if the payment has been processed by the webhook
    const payment = await prisma.payment.findFirst({
      where: {
        userId: session.user.id,
        stripeSessionId: sessionId,
      },
      select: { status: true, filingYearId: true, userId: true },
    });

    if (!payment) {
      return NextResponse.json({ data: { status: "pending" } });
    }

    // Also fetch filing status and UTM data for conversion attribution
    const [filing, user] = await Promise.all([
      prisma.filingYear.findFirst({
        where: { id: payment.filingYearId, userId: session.user.id },
        select: { id: true, status: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { utmSource: true, utmMedium: true, utmCampaign: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        status: payment.status.toLowerCase(),
        filingId: filing?.id || null,
        filingStatus: filing?.status || null,
        utm: {
          source: user?.utmSource || null,
          medium: user?.utmMedium || null,
          campaign: user?.utmCampaign || null,
        },
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Verify session error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
