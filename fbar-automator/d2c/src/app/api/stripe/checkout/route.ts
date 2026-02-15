import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filingYearId } = await req.json();
    if (!filingYearId) {
      return NextResponse.json({ error: "filingYearId is required" }, { status: 400 });
    }

    // Verify filing year belongs to user and is in SIGNED status
    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    if (filingYear.status !== "SIGNED") {
      return NextResponse.json(
        { error: "Filing must be signed before payment" },
        { status: 400 }
      );
    }

    // Create payment record only if no PENDING payment exists
    const existingPending = await prisma.payment.findFirst({
      where: { userId: session.user.id, filingYearId, status: "PENDING" },
    });

    if (!existingPending) {
      await prisma.payment.create({
        data: {
          userId: session.user.id,
          filingYearId,
          amount: 59.0,
          currency: "usd",
          status: "PENDING",
        },
      });
    }

    // Create Stripe checkout session
    const url = await createCheckoutSession(
      session.user.id,
      filingYearId,
      session.user.email!
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
