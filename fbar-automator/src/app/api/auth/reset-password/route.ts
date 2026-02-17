import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { z } from "zod"

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required").max(128),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be 128 characters or fewer")
    .refine(
      (password) => /[A-Z]/.test(password),
      "Password must contain at least one uppercase letter"
    )
    .refine(
      (password) => /[a-z]/.test(password),
      "Password must contain at least one lowercase letter"
    )
    .refine(
      (password) => /[0-9]/.test(password),
      "Password must contain at least one number"
    ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input"
      return NextResponse.json({ error: firstError }, { status: 400 })
    }
    const { token, password } = parsed.data

    // Hash the token before database lookup
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token." },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Reset token has expired." },
        { status: 400 }
      )
    }

    // Check if token has been used
    if (resetToken.used) {
      return NextResponse.json(
        { error: "Reset token has already been used." },
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ])

    return NextResponse.json({
      message: "Password reset successfully.",
    })
  } catch (error) {
    console.error(
      "Reset password error:",
      error instanceof Error ? error.message : "Unknown error"
    )
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
