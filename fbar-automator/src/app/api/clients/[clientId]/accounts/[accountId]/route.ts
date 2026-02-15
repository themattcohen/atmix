import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = {
  params: Promise<{ clientId: string; accountId: string }>
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateAccountSchema = z.object({
  accountNumber: z.string().min(1).max(100).optional(),
  accountType: z.enum(["BANK", "SECURITIES", "OTHER"]).optional(),
  accountTypeDescription: z.string().max(255).optional().nullable(),
  institutionName: z.string().min(1).max(255).optional(),
  institutionAddressStreet: z.string().max(255).optional().nullable(),
  institutionAddressCity: z.string().max(255).optional().nullable(),
  institutionAddressState: z.string().max(255).optional().nullable(),
  institutionAddressCountry: z.string().max(255).optional().nullable(),
  institutionAddressPostal: z.string().max(20).optional().nullable(),
  isJointlyOwned: z.boolean().optional(),
  jointOwnerCount: z.number().int().min(0).optional(),
  ownershipType: z
    .enum(["FINANCIAL_INTEREST", "SIGNATURE_AUTHORITY", "BOTH"])
    .optional(),
  isActive: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify ownership chain: account -> client -> practice.
 * Returns the account if authorized, null otherwise.
 */
async function getAuthorizedAccount(
  accountId: string,
  clientId: string,
  practiceId: string
) {
  return prisma.foreignAccount.findFirst({
    where: {
      id: accountId,
      clientId,
      client: { practiceId },
    },
  })
}

/** Mask account number to show only last 4 digits: "1234567890" -> "******7890" */
function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) return null
  if (accountNumber.length <= 4) return "****"
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}

// ---------------------------------------------------------------------------
// GET /api/clients/[clientId]/accounts/[accountId]
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
    const { clientId, accountId } = await context.params

    const account = await getAuthorizedAccount(accountId, clientId, practiceId)
    if (!account) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: account.id,
      clientId: account.clientId,
      accountNumber: maskAccountNumber(account.accountNumber),
      accountType: account.accountType,
      accountTypeDescription: account.accountTypeDescription,
      institutionName: account.institutionName,
      institutionAddressStreet: account.institutionAddressStreet,
      institutionAddressCity: account.institutionAddressCity,
      institutionAddressState: account.institutionAddressState,
      institutionAddressCountry: account.institutionAddressCountry,
      institutionAddressPostal: account.institutionAddressPostal,
      isJointlyOwned: account.isJointlyOwned,
      jointOwnerCount: account.jointOwnerCount,
      ownershipType: account.ownershipType,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })
  } catch (error) {
    console.error(
      "GET /api/clients/[clientId]/accounts/[accountId] error:",
      error
    )
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/clients/[clientId]/accounts/[accountId]
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
    const { clientId, accountId } = await context.params

    const existing = await getAuthorizedAccount(
      accountId,
      clientId,
      practiceId
    )
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found." },
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

    const parsed = updateAccountSchema.safeParse(body)
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
    if (data.accountNumber !== undefined)
      updateData.accountNumber = data.accountNumber
    if (data.accountType !== undefined)
      updateData.accountType = data.accountType
    if (data.accountTypeDescription !== undefined)
      updateData.accountTypeDescription = data.accountTypeDescription
    if (data.institutionName !== undefined)
      updateData.institutionName = data.institutionName
    if (data.institutionAddressStreet !== undefined)
      updateData.institutionAddressStreet = data.institutionAddressStreet
    if (data.institutionAddressCity !== undefined)
      updateData.institutionAddressCity = data.institutionAddressCity
    if (data.institutionAddressState !== undefined)
      updateData.institutionAddressState = data.institutionAddressState
    if (data.institutionAddressCountry !== undefined)
      updateData.institutionAddressCountry = data.institutionAddressCountry
    if (data.institutionAddressPostal !== undefined)
      updateData.institutionAddressPostal = data.institutionAddressPostal
    if (data.isJointlyOwned !== undefined)
      updateData.isJointlyOwned = data.isJointlyOwned
    if (data.jointOwnerCount !== undefined)
      updateData.jointOwnerCount = data.jointOwnerCount
    if (data.ownershipType !== undefined)
      updateData.ownershipType = data.ownershipType
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const [updated] = await prisma.$transaction([
      prisma.foreignAccount.update({
        where: { id: accountId },
        data: updateData,
      }),
      prisma.auditLog.create({
        data: {
          userId,
          practiceId,
          action: "ACCOUNT_UPDATED",
          entityType: "ForeignAccount",
          entityId: accountId,
          metadata: {
            clientId,
            updatedFields: Object.keys(data),
            accountNumber: maskAccountNumber(existing.accountNumber),
          },
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip") ??
            null,
        },
      }),
    ])

    return NextResponse.json({
      id: updated.id,
      clientId: updated.clientId,
      accountNumber: maskAccountNumber(updated.accountNumber),
      accountType: updated.accountType,
      institutionName: updated.institutionName,
      institutionAddressCountry: updated.institutionAddressCountry,
      ownershipType: updated.ownershipType,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    })
  } catch (error) {
    console.error(
      "PUT /api/clients/[clientId]/accounts/[accountId] error:",
      error
    )
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/clients/[clientId]/accounts/[accountId]
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
    const { clientId, accountId } = await context.params

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete accounts." },
        { status: 403 }
      )
    }

    const existing = await getAuthorizedAccount(
      accountId,
      clientId,
      practiceId
    )
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      )
    }

    await prisma.$transaction([
      prisma.foreignAccount.delete({
        where: { id: accountId },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          practiceId,
          action: "ACCOUNT_DELETED",
          entityType: "ForeignAccount",
          entityId: accountId,
          metadata: {
            clientId,
            institutionName: existing.institutionName,
            accountNumber: maskAccountNumber(existing.accountNumber),
          },
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip") ??
            null,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(
      "DELETE /api/clients/[clientId]/accounts/[accountId] error:",
      error
    )
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
