import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ statementId: string }> }

/**
 * Fetch a statement and verify it belongs to the authenticated user's practice.
 * Returns the statement or null if not found / not authorized.
 */
async function getAuthorizedStatement(statementId: string, practiceId: string) {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: {
      extractedData: true,
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
  if (!statement.filingYear?.client?.practiceId) return null
  if (statement.filingYear.client.practiceId !== practiceId) return null

  return statement
}

// ---------------------------------------------------------------------------
// GET /api/statements/[statementId]
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const { statementId } = await context.params
    const statement = await getAuthorizedStatement(statementId, session.user.practiceId)

    if (!statement) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    // Build extracted data summary if available
    const extractedSummary = statement.extractedData
      ? {
          id: statement.extractedData.id,
          bankName: statement.extractedData.bankName,
          accountNumber: statement.extractedData.accountNumber,
          accountTypeDetected: statement.extractedData.accountTypeDetected,
          currencyCode: statement.extractedData.currencyCode,
          maxBalanceLocal: statement.extractedData.maxBalanceLocal?.toString() ?? null,
          maxBalanceDate: statement.extractedData.maxBalanceDate,
          statementPeriodStart: statement.extractedData.statementPeriodStart,
          statementPeriodEnd: statement.extractedData.statementPeriodEnd,
          confidenceScores: statement.extractedData.confidenceScores,
          extractionWarnings: statement.extractedData.extractionWarnings,
        }
      : null

    return NextResponse.json({
      id: statement.id,
      filingYearId: statement.filingYearId,
      foreignAccountId: statement.foreignAccountId,
      fileName: statement.fileName,
      fileType: statement.fileType,
      fileSizeBytes: statement.fileSizeBytes,
      pageCount: statement.pageCount,
      processingStatus: statement.processingStatus,
      processingStartedAt: statement.processingStartedAt,
      processingCompletedAt: statement.processingCompletedAt,
      processingError: statement.processingError,
      llmModelUsed: statement.llmModelUsed,
      llmTokensUsed: statement.llmTokensUsed,
      createdAt: statement.createdAt,
      extractedData: extractedSummary,
    })
  } catch (error) {
    console.error("GET /api/statements/[statementId] error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/statements/[statementId]
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const { id: userId, practiceId } = session.user
    const { statementId } = await context.params

    const statement = await getAuthorizedStatement(statementId, practiceId)

    if (!statement) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 })
    }

    // Prevent deletion of statements currently being processed
    if (statement.processingStatus === "PROCESSING") {
      return NextResponse.json(
        { error: "Cannot delete a statement that is currently being processed." },
        { status: 409 }
      )
    }

    // Delete the file from S3/MinIO
    try {
      await deleteFile(statement.filePath)
    } catch (s3Error) {
      // Log but do not block deletion -- the DB record should still be removed
      // to avoid orphaned references. The S3 object can be cleaned up later.
      console.error(`Failed to delete S3 object "${statement.filePath}":`, s3Error)
    }

    // Delete the Statement record (cascades to ExtractedData via Prisma schema)
    await prisma.statement.delete({
      where: { id: statementId },
    })

    // Create audit log entry
    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "STATEMENT_DELETED",
        entityType: "Statement",
        entityId: statementId,
        metadata: {
          fileName: statement.fileName,
          fileType: statement.fileType,
          fileSizeBytes: statement.fileSizeBytes,
          filingYearId: statement.filingYearId,
        },
        ipAddress,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/statements/[statementId] error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
