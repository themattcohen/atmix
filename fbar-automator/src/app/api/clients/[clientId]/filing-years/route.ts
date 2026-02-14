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

const createFilingYearSchema = z.object({
  calendarYear: z
    .number()
    .int()
    .min(2000, "Calendar year must be 2000 or later")
    .max(2099, "Calendar year must be 2099 or earlier"),
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

// ---------------------------------------------------------------------------
// GET /api/clients/[clientId]/filing-years
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

    const filingYears = await prisma.filingYear.findMany({
      where: { clientId },
      orderBy: { calendarYear: "desc" },
      include: {
        _count: {
          select: {
            statements: true,
            reviewedAccountYears: true,
          },
        },
      },
    })

    return NextResponse.json({
      filingYears: filingYears.map((fy) => ({
        id: fy.id,
        clientId: fy.clientId,
        calendarYear: fy.calendarYear,
        status: fy.status,
        filingType: fy.filingType,
        has25PlusAccounts: fy.has25PlusAccounts,
        assignedPreparerId: fy.assignedPreparerId,
        reviewedById: fy.reviewedById,
        reviewedAt: fy.reviewedAt,
        exportedAt: fy.exportedAt,
        filedAt: fy.filedAt,
        statementsCount: fy._count.statements,
        reviewedAccountsCount: fy._count.reviewedAccountYears,
        createdAt: fy.createdAt,
      })),
    })
  } catch (error) {
    console.error("GET /api/clients/[clientId]/filing-years error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/clients/[clientId]/filing-years
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

    const parsed = createFilingYearSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { calendarYear } = parsed.data

    // Check unique constraint: only one filing year per client per year
    const existing = await prisma.filingYear.findUnique({
      where: {
        clientId_calendarYear: {
          clientId,
          calendarYear,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: `Filing year ${calendarYear} already exists for this client.`,
        },
        { status: 409 }
      )
    }

    const filingYear = await prisma.filingYear.create({
      data: {
        clientId,
        calendarYear,
        status: "NOT_STARTED",
        filingType: "ORIGINAL",
        assignedPreparerId: userId,
      },
    })

    prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FILING_YEAR_CREATED",
        entityType: "FilingYear",
        entityId: filingYear.id,
        metadata: {
          clientId,
          calendarYear,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
      },
    }).catch(console.error)

    return NextResponse.json(
      {
        id: filingYear.id,
        clientId: filingYear.clientId,
        calendarYear: filingYear.calendarYear,
        status: filingYear.status,
        filingType: filingYear.filingType,
        createdAt: filingYear.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/clients/[clientId]/filing-years error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
