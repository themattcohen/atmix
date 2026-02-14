import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { encrypt, safeDecrypt } from "@/lib/encryption"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ clientId: string }> }

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateClientSchema = z.object({
  type: z.enum(["INDIVIDUAL", "ENTITY"]).optional(),
  lastName: z.string().min(1).max(255).optional(),
  firstName: z.string().max(255).optional().nullable(),
  tin: z.string().max(20).optional().nullable(),
  tinType: z.enum(["SSN", "ITIN", "EIN", "FOREIGN_TIN"]).optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  usAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip: z.string().max(10).optional(),
    })
    .optional()
    .nullable(),
  mailingAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip: z.string().max(10).optional(),
    })
    .optional()
    .nullable(),
  spouseClientId: z.string().uuid().optional().nullable(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskTIN(tin: string | null): string | null {
  if (!tin) return null
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return `***-**-${digits.slice(-4)}`
}

async function getAuthorizedClient(clientId: string, practiceId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, practiceId },
  })
}

// ---------------------------------------------------------------------------
// GET /api/clients/[clientId]
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { practiceId } = session.user
    const { clientId } = await context.params

    const client = await prisma.client.findFirst({
      where: { id: clientId, practiceId },
      include: {
        foreignAccounts: {
          where: { isActive: true },
          orderBy: { institutionName: "asc" },
        },
        filingYears: {
          orderBy: { calendarYear: "desc" },
          include: {
            _count: {
              select: {
                statements: true,
                reviewedAccountYears: true,
              },
            },
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: client.id,
      type: client.type,
      lastName: client.lastName,
      firstName: client.firstName,
      tin: maskTIN(client.tin ? safeDecrypt(client.tin) : null),
      tinType: client.tinType,
      dateOfBirth: client.dateOfBirth,
      usAddress: client.usAddress,
      mailingAddress: client.mailingAddress,
      spouseClientId: client.spouseClientId,
      foreignAccounts: client.foreignAccounts.map((fa) => ({
        id: fa.id,
        accountNumber: fa.accountNumber,
        accountType: fa.accountType,
        accountTypeDescription: fa.accountTypeDescription,
        institutionName: fa.institutionName,
        institutionAddressCountry: fa.institutionAddressCountry,
        ownershipType: fa.ownershipType,
        isJointlyOwned: fa.isJointlyOwned,
        isActive: fa.isActive,
      })),
      filingYears: client.filingYears.map((fy) => ({
        id: fy.id,
        calendarYear: fy.calendarYear,
        status: fy.status,
        filingType: fy.filingType,
        statementsCount: fy._count.statements,
        reviewedAccountsCount: fy._count.reviewedAccountYears,
        createdAt: fy.createdAt,
      })),
      createdAt: client.createdAt,
    })
  } catch (error) {
    console.error("GET /api/clients/[clientId] error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/clients/[clientId]
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { id: userId, practiceId } = session.user
    const { clientId } = await context.params

    const existing = await getAuthorizedClient(clientId, practiceId)
    if (!existing) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
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

    const parsed = updateClientSchema.safeParse(body)
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
    const updateData: Record<string, unknown> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.tin !== undefined) updateData.tin = data.tin ? encrypt(data.tin) : null
    if (data.tinType !== undefined) updateData.tinType = data.tinType
    if (data.dateOfBirth !== undefined)
      updateData.dateOfBirth = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : null
    if (data.usAddress !== undefined) updateData.usAddress = data.usAddress
    if (data.mailingAddress !== undefined)
      updateData.mailingAddress = data.mailingAddress
    if (data.spouseClientId !== undefined)
      updateData.spouseClientId = data.spouseClientId

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    })

    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "CLIENT_UPDATED",
        entityType: "Client",
        entityId: clientId,
        metadata: {
          updatedFields: Object.keys(data),
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      },
    }).catch(console.error)

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      lastName: updated.lastName,
      firstName: updated.firstName,
      tin: maskTIN(updated.tin ? safeDecrypt(updated.tin) : null),
      tinType: updated.tinType,
      dateOfBirth: updated.dateOfBirth,
      usAddress: updated.usAddress,
      mailingAddress: updated.mailingAddress,
      updatedAt: updated.updatedAt,
    })
  } catch (error) {
    console.error("PUT /api/clients/[clientId] error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/clients/[clientId]
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { id: userId, practiceId } = session.user
    const { clientId } = await context.params

    const existing = await getAuthorizedClient(clientId, practiceId)
    if (!existing) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      )
    }

    // Hard delete with cascade (Prisma schema has onDelete: Cascade for
    // foreignAccounts and filingYears)
    await prisma.client.delete({
      where: { id: clientId },
    })

    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "CLIENT_DELETED",
        entityType: "Client",
        entityId: clientId,
        metadata: {
          lastName: existing.lastName,
          firstName: existing.firstName,
          type: existing.type,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      },
    }).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/clients/[clientId] error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
