# Gap #3: Stripe Live Keys + Webhook

**Severity:** Blocking
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

The D2C app cannot process real payments. The production `.env` currently holds placeholder Stripe values (`sk_live_...` / `whsec_...` sentinel strings). Until live keys are set and the webhook endpoint is registered in the Stripe dashboard, all checkout attempts will fail at the Stripe SDK initialization level and all payment confirmation events will go unprocessed — meaning no filing will ever reach `PAID` status through the normal flow.

## Current State

**`d2c/src/lib/stripe.ts` — lines 6-11** (Stripe SDK initialization):
```ts
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
```
The function throws at runtime if `STRIPE_SECRET_KEY` is absent or a placeholder. There is no build-time check — the error surfaces only when a user attempts to check out.

**`d2c/src/app/api/stripe/webhook/route.ts` — lines 10-25** (webhook handler):
```ts
if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Missing signature" }, { status: 400 });
}

event = getStripe().webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```
Every incoming Stripe webhook returns HTTP 400 ("Missing signature") when `STRIPE_WEBHOOK_SECRET` is not set. This means `checkout.session.completed` events are silently dropped and filing status is never updated to `PAID`.

**`docker-compose.prod.yml` — lines 206-207** (environment mapping):
```yaml
- STRIPE_SECRET_KEY=${D2C_STRIPE_SECRET_KEY}
- STRIPE_WEBHOOK_SECRET=${D2C_STRIPE_WEBHOOK_SECRET}
```
Both variables are already plumbed through from `.env` to the `d2c-app` container — no compose changes are required.

**`.env.unified.example` — lines 120-121** (placeholders):
```
D2C_STRIPE_SECRET_KEY=sk_live_...
D2C_STRIPE_WEBHOOK_SECRET=whsec_...
```
These are placeholder sentinel values that must be replaced with real credentials.

## Implementation Plan

### Step 1: Obtain live Stripe keys

1. Log in to the Stripe Dashboard at `https://dashboard.stripe.com`.
2. Ensure the account is in **Live mode** (toggle in the top-left corner — confirm it does NOT say "Test mode").
3. Navigate to **Developers > API keys**.
4. Copy the **Secret key** (`sk_live_...`). If it has been rolled since the account was created, create a new restricted key with the following minimum permissions:
   - `checkout.sessions`: write
   - `payment_intents`: read
   - `webhooks`: read
5. The **Publishable key** (`pk_live_...`) is not consumed server-side — only the secret key is needed for the D2C backend.

### Step 2: Register the webhook endpoint in Stripe

1. In the Stripe Dashboard, go to **Developers > Webhooks**.
2. Click **+ Add endpoint**.
3. Set the **Endpoint URL** to: `https://fbardirect.com/api/stripe/webhook`
4. Select the following events to listen for:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**.
6. On the endpoint detail page, reveal and copy the **Signing secret** (`whsec_...`).

### Step 3: Update the production `.env` on the Hetzner VPS

SSH into the server and edit the env file:

```bash
ssh root@178.156.250.116
cd /root/atmix/fbar-automator   # or wherever the repo is checked out on the VPS
nano .env
```

Set these two lines (replace placeholder values):

```
D2C_STRIPE_SECRET_KEY=sk_live_<actual_value>
D2C_STRIPE_WEBHOOK_SECRET=whsec_<actual_value>
```

### Step 4: Redeploy the D2C container

Because env vars are baked in at container start (not build time), only a container restart is needed — not a full image rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --no-build d2c-app
```

This is safe: `d2c-app` picks up the new env values on restart. No database changes required.

## Files to Modify

| File | Change |
|---|---|
| `/root/atmix/fbar-automator/.env` (on VPS) | Replace `D2C_STRIPE_SECRET_KEY` and `D2C_STRIPE_WEBHOOK_SECRET` placeholder values with live credentials |

No source code changes are required. The application code already handles both variables correctly.

## Environment / Config Changes

| Variable | Where set | Value |
|---|---|---|
| `D2C_STRIPE_SECRET_KEY` | VPS `.env` | `sk_live_<from Stripe dashboard>` |
| `D2C_STRIPE_WEBHOOK_SECRET` | VPS `.env` | `whsec_<from Stripe dashboard>` |

The `docker-compose.prod.yml` already maps these to the `d2c-app` container as `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (lines 206-207) — no compose changes needed.

## Testing

### Verify keys are loaded

After redeploying, confirm the container sees the real keys:

```bash
docker compose -f docker-compose.prod.yml exec d2c-app env | grep STRIPE
# Expected:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

Neither value should be blank or the placeholder sentinel.

### Verify webhook delivery from Stripe dashboard

1. In the Stripe Dashboard, go to **Developers > Webhooks > fbardirect.com endpoint**.
2. Click **Send test webhook** and send a `checkout.session.completed` event.
3. Confirm the dashboard shows **200 OK** response from `https://fbardirect.com/api/stripe/webhook`.
4. If it returns 400, check container logs: `docker compose -f docker-compose.prod.yml logs d2c-app --tail=50`

### End-to-end payment test

1. Complete the full wizard flow (threshold → personal → accounts → review → sign).
2. At the payment step, use a real card (Stripe does not support test cards on live keys).
3. After payment, confirm the user lands on `/confirmation` and the `FilingYear.status` is `PAID` in the database:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U fbar -d fbar_direct \
  -c "SELECT id, status, \"stripePaymentId\" FROM \"FilingYear\" ORDER BY \"createdAt\" DESC LIMIT 3;"
```

### Webhook signature verification test

Send a POST to the webhook endpoint with an invalid signature to confirm it correctly rejects:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://fbardirect.com/api/stripe/webhook \
  -H "stripe-signature: t=invalid,v1=invalid" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400
```

## Risks / Notes

- **Do not use test keys (`sk_test_...`) in production.** The Stripe Dashboard will show payments in test mode as successful but they will never settle. The `getStripe()` function in `stripe.ts` (line 11) accepts any key format — it will not error on a test key used in production.
- **Webhook deduplication is already implemented.** The webhook handler at `route.ts` lines 49-58 checks for `PAID` or `SUBMITTED` status before processing — duplicate delivery of `checkout.session.completed` is safe.
- **Rollback:** If you need to roll back to sandbox mode, set `D2C_STRIPE_SECRET_KEY=` (empty) and restart. The app will throw on checkout, but no money movement will occur. There is no Stripe-side sandbox mode toggle in this codebase — you must swap keys.
- **Stripe webhook signing secret is endpoint-specific.** If you delete and recreate the webhook endpoint, the `whsec_...` value changes and the `.env` must be updated again.
- **GA4 Measurement Protocol** (webhook handler lines 81-98) fires a `purchase` event on `checkout.session.completed`. This is fire-and-forget and will silently no-op if `GA4_MEASUREMENT_ID` or `GA4_API_SECRET` are not set — it does not affect payment processing.
