import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { sendVerificationEmail, sendEmailWithRetry } from "@/lib/email";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  try {
    const body = await req.json();
    // Trim and normalize email before Zod validation so whitespace-padded emails pass
    if (body && typeof body.email === "string") {
      body.email = body.email.trim();
    }
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email: rawEmail, password, firstName, lastName, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Always hash password to prevent timing-based enumeration
    const passwordHash = await bcrypt.hash(password, 12);

    let userCreated = false;
    let userId: string | null = null;
    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmContent: utmContent || null,
          utmTerm: utmTerm || null,
        },
      });
      userCreated = true;
      userId = user.id;
    } catch (err: unknown) {
      // Unique constraint = email exists. Fall through to return same response
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        // Intentionally swallowed — anti-enumeration
      } else {
        throw err; // Re-throw unexpected errors to be caught by outer catch
      }
    }

    // Send verification email instead of welcome email
    if (userCreated && userId && process.env.RESEND_API_KEY) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create token (fire-and-forget the email, but token creation must succeed)
      await prisma.emailVerificationToken.create({
        data: {
          userId,
          token: hashedToken,
          expiresAt,
        },
      });

      const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${rawToken}`;
      sendEmailWithRetry(
        () => sendVerificationEmail(email, firstName, verifyUrl),
        { maxRetries: 2, backoffMs: 500 }
      ).catch((err) => {
        Sentry.captureException(err, { extra: { email, context: "signup_verification_email" } });
        console.error("[signup] Verification email FAILED for:", email, err instanceof Error ? err.message : err);
      });
    }

    // Always return identical response regardless of whether user was created or already existed
    return NextResponse.json(
      { message: "Check your email to continue." },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Signup error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
