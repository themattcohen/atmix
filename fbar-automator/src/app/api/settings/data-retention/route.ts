import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { z } from "zod"

export const dynamic = "force-dynamic"

const retentionSchema = z.object({
  statementRetentionDays: z.number().int().min(30).max(3650),
  auditLogRetentionDays: z.number().int().min(365).max(3650),
  inactiveClientArchiveDays: z.number().int().min(90).max(3650),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const practice = await prisma.practice.findUnique({
      where: { id: session.user.practiceId },
      select: {
        statementRetentionDays: true,
        auditLogRetentionDays: true,
        inactiveClientArchiveDays: true,
      },
    })

    if (!practice) {
      return NextResponse.json(
        { error: "Practice not found." },
        { status: 404 }
      )
    }

    return NextResponse.json(practice)
  } catch (error) {
    console.error("GET /api/settings/data-retention error:", error)
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
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
        { error: "Only administrators can update retention settings." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = retentionSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input"
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const updated = await prisma.practice.update({
      where: { id: session.user.practiceId },
      data: parsed.data,
      select: {
        statementRetentionDays: true,
        auditLogRetentionDays: true,
        inactiveClientArchiveDays: true,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        practiceId: session.user.practiceId,
        action: "RETENTION_SETTINGS_UPDATED",
        entityType: "Practice",
        entityId: session.user.practiceId,
        metadata: parsed.data as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/settings/data-retention error:", error)
    return NextResponse.json(
      { error: "An internal error occurred." },
      { status: 500 }
    )
  }
}
