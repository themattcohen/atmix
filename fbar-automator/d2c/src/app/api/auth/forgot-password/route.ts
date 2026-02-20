import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { sendPasswordResetEmail, sendEmailWithRetry } from "@/lib/email";

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      // Return same success response to prevent email format enumeration
      return NextResponse.json({
        message:
          "If an account exists with that email, we've sent password reset instructions.",
      });
    }
    const { email } = parsed.data;

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      // Delete ALL existing tokens for this user before creating a new one
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Generate reset token (raw token to send in email)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Hash token before storing in database
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Store hashed token in database
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      });

      // Send email with raw token (don't block on failure)
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;
      try {
        await sendEmailWithRetry(
          () => sendPasswordResetEmail(email, user.firstName || "there", resetUrl),
          { maxRetries: 2, backoffMs: 500 }
        );
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError instanceof Error ? emailError.message : "Unknown error");
        // Continue — don't reveal email sending failure to client
      }
    }

    // Always return success message
    return NextResponse.json({
      message:
        "If an account exists with that email, we've sent password reset instructions.",
    });
  } catch (error) {
    console.error("Forgot password error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
