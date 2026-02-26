import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters."),
})

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      )
    }

    // 2. Parse and validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 },
      )
    }

    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Validation failed."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data

    // 3. Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      )
    }

    // 4. Verify current password
    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    )
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      )
    }

    // 5. Reject if new password is the same as current
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    )
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 },
      )
    }

    // 6. Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          practiceId: session.user.practiceId,
          action: "PASSWORD_CHANGED",
          entityType: "User",
          entityId: session.user.id,
          metadata: {},
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip") ??
            null,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 },
    )
  }
}
