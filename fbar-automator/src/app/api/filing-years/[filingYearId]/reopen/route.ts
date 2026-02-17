import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { reopenFiling } from "@/lib/approval"

type RouteContext = { params: Promise<{ filingYearId: string }> }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { id: userId, practiceId, role } = session.user
    const { filingYearId } = await context.params

    // Only ADMINs can reopen filings
    if (role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can reopen filings." },
        { status: 403 }
      )
    }

    if (!UUID_REGEX.test(filingYearId)) {
      return NextResponse.json(
        { error: "Invalid filing year ID format." },
        { status: 400 }
      )
    }

    const filingYear = await prisma.filingYear.findUnique({
      where: { id: filingYearId },
      include: {
        client: {
          select: { practiceId: true },
        },
      },
    })

    if (!filingYear || filingYear.client.practiceId !== practiceId) {
      return NextResponse.json(
        { error: "Filing year not found." },
        { status: 404 }
      )
    }

    const updatedFiling = await reopenFiling(filingYearId, userId, practiceId)

    return NextResponse.json({
      id: updatedFiling.id,
      clientId: updatedFiling.clientId,
      calendarYear: updatedFiling.calendarYear,
      status: updatedFiling.status,
      reviewedById: updatedFiling.reviewedById,
      reviewedAt: updatedFiling.reviewedAt,
      exportedAt: updatedFiling.exportedAt,
      filedAt: updatedFiling.filedAt,
    })
  } catch (error) {
    console.error("POST /api/filing-years/[filingYearId]/reopen error:", error)

    const KNOWN_PREFIXES = ["Cannot reopen", "Cannot submit", "Cannot approve", "Cannot mark", "Filing year", "User does not"]
    if (error instanceof Error && KNOWN_PREFIXES.some((p) => error.message.startsWith(p))) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
