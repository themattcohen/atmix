import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ statementId: string }> }

// ---------------------------------------------------------------------------
// GET /api/statements/[statementId]/status
//
// Lightweight polling endpoint for the UI to check extraction progress.
// Returns only the processing-related fields to minimize payload size.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const { statementId } = await context.params

    // Fetch only the fields needed for status polling, plus the ownership chain
    const statement = await prisma.statement.findUnique({
      where: { id: statementId },
      select: {
        id: true,
        processingStatus: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        processingError: true,
        filingYear: {
          select: {
            client: {
              select: { practiceId: true },
            },
          },
        },
      },
    })

    if (!statement) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    // Verify the statement belongs to the user's practice
    if (!statement.filingYear?.client?.practiceId || statement.filingYear.client.practiceId !== session.user.practiceId) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    return NextResponse.json({
      id: statement.id,
      processingStatus: statement.processingStatus,
      processingStartedAt: statement.processingStartedAt,
      processingCompletedAt: statement.processingCompletedAt,
      processingError: statement.processingError,
    })
  } catch (error) {
    console.error("GET /api/statements/[statementId]/status error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
