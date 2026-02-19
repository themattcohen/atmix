import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

// vi.hoisted() runs before vi.mock() factory functions, so variables declared
// here are available inside the mock factory below.
const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}));

// Mock @/lib/stripe BEFORE importing the route so the singleton is never
// initialised with a real Stripe key. The mock returns a stable object whose
// `constructEvent` is the hoisted spy — the same reference used by the route.
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type Stripe from "stripe";

/**
 * Build a NextRequest that mimics what Stripe sends to the webhook endpoint.
 * The body is arbitrary JSON — signature verification is bypassed by the mock.
 * The `stripe-signature` header is present so the early-return guard passes
 * (unless a test deliberately omits it).
 */
function makeWebhookRequest(
  body: string = "{}",
  includeSignature: boolean = true
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (includeSignature) {
    headers["stripe-signature"] = "t=1,v1=test_sig";
  }
  return new NextRequest("http://localhost:3001/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

/**
 * Configure the mock so that constructEvent returns a fully typed Stripe event.
 */
function mockEvent(
  type: string,
  object: Record<string, unknown>
): void {
  mockConstructEvent.mockReturnValue({
    id: `evt_test_${Date.now()}`,
    type,
    data: { object },
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event);
}

/**
 * Configure the mock so that constructEvent throws (invalid signature).
 */
function mockInvalidSignature(): void {
  mockConstructEvent.mockImplementation(() => {
    throw new Error("No signatures found matching the expected signature for payload");
  });
}

// ─── DB identifiers ───────────────────────────────────────────────────────────

const TEST_EMAIL = `webhook-test-${Date.now()}@test.com`;
let testUserId: string;
let testFilingId: string;

// ─── Test Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Env var required by the route's early guard (before constructEvent is called)
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: "hashed_password_not_used",
      firstName: "Test",
      lastName: "WebhookUser",
    },
  });
  testUserId = user.id;

  // Create test filing in SIGNED state (the expected pre-payment state)
  const filing = await prisma.filingYear.create({
    data: {
      userId: testUserId,
      calendarYear: 2024,
      status: "SIGNED",
      filingType: "ORIGINAL",
    },
  });
  testFilingId = filing.id;

  // Create a PENDING payment record linked to the filing
  await prisma.payment.create({
    data: {
      userId: testUserId,
      filingYearId: testFilingId,
      amount: 5900,
      currency: "usd",
      status: "PENDING",
    },
  });
});

