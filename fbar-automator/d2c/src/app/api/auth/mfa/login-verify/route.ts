import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotp, hashRecoveryCode } from "@/lib/mfa";
import { decrypt } from "@/lib/encryption";
import { createMfaCookie } from "@/lib/mfa-cookie";

// ---------------------------------------------------------------------------
// Per-user rate limit: 5 attempts per 5 minutes (in-memory)
// ---------------------------------------------------------------------------
export const loginVerifyAttempts = new Map<string, { count: number; resetTime: number }>();

function checkLoginVerifyRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = loginVerifyAttempts.get(userId);
  if (!entry || now > entry.resetTime) {
    loginVerifyAttempts.set(userId, { count: 1, resetTime: now + 5 * 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const loginVerifySchema = z
  .object({
    token: z.string().min(1).max(10).optional(),
    recoveryCode: z.string().min(1).max(20).optional(),
  })
  .refine((data) => data.token || data.recoveryCode, {
    message: "Either token or recoveryCode is required",
  });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = loginVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Token or recovery code is required" },
        { status: 400 }
      );
    }

    if (!checkLoginVerifyRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many verification attempts. Try again in 5 minutes." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is not enabled for this account" },
        { status: 400 }
      );
    }

    let verified = false;

    if (parsed.data.token) {
      // TOTP path
      if (!user.mfaSecret) {
        return NextResponse.json({ error: "MFA configuration error" }, { status: 400 });
      }
      const decryptedSecret = decrypt(user.mfaSecret);
      verified = verifyTotp(decryptedSecret, parsed.data.token);
      if (!verified) {
        return NextResponse.json({ error: "Invalid TOTP token" }, { status: 400 });
      }
    } else if (parsed.data.recoveryCode) {
      // Recovery code path — atomic updateMany prevents TOCTOU race (same pattern as recovery/route.ts)
      const codeHash = hashRecoveryCode(parsed.data.recoveryCode);
      const result = await prisma.mfaRecoveryCode.updateMany({
        where: { userId: session.user.id, codeHash, used: false },
        data: { used: true, usedAt: new Date() },
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: "Invalid or already used recovery code" },
          { status: 400 }
        );
      }
      verified = true;
    }

    if (!verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    // Set MFA verified cookie
    const cookie = await createMfaCookie(session.user.id, user.tokenVersion);
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options as any);
    return response;
  } catch (error) {
    console.error(
      "MFA login-verify error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
