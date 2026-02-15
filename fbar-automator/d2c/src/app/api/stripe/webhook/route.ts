import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, filingYearId } = session.metadata || {};

        if (!userId || !filingYearId) {
          console.error("Missing metadata in checkout session");
          break;
        }

        // Update payment
        await prisma.payment.updateMany({
          where: { userId, filingYearId, status: "PENDING" },
          data: {
            status: "COMPLETED",
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent as string,
          },
        });

        // Update filing year with userId verification
        await prisma.filingYear.updateMany({
          where: { id: filingYearId, userId },
          data: {
            status: "PAID",
            stripePaymentId: session.payment_intent as string,
            stripeSessionId: session.id,
          },
        });

        break;
      }

      case "checkout.session.expired": {
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        const expiredMeta = expiredSession.metadata || {};

        if (expiredMeta.userId && expiredMeta.filingYearId) {
          await prisma.payment.updateMany({
            where: {
              userId: expiredMeta.userId,
              filingYearId: expiredMeta.filingYearId,
              status: "PENDING",
            },
            data: { status: "FAILED" },
          });
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Match by stripePaymentIntentId if set, otherwise by metadata
        if (paymentIntent.id) {
          const updated = await prisma.payment.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: { status: "FAILED" },
          });

          // Fallback: if no rows matched (PI ID not yet stored), match by metadata
          if (updated.count === 0 && paymentIntent.metadata) {
            const { userId, filingYearId } = paymentIntent.metadata;
            if (userId && filingYearId) {
              await prisma.payment.updateMany({
                where: { userId, filingYearId, status: "PENDING" },
                data: { status: "FAILED" },
              });
            }
          }
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
