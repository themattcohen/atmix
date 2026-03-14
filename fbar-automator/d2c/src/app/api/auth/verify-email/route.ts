import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createEmailVerificationCookie } from "@/lib/email-verification-cookie";
import { sendWelcomeEmail, sendEmailWithRetry } from "@/lib/email";

const verifySchema = z.object({
  token: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const { token } = parsed.data;

    // Hash the raw token to match what's stored in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find valid, unused token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
      include: { user: { select: { id: true, tokenVersion: true, email: true, firstName: true } } },
    });

    if (!verificationToken) {
      console.warn("[verify-email] Token not found in DB");
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    if (verificationToken.used) {
      console.warn("[verify-email] Token already used:", hashedToken.slice(0, 8));
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    if (verificationToken.expiresAt < new Date()) {
      console.warn("[verify-email] Token expired, expiresAt:", verificationToken.expiresAt);
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Atomic check-and-update to prevent race condition (double-tab scenario)
    const result = await prisma.emailVerificationToken.updateMany({
      where: { id: verificationToken.id, used: false },
      data: { used: true },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    // Update user email verified status
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    // Send welcome email (fire-and-forget — do not block the response)
    if (process.env.RESEND_API_KEY) {
      sendEmailWithRetry(
        () => sendWelcomeEmail(verificationToken.user.email, { firstName: verificationToken.user.firstName ?? "there" }),
        { maxRetries: 2, backoffMs: 500 }
      ).catch((err) => {
        Sentry.captureException(err, { extra: { email: verificationToken.user.email, context: "welcome_email" } });
        console.error("Welcome email failed:", err instanceof Error ? err.message : "Unknown error");
      });
    }

    // Set email verification cookie
    const cookie = await createEmailVerificationCookie(
      verificationToken.user.id,
      verificationToken.user.tokenVersion
    );

    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options as any);
    return response;
  } catch (error) {
    Sentry.captureException(error);
    console.error("Email verification error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
