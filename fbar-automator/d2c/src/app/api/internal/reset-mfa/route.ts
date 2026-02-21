import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginVerifyAttempts } from "@/app/api/auth/mfa/login-verify/route";

/**
 * Test-only endpoint: clear pending MFA setup state for a user.
 *
 * This allows E2E tests to reset a user's mfaSecret (unverified setup) so that
 * /api/auth/mfa/setup can be called again without getting a 409 conflict.
 * Also clears the in-memory MFA login-verify rate limit counter for the user.
 *
 * Only available in non-production environments.
 * Requires userId or email in the request body.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, email, rateLimitOnly } = body;

  if (!userId && !email) {
    return NextResponse.json(
      { error: "userId or email required" },
      { status: 400 }
    );
  }

  const where = userId ? { id: userId } : { email: email as string };

  // Resolve the user first to get their ID for recovery code cleanup
  const user = await prisma.user.findUnique({ where, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If rateLimitOnly=true, only clear the rate limit counter (no DB changes)
  if (!rateLimitOnly) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { mfaSecret: null, mfaEnabled: false },
      }),
      prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // Clear the in-memory rate limit counter for this user so subsequent
  // tests are not blocked by the 5-attempt-per-5-min window.
  loginVerifyAttempts.delete(user.id);

  return NextResponse.json({ ok: true });
}
