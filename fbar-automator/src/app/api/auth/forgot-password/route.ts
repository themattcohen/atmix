import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      )
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (user) {
      // Clean up expired and used tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true },
          ],
        },
      })

      // Generate reset token (raw token to send in email)
      const rawToken = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Hash token before storing in database
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex")

      // Store hashed token in database
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      })

      // Send email with raw token
      const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`
      try {
        await sendPasswordResetEmail(email, user.name, resetUrl)
      } catch (emailError) {
        console.error(
          "Failed to send password reset email:",
          emailError instanceof Error ? emailError.message : "Unknown error"
        )
      }
    }

    // Always return success message
    return NextResponse.json({
      message:
        "If an account exists with that email, we've sent password reset instructions.",
    })
  } catch (error) {
    console.error(
      "Forgot password error:",
      error instanceof Error ? error.message : "Unknown error"
    )
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
