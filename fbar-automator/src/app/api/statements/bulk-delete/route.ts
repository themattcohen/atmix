import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"

// ---------------------------------------------------------------------------
// POST /api/statements/bulk-delete
//
// Deletes multiple statements in one request. Admin-only.
// Body: { statementIds: string[] }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete statements." },
        { status: 403 }
      )
    }

    const { id: userId, practiceId } = session.user
    const body = await request.json()
    const { statementIds } = body

    if (!Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json(
        { error: "statementIds must be a non-empty array." },
        { status: 400 }
      )
    }

    if (statementIds.length > 100) {
      return NextResponse.json(
        { error: "Cannot delete more than 100 statements at once." },
        { status: 400 }
      )
    }

    // Fetch all statements and verify ownership
    const statements = await prisma.statement.findMany({
      where: { id: { in: statementIds } },
      include: {
        filingYear: {
          include: {
            client: {
              select: { practiceId: true },
            },
          },
        },
      },
    })

    // Verify all belong to user's practice
    const unauthorized = statements.filter(
      (s) => s.filingYear?.client?.practiceId !== practiceId
    )
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: "One or more statements not found." },
        { status: 404 }
      )
    }

    // Check if any not found
    if (statements.length !== statementIds.length) {
      return NextResponse.json(
        { error: "One or more statements not found." },
        { status: 404 }
      )
    }

    // Reject if any are currently processing
    const processing = statements.filter((s) => s.processingStatus === "PROCESSING")
    if (processing.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete statements that are currently being processed.",
          processingIds: processing.map((s) => s.id),
        },
        { status: 409 }
      )
    }

    // Delete S3 files (log errors but don't block)
    const s3Errors: Array<{ id: string; error: string }> = []
    await Promise.all(
      statements.map(async (s) => {
        try {
          await deleteFile(s.filePath)
        } catch (err) {
          console.error(
            `Failed to delete S3 object "${s.filePath}" for statement ${s.id}:`,
            err
          )
          s3Errors.push({ id: s.id, error: "Failed to delete file from storage" })
        }
      })
    )

    // Delete DB records + create audit logs in a transaction
    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
    await prisma.$transaction([
      prisma.statement.deleteMany({
        where: { id: { in: statementIds } },
      }),
      ...statements.map((s) =>
        prisma.auditLog.create({
          data: {
            userId,
            practiceId,
            action: "STATEMENT_DELETED",
            entityType: "Statement",
            entityId: s.id,
            metadata: {
              fileName: s.fileName,
              fileType: s.fileType,
              fileSizeBytes: s.fileSizeBytes,
              filingYearId: s.filingYearId,
              bulkDelete: true,
            },
            ipAddress,
          },
        })
      ),
    ])

    return NextResponse.json({
      deleted: statements.length,
      errors: s3Errors,
    })
  } catch (error) {
    console.error("POST /api/statements/bulk-delete error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
