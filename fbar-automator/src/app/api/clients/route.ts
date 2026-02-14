import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { encrypt, safeDecrypt } from "@/lib/encryption"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createClientSchema = z.object({
  type: z.enum(["INDIVIDUAL", "ENTITY"]),
  lastName: z.string().min(1, "Last name is required").max(255),
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

/** Mask a TIN to show only the last 4 digits: "123456789" -> "***-**-6789" */
function maskTIN(tin: string | null): string | null {
  if (!tin) return null
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return `***-**-${digits.slice(-4)}`
}

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { practiceId } = session.user
    const search = request.nextUrl.searchParams.get("search")
    const page = Math.max(parseInt(request.nextUrl.searchParams.get("page") || "1", 10), 1)
    const pageSize = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("pageSize") || "20", 10), 1), 100)

    const where = {
      practiceId,
      ...(search
        ? {
            OR: [
              { lastName: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          _count: {
            select: { foreignAccounts: true },
          },
          filingYears: {
            orderBy: { calendarYear: "desc" },
            take: 1,
            select: {
              id: true,
              calendarYear: true,
              status: true,
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.client.count({ where }),
    ])

    const result = clients.map((client) => ({
      id: client.id,
      type: client.type,
      lastName: client.lastName,
      firstName: client.firstName,
      tin: maskTIN(client.tin ? safeDecrypt(client.tin) : null),
      tinType: client.tinType,
      accountCount: client._count.foreignAccounts,
      latestFilingYear: client.filingYears[0] ?? null,
      createdAt: client.createdAt,
    }))

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      clients: result,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error("GET /api/clients error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/clients
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

    const { id: userId, practiceId } = session.user

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const parsed = createClientSchema.safeParse(body)
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

    const client = await prisma.client.create({
      data: {
        practiceId,
        type: data.type,
        lastName: data.lastName,
        firstName: data.firstName ?? null,
        tin: data.tin ? encrypt(data.tin) : null,
        tinType: data.tinType ?? null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        usAddress: data.usAddress ?? undefined,
        mailingAddress: data.mailingAddress ?? undefined,
        spouseClientId: data.spouseClientId ?? null,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "CLIENT_CREATED",
        entityType: "Client",
        entityId: client.id,
        metadata: {
          type: client.type,
          lastName: client.lastName,
          firstName: client.firstName,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      },
    })

    return NextResponse.json(
      {
        id: client.id,
        type: client.type,
        lastName: client.lastName,
        firstName: client.firstName,
        tin: maskTIN(client.tin ? safeDecrypt(client.tin) : null),
        tinType: client.tinType,
        createdAt: client.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/clients error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
