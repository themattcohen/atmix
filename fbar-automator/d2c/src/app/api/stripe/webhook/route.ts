import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { submitFiling } from "@/lib/fincen-submit";
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

        if (filing.status !== "SIGNED") {
          console.warn(`Webhook: filing ${filingYearId} in unexpected state ${filing.status} (expected SIGNED), skipping payment`);
          break;
        }

        // Only advance to PAID when payment is actually confirmed
        if (session.payment_status !== "paid") {
          console.warn(`Webhook: checkout session ${session.id} has payment_status=${session.payment_status}, deferring`);
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

        // Trigger server-side FinCEN submission (fire-and-forget)
        // Cron recovers if this fails or webhook times out
        submitFiling(filingYearId, userId).then((submitResult) => {
          if (!submitResult.success) {
            console.error(
              `[Webhook] FinCEN submission failed for filing ${filingYearId}:`,
              submitResult.error
            );
          } else {
            console.log(
              `[Webhook] FinCEN submission initiated for filing ${filingYearId}, batchId: ${submitResult.batchId}`
            );
          }
        }).catch((err) => {
          console.error(`[Webhook] FinCEN submission error for filing ${filingYearId}:`, err);
        });

        // GA4 purchase event handled client-side on the confirmation page
        // (server-side Measurement Protocol removed — no access to client _ga cookie)

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

        // Note: No filing status revert needed. If payment failed, checkout.session.completed
        // never fired, so the filing is still in SIGNED state. The checkout.session.expired
        // handler covers the session-timeout case for the Payment record.

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
