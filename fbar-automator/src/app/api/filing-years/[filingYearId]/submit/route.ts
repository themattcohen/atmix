import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { submitForReview } from "@/lib/approval"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ filingYearId: string }> }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// POST /api/filing-years/[filingYearId]/submit
//
// Transitions a filing from IN_PROGRESS to REVIEWED after verifying all
// active accounts have been reviewed. Delegates to approval.submitForReview.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { id: userId, practiceId } = session.user
    const { filingYearId } = await context.params

    // 2. Validate UUID format for filingYearId
    if (!UUID_REGEX.test(filingYearId)) {
      return NextResponse.json(
        { error: "Invalid filing year ID format." },
        { status: 400 }
      )
    }

    // 3. Verify the filing year belongs to the user's practice
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

    // 4. Call the approval service function
    const updatedFiling = await submitForReview(filingYearId, userId, practiceId)

    // 5. Return the updated filing year
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
    console.error("POST /api/filing-years/[filingYearId]/submit error:", error)

    // Only forward known business-logic error messages to the client.
    // Prisma/DB errors may contain internal details that should not be exposed.
    const KNOWN_PREFIXES = ["Cannot submit", "Cannot approve", "Cannot mark", "Filing year", "User does not"]
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
