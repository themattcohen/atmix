import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createLogger } from "@/lib/logger"

const log = createLogger({ module: "api.status" })

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
  const requestId = crypto.randomUUID()
  try {
    const session = await auth()
    if (!session?.user) {
      const rawParams = await context.params
      log.warn("status_auth_missing", { requestId, statementId: rawParams.statementId })
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
      log.warn("status_not_found", { requestId, statementId })
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    // Verify the statement belongs to the user's practice
    if (!statement.filingYear?.client?.practiceId || statement.filingYear.client.practiceId !== session.user.practiceId) {
      log.warn("status_practice_mismatch", { requestId, statementId })
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    log.debug("status_ok", { requestId, statementId, processingStatus: statement.processingStatus })
    return NextResponse.json({
      id: statement.id,
      processingStatus: statement.processingStatus,
      processingStartedAt: statement.processingStartedAt,
      processingCompletedAt: statement.processingCompletedAt,
      processingError: statement.processingError ?? null,
    })
  } catch (error) {
    log.error("status_error", { requestId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
