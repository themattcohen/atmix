import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export { getStripe };

export async function createCheckoutSession(
  userId: string,
  filingYearId: string,
  userEmail: string
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "FBAR Filing — FinCEN Form 114",
            description: "Electronic filing of your Report of Foreign Bank and Financial Accounts",
          },
          unit_amount: 5900, // $59.00
        },
        quantity: 1,
      },
    ],
    metadata: { userId, filingYearId },
    success_url: `${process.env.NEXTAUTH_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/review`,
  });

  if (!session.url) {
    throw new Error("Stripe checkout session URL was not returned");
  }
  return session.url;
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}
