import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { enqueueExtraction } from "@/lib/queue"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ statementId: string }> }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a statement and verify it belongs to the authenticated user's practice
 * via the filingYear -> client -> practice ownership chain.
 */
async function getAuthorizedStatement(statementId: string, practiceId: string) {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: {
      extractedData: {
        select: { id: true },
      },
      filingYear: {
        include: {
          client: {
            select: { practiceId: true },
          },
        },
      },
    },
  })

  if (!statement) return null
  if (statement.filingYear.client.practiceId !== practiceId) return null

  return statement
}

// ---------------------------------------------------------------------------
// POST /api/statements/[statementId]/reprocess
//
// Re-queues a statement for LLM extraction. Resets processing state, removes
// any existing extracted data, and enqueues a fresh extraction job. Useful
// when the original extraction failed or produced incorrect results.
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
    const { statementId } = await context.params

    // 2. Verify the statement exists and belongs to the user's practice
    const statement = await getAuthorizedStatement(statementId, practiceId)
    if (!statement) {
      return NextResponse.json(
        { error: "Statement not found." },
        { status: 404 }
      )
    }

    // 3. Prevent reprocessing a statement that is currently being processed
    if (statement.processingStatus === "PROCESSING") {
      return NextResponse.json(
        { error: "Statement is currently being processed. Please wait for it to complete." },
        { status: 409 }
      )
    }

    // 4. Enqueue the extraction job FIRST — before any DB mutations.
    //    If Redis is down, we return 503 without touching the DB,
    //    preserving the statement's existing extracted data.
    try {
      await enqueueExtraction({
        statementId,
        filingYearId: statement.filingYearId,
        practiceId,
        filePath: statement.filePath,
        fileType: statement.fileType,
        pageCount: statement.pageCount ?? undefined,
      })
    } catch (queueError) {
      console.error("Failed to enqueue extraction for reprocess:", queueError)
      return NextResponse.json(
        { error: "Queue unavailable, please try again later." },
        { status: 503 }
      )
    }

    // 5. Enqueue succeeded — now safe to delete existing extracted data
    if (statement.extractedData) {
      await prisma.extractedData.delete({
        where: { id: statement.extractedData.id },
      })
    }

    // 6. Reset processing state on the statement
    //    Guard: skip reset if worker already completed (prevents race condition)
    await prisma.statement.updateMany({
      where: {
        id: statementId,
        processingStatus: { not: "COMPLETED" },
      },
      data: {
        processingStatus: "PENDING",
        processingError: null,
        processingStartedAt: null,
        processingCompletedAt: null,
      },
    })

    // 7. Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "STATEMENT_REPROCESSED",
        entityType: "Statement",
        entityId: statementId,
        metadata: {
          fileName: statement.fileName,
          fileType: statement.fileType,
          filingYearId: statement.filingYearId,
          previousStatus: statement.processingStatus,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip"),
      },
    })

    // 8. Return success
    return NextResponse.json({
      success: true,
      statementId,
    })
  } catch (error) {
    console.error("POST /api/statements/[statementId]/reprocess error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
