// ---------------------------------------------------------------------------
// GET / PUT  /api/settings
// ---------------------------------------------------------------------------
// Manages practice-level settings (name, address, EIN).
// GET: Any authenticated user in the practice can read.
// PUT: Only ADMIN users can update.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { encrypt, safeDecrypt } from "@/lib/encryption"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updatePracticeSchema = z.object({
  name: z.string().min(1, "Practice name is required").max(255),
  address: z
    .object({
      street: z.string().max(255).optional().default(""),
      city: z.string().max(255).optional().default(""),
      state: z.string().max(2).optional().default(""),
      zip: z.string().max(10).optional().default(""),
    })
    .optional()
    .nullable(),
  ein: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => v || null),
})

// ---------------------------------------------------------------------------
// GET /api/settings
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

    const practice = await prisma.practice.findUniqueOrThrow({
      where: { id: session.user.practiceId },
    })

    // M-7: Decrypt and mask the EIN (show only last 4 digits)
    let maskedEin: string | null = null
    if (practice.ein) {
      try {
        const decryptedEin = safeDecrypt(practice.ein)
        // Mask: show only last 4 digits (e.g., "**-***1234")
        if (decryptedEin.length >= 4) {
          const last4 = decryptedEin.slice(-4)
          maskedEin = `**-***${last4}`
        } else {
          maskedEin = "****"
        }
      } catch (err) {
        console.error("Failed to decrypt EIN:", err)
        maskedEin = "****"
      }
    }

    return NextResponse.json({
      id: practice.id,
      name: practice.name,
      address: practice.address,
      ein: maskedEin,
    })
  } catch (error) {
    console.error("GET /api/settings error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
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
        { error: "Only administrators can update practice settings." },
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

    const parsed = updatePracticeSchema.safeParse(body)
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

    // C-2: Encrypt the EIN before storing.
    // If ein is undefined (not sent) or matches the masked pattern, skip update.
    const maskedPattern = /^\*\*-\*\*\*\d{4}$/
    let einUpdate: string | null | undefined = undefined // undefined = skip
    if (data.ein !== undefined && data.ein !== null && !maskedPattern.test(data.ein)) {
      einUpdate = encrypt(data.ein)
    } else if (data.ein === null) {
      einUpdate = null // explicitly clearing EIN
    }
    // else: ein was undefined or matched mask → einUpdate stays undefined → Prisma skips

    const practice = await prisma.practice.update({
      where: { id: practiceId },
      data: {
        name: data.name,
        address: data.address ?? undefined,
        ein: einUpdate,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "PRACTICE_SETTINGS_UPDATED",
        entityType: "Practice",
        entityId: practiceId,
        metadata: {
          name: data.name,
          addressUpdated: !!data.address,
          einUpdated: einUpdate !== undefined,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip"),
      },
    })

    // M-7: Return masked EIN in response
    let maskedEin: string | null = null
    if (practice.ein) {
      try {
        const decryptedEin = safeDecrypt(practice.ein)
        if (decryptedEin.length >= 4) {
          const last4 = decryptedEin.slice(-4)
          maskedEin = `**-***${last4}`
        } else {
          maskedEin = "****"
        }
      } catch (err) {
        console.error("Failed to decrypt EIN for response:", err)
        maskedEin = "****"
      }
    }

    return NextResponse.json({
      id: practice.id,
      name: practice.name,
      address: practice.address,
      ein: maskedEin,
    })
  } catch (error) {
    console.error("PUT /api/settings error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
