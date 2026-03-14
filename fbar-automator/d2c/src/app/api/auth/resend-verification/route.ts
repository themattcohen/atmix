import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendVerificationEmail, sendEmailWithRetry } from "@/lib/email";

const resendAttempts = new Map<string, { count: number; resetTime: number }>();

function checkResendRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = resendAttempts.get(key);
  if (!entry || now > entry.resetTime) {
    resendAttempts.set(key, { count: 1, resetTime: now + 60 * 60_000 }); // 1 hour
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Try authenticated path first
    const session = await auth();

    if (session?.user?.id) {
      // AUTHENTICATED PATH — existing logic unchanged
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, firstName: true, emailVerified: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (user.emailVerified) {
        return NextResponse.json({ error: "Email already verified" }, { status: 400 });
      }

      // Delete existing unused tokens for this user
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id, used: false },
      });

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.emailVerificationToken.create({
        data: { userId: user.id, token: hashedToken, expiresAt },
      });

      const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${rawToken}`;
      await sendEmailWithRetry(
        () => sendVerificationEmail(user.email, user.firstName || "there", verifyUrl),
        { maxRetries: 2, backoffMs: 500 }
      );

      return NextResponse.json({ message: "Verification email sent" });
    }

    // UNAUTHENTICATED PATH — email from request body
    const body = await req.json().catch(() => ({}));
    const emailSchema = z.object({ email: z.string().email().max(255) });
    const parsed = emailSchema.safeParse(body);

    if (!parsed.success) {
      // Anti-enumeration: return 200 even on bad input
      return NextResponse.json({ message: "If that email exists, we sent a verification link." });
    }

    const email = parsed.data.email.toLowerCase().trim();

    // Rate limit by email:IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${email}:${ip}`;
    if (!checkResendRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Look up user — anti-enumeration: always return same response
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, emailVerified: true },
    });

    if (!user || user.emailVerified) {
      // Anti-enumeration: identical success response
      return NextResponse.json({ message: "If that email exists, we sent a verification link." });
    }

    // Delete existing unused tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id, used: false },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token: hashedToken, expiresAt },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${rawToken}`;
    await sendEmailWithRetry(
      () => sendVerificationEmail(user.email, user.firstName || "there", verifyUrl),
      { maxRetries: 2, backoffMs: 500 }
    );

    return NextResponse.json({ message: "If that email exists, we sent a verification link." });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Resend verification error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
