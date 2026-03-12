import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createLogger } from "@/lib/logger"

const log = createLogger({ module: "api.batch-status" })

const MAX_IDS = 100

// ---------------------------------------------------------------------------
// POST /api/statements/batch-status
//
// Batch polling endpoint — accepts an array of statement IDs and returns
// their processing statuses in a single response. This collapses N individual
// status polls into one request, preventing rate-limit saturation during
// large uploads.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const session = await auth()
    if (!session?.user) {
      log.warn("batch_status_auth_missing", { requestId })
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const body = await request.json()
    const ids: unknown = body?.ids

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array." }, { status: 400 })
    }

    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `Maximum ${MAX_IDS} IDs per request.` }, { status: 400 })
    }

    // Validate all IDs are strings
    const validIds = ids.filter((id): id is string => typeof id === "string")
    if (validIds.length !== ids.length) {
      return NextResponse.json({ error: "All IDs must be strings." }, { status: 400 })
    }

    // Single DB query for all statements
    const statements = await prisma.statement.findMany({
      where: { id: { in: validIds } },
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

    // Filter to only statements belonging to the user's practice
    const practiceId = session.user.practiceId
    const statuses: Record<string, {
      id: string
      processingStatus: string
      processingStartedAt: Date | null
      processingCompletedAt: Date | null
      processingError: string | null
    }> = {}

    for (const stmt of statements) {
      if (stmt.filingYear?.client?.practiceId === practiceId) {
        statuses[stmt.id] = {
          id: stmt.id,
          processingStatus: stmt.processingStatus,
          processingStartedAt: stmt.processingStartedAt,
          processingCompletedAt: stmt.processingCompletedAt,
          processingError: stmt.processingError ?? null,
        }
      }
    }

    log.debug("batch_status_ok", { requestId, requested: validIds.length, returned: Object.keys(statuses).length })
    return NextResponse.json({ statuses })
  } catch (error) {
    log.error("batch_status_error", { requestId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
