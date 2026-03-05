import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// E2E Test Setup Endpoint
// ---------------------------------------------------------------------------
// Secret-protected (NOT NODE_ENV-gated) so it works on production.
// Returns 404 if E2E_TEST_SECRET is unset — endpoint is invisible.
//
// Actions:
//   setup   — Create a verified test user + optional FilingYear
//   cleanup — Delete test user + all cascading data
//   reset   — Wipe filings/accounts/payments, create fresh FilingYear
//   set-status — Set FilingYear status directly (bypass Stripe)
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^e2e-test-.+@test\.fbardirect\.com$/;

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) return false;

  const provided = request.headers.get("x-e2e-secret") ?? "";
  if (provided.length !== secret.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(provided, "utf-8"),
    Buffer.from(secret, "utf-8")
  );
}

function notFound() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  // If secret is not configured, endpoint doesn't exist
  if (!process.env.E2E_TEST_SECRET) return notFound();
  if (!verifySecret(request)) return notFound();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string;

  switch (action) {
    case "setup":
      return handleSetup(body);
    case "cleanup":
      return handleCleanup(body);
    case "reset":
      return handleReset(body);
    case "set-status":
      return handleSetStatus(body);
    default:
      return NextResponse.json(
        { error: "Invalid action. Use: setup, cleanup, reset, set-status" },
        { status: 400 }
      );
  }
}

// ---------------------------------------------------------------------------
// setup: Create a verified test user
// ---------------------------------------------------------------------------
async function handleSetup(body: Record<string, unknown>) {
  const email = body.email as string;
  const password = (body.password as string) || "E2eTestPass123!";
  const calendarYear = (body.calendarYear as number) || undefined;

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Email must match e2e-test-*@test.fbardirect.com" },
      { status: 400 }
    );
  }

  // Delete existing user if present (idempotent setup)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await cascadeDeleteUser(existing.id);
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      emailVerified: true,
    },
  });

  let filingYearId: string | null = null;
  if (calendarYear) {
    const fy = await prisma.filingYear.create({
      data: {
        userId: user.id,
        calendarYear,
        status: "IN_PROGRESS",
        filingType: "ORIGINAL",
      },
    });
    filingYearId = fy.id;
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        userId: user.id,
        email,
        password,
        filingYearId,
      },
    },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// cleanup: Delete test user + all cascading data
// ---------------------------------------------------------------------------
async function handleCleanup(body: Record<string, unknown>) {
  const email = body.email as string;

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Email must match e2e-test-*@test.fbardirect.com" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: true, message: "User not found, nothing to clean" });
  }

  await cascadeDeleteUser(user.id);

  return NextResponse.json({ success: true, message: `Deleted user ${email} and all related data` });
}

// ---------------------------------------------------------------------------
// reset: Wipe filings/accounts/payments, create fresh FilingYear
// ---------------------------------------------------------------------------
async function handleReset(body: Record<string, unknown>) {
  const email = body.email as string;
  const calendarYear = (body.calendarYear as number) || new Date().getFullYear() - 1;

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Email must match e2e-test-*@test.fbardirect.com" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get all filing year IDs for this user
  const filingYears = await prisma.filingYear.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const fyIds = filingYears.map((fy) => fy.id);

  // Delete in FK-safe order
  await prisma.$transaction([
    prisma.statement.deleteMany({ where: { filingYearId: { in: fyIds } } }),
    prisma.payment.deleteMany({ where: { filingYearId: { in: fyIds } } }),
    prisma.foreignAccount.deleteMany({ where: { userId: user.id } }),
    prisma.filingYear.deleteMany({ where: { userId: user.id } }),
  ]);

  // Create fresh FilingYear
  const fy = await prisma.filingYear.create({
    data: {
      userId: user.id,
      calendarYear,
      status: "IN_PROGRESS",
      filingType: "ORIGINAL",
    },
  });

  return NextResponse.json({
    success: true,
    data: { filingYearId: fy.id, calendarYear },
  });
}

// ---------------------------------------------------------------------------
// set-status: Set FilingYear status directly
// ---------------------------------------------------------------------------
async function handleSetStatus(body: Record<string, unknown>) {
  const email = body.email as string;
  const status = body.status as string;
  const calendarYear = body.calendarYear as number | undefined;

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Email must match e2e-test-*@test.fbardirect.com" },
      { status: 400 }
    );
  }

  const validStatuses = [
    "IN_PROGRESS", "REVIEWED", "SIGNED", "PAID",
    "SUBMITTED", "ACCEPTED", "REJECTED",
  ];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Use: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const whereClause: Record<string, unknown> = { userId: user.id };
  if (calendarYear) whereClause.calendarYear = calendarYear;

  const filingYear = await prisma.filingYear.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  if (!filingYear) {
    return NextResponse.json({ error: "No filing year found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { status };

  // Set signedAt when transitioning to SIGNED or beyond
  if (["SIGNED", "PAID", "SUBMITTED", "ACCEPTED"].includes(status) && !filingYear.signedAt) {
    updateData.signedAt = new Date();
  }

  const updated = await prisma.filingYear.update({
    where: { id: filingYear.id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    data: { id: updated.id, status: updated.status },
  });
}

// ---------------------------------------------------------------------------
// Helper: cascade delete user and all related records
// ---------------------------------------------------------------------------
async function cascadeDeleteUser(userId: string) {
  // Get all filing year IDs
  const filingYears = await prisma.filingYear.findMany({
    where: { userId },
    select: { id: true },
  });
  const fyIds = filingYears.map((fy) => fy.id);

  await prisma.$transaction([
    // Delete records with FK to FilingYear
    prisma.statement.deleteMany({ where: { filingYearId: { in: fyIds } } }),
    prisma.payment.deleteMany({ where: { filingYearId: { in: fyIds } } }),
    // Delete records with FK to User
    prisma.foreignAccount.deleteMany({ where: { userId } }),
    prisma.filingYear.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    // Finally delete the user
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
