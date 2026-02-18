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
    console.error("Webhook signature verification failed:", err instanceof Error ? err.message : "Unknown error");
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

        // Status guard: verify filing is in an appropriate state before processing payment
        const filing = await prisma.filingYear.findFirst({
          where: { id: filingYearId, userId },
          select: { status: true },
        });

        if (!filing) {
          console.error(`Webhook: filing ${filingYearId} not found for user ${userId}`);
          break;
        }

        if (filing.status === "PAID" || filing.status === "SUBMITTED") {
          // Already processed — idempotent skip
          console.warn(`Webhook: filing ${filingYearId} already in ${filing.status} state, skipping`);
          break;
        }

        if (filing.status !== "SIGNED" && filing.status !== "IN_PROGRESS") {
          console.warn(`Webhook: filing ${filingYearId} in unexpected state ${filing.status}, skipping payment`);
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

        // Fire-and-forget GA4 Measurement Protocol purchase event
        if (process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET) {
          fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`,
            {
              method: 'POST',
              body: JSON.stringify({
                client_id: session.metadata?.userId || 'server',
                events: [{
                  name: 'purchase',
                  params: {
                    currency: 'USD',
                    value: session.amount_total! / 100,
                    transaction_id: session.id,
                  },
                }],
              }),
            }
          ).catch(() => {}); // Fire and forget — don't block webhook processing
        }

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

        // Revert filing status to SIGNED if it was advanced to PAID
        // (only if payment failed before completion)
        if (paymentIntent.metadata?.userId && paymentIntent.metadata?.filingYearId) {
          await prisma.filingYear.updateMany({
            where: {
              id: paymentIntent.metadata.filingYearId,
              userId: paymentIntent.metadata.userId,
              status: "PAID", // Only revert if still in PAID state
            },
            data: { status: "SIGNED" },
          });
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
