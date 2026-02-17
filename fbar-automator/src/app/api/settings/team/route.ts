// ---------------------------------------------------------------------------
// GET / POST  /api/settings/team
// ---------------------------------------------------------------------------
// Manages team members within a practice.
// GET: Any authenticated user can list team members.
// POST: Only ADMIN users can invite/create new team members.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomInt } from "crypto"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createTeamMemberSchema = z.object({
  email: z.string().email("A valid email address is required.").max(255),
  name: z.string().min(1, "Name is required.").max(255),
  role: z.enum(["PREPARER", "REVIEWER"], {
    errorMap: () => ({ message: "Role must be PREPARER or REVIEWER." }),
  }),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a random alphanumeric temporary password using crypto.randomInt. */
function generateTemporaryPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < length; i++) {
    // C-4: Use crypto.randomInt instead of Math.random() for cryptographic security
    password += chars.charAt(randomInt(0, chars.length))
  }
  return password
}

// ---------------------------------------------------------------------------
// GET /api/settings/team
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const users = await prisma.user.findMany({
      where: { practiceId: session.user.practiceId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("GET /api/settings/team error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/settings/team
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can invite team members." },
        { status: 403 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const parsed = createTeamMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    const { id: userId, practiceId } = session.user

    // Check for existing user with same email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email address already exists." },
        { status: 409 }
      )
    }

    // Generate temp password and hash it
    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          practiceId,
          email: data.email.toLowerCase().trim(),
          name: data.name,
          passwordHash,
          role: data.role,
        },
      })

      await tx.auditLog.create({
        data: {
          userId,
          practiceId,
          action: "TEAM_MEMBER_CREATED",
          entityType: "User",
          entityId: newUser.id,
          metadata: {
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            invitedBy: userId,
          },
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip"),
        },
      })

      return newUser
    })

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        temporaryPassword,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/settings/team error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
