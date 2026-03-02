import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    if (verificationToken.used) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Mark token as used and update user
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);

    // Send welcome email (fire-and-forget — do not block the response)
    if (process.env.RESEND_API_KEY) {
      sendEmailWithRetry(
        () => sendWelcomeEmail(verificationToken.user.email, { firstName: verificationToken.user.firstName ?? "there" }),
        { maxRetries: 2, backoffMs: 500 }
      ).catch((err) => {
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
    console.error("Email verification error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
