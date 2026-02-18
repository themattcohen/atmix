import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import type { PricingTier } from "@/lib/pricing";

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

    // Use a transaction to atomically check status and create checkout
    const result = await prisma.$transaction(async (tx) => {
      // Verify filing year belongs to user
      const filingYear = await tx.filingYear.findFirst({
        where: { id: filingYearId, userId: session.user.id },
      });

      if (!filingYear) {
        return { error: "Filing year not found", status: 404 } as const;
      }

      // Guard: filing must be in SIGNED status — reject if already paid or later
      if (["PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED"].includes(filingYear.status)) {
        return {
          error: "Payment has already been completed for this filing",
          status: 409,
          redirect: "/confirmation",
        } as const;
      }

      if (filingYear.status !== "SIGNED") {
        return {
          error: "Filing must be signed before payment",
          status: 400,
        } as const;
      }

      // Check for existing completed payment
      const existingCompleted = await tx.payment.findFirst({
        where: { userId: session.user.id, filingYearId, status: "COMPLETED" },
      });

      if (existingCompleted) {
        return {
          error: "Payment has already been completed for this filing",
          status: 409,
          redirect: "/confirmation",
        } as const;
      }

      // Check for existing pending payment with a Stripe session
      const existingPending = await tx.payment.findFirst({
        where: { userId: session.user.id, filingYearId, status: "PENDING", stripeSessionId: { not: null } },
      });

      if (existingPending) {
        return {
          error: "A payment is already in progress. Please complete or cancel the existing checkout.",
          status: 409,
        } as const;
      }

      // Determine tier and pricing
      const tier = filingYear.tier.toLowerCase() as PricingTier;
      const pricing = PRICING[tier];

      // Create or reuse payment record
      let payment = await tx.payment.findFirst({
        where: { userId: session.user.id, filingYearId, status: "PENDING" },
      });

      if (!payment) {
        payment = await tx.payment.create({
          data: {
            userId: session.user.id,
            filingYearId,
            amount: pricing.amountDollars,
            currency: "usd",
            status: "PENDING",
          },
        });
      }

      return { success: true, payment, tier } as const;
    });

    if ("error" in result) {
      const response: Record<string, unknown> = { error: result.error };
      if ("redirect" in result) response.redirect = result.redirect;
      return NextResponse.json(response, { status: result.status });
    }

    // Fetch user UTM fields for Stripe metadata
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { utmSource: true, utmMedium: true, utmCampaign: true },
    });

    // Create Stripe checkout session (outside transaction — external API call)
    const url = await createCheckoutSession(
      session.user.id,
      filingYearId,
      session.user.email!,
      result.tier,
      user ?? undefined
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Checkout error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