afterAll(async () => {
  // User cascade-deletes filingYears and payments
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Reset filing to SIGNED and payment to PENDING between tests so each test
  // starts from a clean, consistent state.
  await prisma.filingYear.updateMany({
    where: { id: testFilingId },
    data: {
      status: "SIGNED",
      stripePaymentId: null,
      stripeSessionId: null,
    },
  });
  await prisma.payment.updateMany({
    where: { userId: testUserId, filingYearId: testFilingId },
    data: {
      status: "PENDING",
      stripeSessionId: null,
      stripePaymentIntentId: null,
    },
  });
  // Reset mock between tests
  mockConstructEvent.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  // ── Guard tests ─────────────────────────────────────────────────────────────

  it("1. missing stripe-signature header → 400", async () => {
    const req = makeWebhookRequest("{}", false /* no signature header */);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing signature/i);
  });

  it("2. invalid signature (constructEvent throws) → 400", async () => {
    mockInvalidSignature();
    const req = makeWebhookRequest("{}");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid signature/i);
  });

  // ── checkout.session.completed happy path ────────────────────────────────────

  it("3. checkout.session.completed + payment_status=paid + SIGNED filing → filing transitions to PAID", async () => {
    mockEvent("checkout.session.completed", {
      id: "cs_test_happy",
      payment_intent: "pi_test_happy",
      payment_status: "paid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // Filing status must advance to PAID
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("PAID");
    expect(filing?.stripeSessionId).toBe("cs_test_happy");
    expect(filing?.stripePaymentId).toBe("pi_test_happy");

    // Payment record must advance to COMPLETED
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("COMPLETED");
    expect(payment?.stripeSessionId).toBe("cs_test_happy");
    expect(payment?.stripePaymentIntentId).toBe("pi_test_happy");
  });

  // ── P0-7: payment_status guard ───────────────────────────────────────────────

  it("4. checkout.session.completed with payment_status !== 'paid' → does NOT transition filing (P0-7)", async () => {
    mockEvent("checkout.session.completed", {
      id: "cs_test_unpaid",
      payment_intent: "pi_test_unpaid",
      payment_status: "unpaid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Filing must remain SIGNED
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SIGNED");

    // Payment must remain PENDING
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("PENDING");
  });

  // ── P0-7: state guard — only SIGNED allowed ──────────────────────────────────

  it("5. checkout.session.completed with IN_PROGRESS filing → does NOT transition (P0-7 state guard)", async () => {
    // Force filing into IN_PROGRESS (wrong state for payment)
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "IN_PROGRESS" },
    });

    mockEvent("checkout.session.completed", {
      id: "cs_test_inprogress",
      payment_intent: "pi_test_inprogress",
      payment_status: "paid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Filing must remain IN_PROGRESS — not advanced to PAID
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("IN_PROGRESS");

    // Payment must remain PENDING
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("PENDING");
  });

  // ── Idempotency guards ───────────────────────────────────────────────────────

  it("6. checkout.session.completed with already-PAID filing → idempotent skip (no error, no double-update)", async () => {
    // Pre-advance filing to PAID (simulates a duplicate webhook delivery)
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "PAID", stripeSessionId: "cs_test_already_paid" },
    });
    await prisma.payment.updateMany({
      where: { userId: testUserId, filingYearId: testFilingId },
      data: { status: "COMPLETED", stripeSessionId: "cs_test_already_paid" },
    });

    mockEvent("checkout.session.completed", {
      id: "cs_test_duplicate",
      payment_intent: "pi_test_duplicate",
      payment_status: "paid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // Filing session ID must remain unchanged (not overwritten by the duplicate)
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("PAID");
    expect(filing?.stripeSessionId).toBe("cs_test_already_paid");
  });

  it("7. checkout.session.completed with already-SUBMITTED filing → idempotent skip", async () => {
    // Pre-advance filing to SUBMITTED (post-payment, post-FinCEN submission)
    await prisma.filingYear.update({
      where: { id: testFilingId },
      data: { status: "SUBMITTED", stripeSessionId: "cs_test_submitted" },
    });
    await prisma.payment.updateMany({
      where: { userId: testUserId, filingYearId: testFilingId },
      data: { status: "COMPLETED", stripeSessionId: "cs_test_submitted" },
    });

    mockEvent("checkout.session.completed", {
      id: "cs_test_dup_submitted",
      payment_intent: "pi_test_dup_submitted",
      payment_status: "paid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Filing must remain SUBMITTED — not regressed to PAID
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SUBMITTED");
  });

  // ── checkout.session.expired ─────────────────────────────────────────────────

  it("8. checkout.session.expired → marks payment FAILED", async () => {
    mockEvent("checkout.session.expired", {
      id: "cs_test_expired",
      payment_intent: null,
      payment_status: "unpaid",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Payment must be FAILED
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("FAILED");

    // Filing status must be unchanged (still SIGNED — not reverted, not advanced)
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SIGNED");
  });

  // ── payment_intent.payment_failed (P1-12) ───────────────────────────────────

  it("9. payment_intent.payment_failed → marks payment FAILED, does NOT revert filing status (P1-12)", async () => {
    // Set a known stripePaymentIntentId on the payment so the route can match it
    await prisma.payment.updateMany({
      where: { userId: testUserId, filingYearId: testFilingId },
      data: { stripePaymentIntentId: "pi_test_failed_123" },
    });

    mockEvent("payment_intent.payment_failed", {
      id: "pi_test_failed_123",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Payment must be FAILED
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("FAILED");

    // CRITICAL (P1-12): filing must remain SIGNED — NOT reverted to IN_PROGRESS
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SIGNED");
  });

  it("9b. payment_intent.payment_failed with no matching PI id → fallback to metadata match", async () => {
    // No stripePaymentIntentId set on the payment — route falls back to metadata
    mockEvent("payment_intent.payment_failed", {
      id: "pi_test_no_match_999",
      metadata: { userId: testUserId, filingYearId: testFilingId },
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Payment must still be FAILED via metadata fallback
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("FAILED");

    // Filing must remain SIGNED
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SIGNED");
  });

  // ── Missing metadata ─────────────────────────────────────────────────────────

  it("10. checkout.session.completed with missing metadata → no DB changes, 200 received", async () => {
    mockEvent("checkout.session.completed", {
      id: "cs_test_no_meta",
      payment_intent: "pi_test_no_meta",
      payment_status: "paid",
      metadata: null, // No userId / filingYearId
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // Filing must remain unchanged
    const filing = await prisma.filingYear.findUnique({ where: { id: testFilingId } });
    expect(filing?.status).toBe("SIGNED");

    // Payment must remain PENDING
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("PENDING");
  });

  it("10b. checkout.session.expired with missing metadata → no DB changes, 200 received", async () => {
    mockEvent("checkout.session.expired", {
      id: "cs_test_expired_no_meta",
      payment_intent: null,
      payment_status: "unpaid",
      metadata: {}, // Empty metadata — no userId / filingYearId
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);

    // Payment must remain PENDING
    const payment = await prisma.payment.findFirst({
      where: { userId: testUserId, filingYearId: testFilingId },
    });
    expect(payment?.status).toBe("PENDING");
  });

  // ── Unknown event type passthrough ───────────────────────────────────────────

  it("11. unknown event type → 200 received (graceful passthrough)", async () => {
    mockEvent("customer.created", {
      id: "cus_test",
    });

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });
});
