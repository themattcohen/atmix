import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ clientId: string }> }

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createAccountSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required").max(100),
  accountType: z.enum(["BANK", "SECURITIES", "OTHER"]),
  accountTypeDescription: z.string().max(255).optional().nullable(),
  institutionName: z.string().min(1, "Institution name is required").max(255),
  institutionAddressStreet: z.string().max(255).optional().nullable(),
  institutionAddressCity: z.string().max(255).optional().nullable(),
  institutionAddressState: z.string().max(255).optional().nullable(),
  institutionAddressCountry: z.string().max(255).optional().nullable(),
  institutionAddressPostal: z.string().max(20).optional().nullable(),
  isJointlyOwned: z.boolean().optional().default(false),
  jointOwnerCount: z.number().int().min(0).optional().default(0),
  ownershipType: z.enum(["FINANCIAL_INTEREST", "SIGNATURE_AUTHORITY", "BOTH"]),
  isActive: z.boolean().optional().default(true),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthorizedClient(clientId: string, practiceId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, practiceId },
    select: { id: true, practiceId: true },
  })
}

/** Mask account number to show only last 4 digits: "1234567890" -> "******7890" */
function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) return null
  if (accountNumber.length <= 4) return "****"
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
}

// ---------------------------------------------------------------------------
// GET /api/clients/[clientId]/accounts
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

    const client = await getAuthorizedClient(clientId, practiceId)
    if (!client) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      )
    }

    const accounts = await prisma.foreignAccount.findMany({
      where: { clientId },
      orderBy: [{ isActive: "desc" }, { institutionName: "asc" }],
    })

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        accountNumber: maskAccountNumber(a.accountNumber),
        accountType: a.accountType,
        accountTypeDescription: a.accountTypeDescription,
        institutionName: a.institutionName,
        institutionAddressStreet: a.institutionAddressStreet,
        institutionAddressCity: a.institutionAddressCity,
        institutionAddressState: a.institutionAddressState,
        institutionAddressCountry: a.institutionAddressCountry,
        institutionAddressPostal: a.institutionAddressPostal,
        isJointlyOwned: a.isJointlyOwned,
        jointOwnerCount: a.jointOwnerCount,
        ownershipType: a.ownershipType,
        isActive: a.isActive,
        createdAt: a.createdAt,
      })),
    })
  } catch (error) {
    console.error("GET /api/clients/[clientId]/accounts error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/clients/[clientId]/accounts
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
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

    const client = await getAuthorizedClient(clientId, practiceId)
    if (!client) {
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

    const parsed = createAccountSchema.safeParse(body)
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

    const account = await prisma.foreignAccount.create({
      data: {
        clientId,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        accountTypeDescription: data.accountTypeDescription ?? null,
        institutionName: data.institutionName,
        institutionAddressStreet: data.institutionAddressStreet ?? null,
        institutionAddressCity: data.institutionAddressCity ?? null,
        institutionAddressState: data.institutionAddressState ?? null,
        institutionAddressCountry: data.institutionAddressCountry ?? null,
        institutionAddressPostal: data.institutionAddressPostal ?? null,
        isJointlyOwned: data.isJointlyOwned,
        jointOwnerCount: data.jointOwnerCount,
        ownershipType: data.ownershipType,
        isActive: data.isActive,
      },
    })

    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "ACCOUNT_CREATED",
        entityType: "ForeignAccount",
        entityId: account.id,
        metadata: {
          clientId,
          institutionName: account.institutionName,
          accountType: account.accountType,
          country: account.institutionAddressCountry,
          accountNumber: maskAccountNumber(account.accountNumber),
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      },
    }).catch(console.error)

    return NextResponse.json(
      {
        id: account.id,
        clientId: account.clientId,
        accountNumber: maskAccountNumber(account.accountNumber),
        accountType: account.accountType,
        institutionName: account.institutionName,
        institutionAddressCountry: account.institutionAddressCountry,
        ownershipType: account.ownershipType,
        isActive: account.isActive,
        createdAt: account.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/clients/[clientId]/accounts error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
