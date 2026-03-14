import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { submitFiling } from "@/lib/fincen-submit";
import { sendPaymentReceiptEmail, sendEmailWithRetry } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

// Stripe event deduplication (in-memory, per-process — fine for single instance)
const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

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

  // Idempotency: skip already-processed events
  if (processedEvents.has(event.id)) {
    return NextResponse.json({ received: true });
  }
  processedEvents.add(event.id);
  // Prevent memory leak — evict oldest entries when set is too large
  if (processedEvents.size > MAX_PROCESSED_EVENTS) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
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
          select: { status: true, calendarYear: true, tier: true },
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

        // Payment receipt email (fire-and-forget)
        if (process.env.RESEND_API_KEY) {
          prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } })
            .then((user) => {
              if (!user) return;
              const tier = filing.tier || 'BASIC';
              const amt = tier.toUpperCase() === 'PREMIUM' ? 79 : 59;
              return sendEmailWithRetry(() => sendPaymentReceiptEmail(user.email, {
                firstName: user.firstName || 'there',
                calendarYear: filing.calendarYear,
                amountDollars: amt,
                tier: tier.charAt(0) + tier.slice(1).toLowerCase(),
              }));
            })
            .catch((err) => {
              Sentry.captureException(err, { extra: { context: "payment_receipt_email" } });
              console.error('[Webhook] Payment receipt email failed:', err);
            });
        }

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
    Sentry.captureException(error);
    console.error("Webhook processing error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
