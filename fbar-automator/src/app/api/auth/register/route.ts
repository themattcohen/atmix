import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Request validation schema
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  practiceName: z
    .string()
    .min(1, "Practice name is required")
    .max(200, "Practice name must be 200 characters or fewer"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email must be 254 characters or fewer")
    .transform((v) => v.toLowerCase().trim()),
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

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input"
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { practiceName, name, email, password } = parsed.data

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      // Use a generic message to avoid email enumeration
      return NextResponse.json(
        { error: "Unable to create account. Please try a different email." },
        { status: 409 }
      )
    }

    // Hash password with cost factor 12
    const passwordHash = await bcrypt.hash(password, 12)

    // Create Practice + User in a single transaction.
    // The first user of a practice receives the ADMIN role.
    await prisma.$transaction(async (tx) => {
      const practice = await tx.practice.create({
        data: {
          name: practiceName,
        },
      })

      await tx.user.create({
        data: {
          practiceId: practice.id,
          email,
          name,
          passwordHash,
          role: "ADMIN",
        },
      })
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    // Log the actual error server-side but do not leak details to the client
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
