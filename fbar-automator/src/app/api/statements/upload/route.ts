import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { processUpload, validateFile } from "@/lib/upload"
import { enqueueExtraction } from "@/lib/queue"
import { createLogger } from "@/lib/logger"

const log = createLogger({ module: "api.upload" })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatementResult {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  processingStatus: string
}

interface UploadError {
  fileName: string
  error: string
}

interface QueueError {
  fileName: string
  statementId: string
  error: string
}

// ---------------------------------------------------------------------------
// POST /api/statements/upload
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const { id: userId, practiceId } = session.user

    // 2. Parse multipart form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "Invalid request. Expected multipart form data." },
        { status: 400 }
      )
    }

    // 3. Validate filingYearId
    const filingYearId = formData.get("filingYearId")
    if (!filingYearId || typeof filingYearId !== "string") {
      return NextResponse.json(
        { error: "filingYearId is required." },
        { status: 400 }
      )
    }

    // 4. Verify the filing year exists and belongs to the user's practice
    const filingYear = await prisma.filingYear.findUnique({
      where: { id: filingYearId },
      include: {
        client: {
          select: { practiceId: true },
        },
      },
    })

    if (!filingYear) {
      return NextResponse.json(
        { error: "Filing year not found." },
        { status: 404 }
      )
    }

    if (filingYear.client.practiceId !== practiceId) {
      return NextResponse.json(
        { error: "Filing year not found." },
        { status: 404 }
      )
    }

    // 5. Check for duplicate filenames
    const existingStatements = await prisma.statement.findMany({
      where: { filingYearId },
      select: { fileName: true },
    })
    const existingNames = new Set(
      existingStatements.map((s) => s.fileName.toLowerCase())
    )

    // 6. Collect files from the form data
    const files = formData.getAll("files")
    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required." },
        { status: 400 }
      )
    }

    // Filter to only File objects (not strings)
    const fileEntries = files.filter((f): f is File => f instanceof File)
    if (fileEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid files found in the request." },
        { status: 400 }
      )
    }

    log.info("batch_start", { fileCount: fileEntries.length, filingYearId })

    // 7. Process each file in parallel
    const uploaded: StatementResult[] = []
    const errors: UploadError[] = []
    const queueErrors: QueueError[] = []

    const results = await Promise.allSettled(
      fileEntries.map(async (file) => {
        // Check for duplicate filename
        if (existingNames.has(file.name.toLowerCase())) {
          return {
            success: false,
            fileName: file.name,
            error: `A file named "${file.name}" has already been uploaded for this filing year.`,
          }
        }

        // 6a. Validate the file before attempting upload
        const validationError = validateFile(file)
        if (validationError) {
          return { success: false, fileName: file.name, error: validationError }
        }

        try {
          // 6b. Upload to S3/MinIO
          const uploadResult = await processUpload(file, practiceId, filingYearId)

          // 6c. Create Statement record
          const statement = await prisma.statement.create({
            data: {
              filingYearId,
              filePath: uploadResult.key,
              fileName: uploadResult.fileName,
              fileType: uploadResult.fileType,
              fileSizeBytes: uploadResult.fileSizeBytes,
              processingStatus: "PENDING",
            },
          })

          // 6d. Enqueue extraction job
          let queued = true
          try {
            await enqueueExtraction({
              statementId: statement.id,
              filingYearId,
              practiceId,
              filePath: uploadResult.key,
              fileType: uploadResult.fileType,
              fileName: uploadResult.fileName,
            })
          } catch (queueError) {
            queued = false
            log.error("enqueue_failed", { fileName: file.name, statementId: statement.id, error: queueError instanceof Error ? queueError.message : String(queueError) })
            queueErrors.push({
              fileName: uploadResult.fileName,
              statementId: statement.id,
              error: "File uploaded successfully but extraction could not be queued. It can be retried later.",
            })
          }

          // 6e. Create audit log entry
          const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
          await prisma.auditLog.create({
            data: {
              userId,
              practiceId,
              action: "STATEMENT_UPLOADED",
              entityType: "Statement",
              entityId: statement.id,
              metadata: {
                fileName: uploadResult.fileName,
                fileType: uploadResult.fileType,
                fileSizeBytes: uploadResult.fileSizeBytes,
                filingYearId,
              },
              ipAddress,
            },
          })

          return {
            success: true,
            result: {
              id: statement.id,
              fileName: statement.fileName,
              fileType: statement.fileType,
              fileSizeBytes: statement.fileSizeBytes,
              processingStatus: statement.processingStatus,
            },
          }
        } catch (fileError) {
          log.error("file_processing_failed", { fileName: file.name, error: fileError instanceof Error ? fileError.message : String(fileError) })
          return {
            success: false,
            fileName: file.name,
            error: fileError instanceof Error ? fileError.message : "An error occurred while processing this file.",
          }
        }
      })
    )

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success && result.value.result) {
          uploaded.push(result.value.result)
        } else if (!result.value.success) {
          errors.push({ fileName: result.value.fileName ?? 'unknown', error: result.value.error ?? 'Processing failed' })
        }
      } else {
        // Promise was rejected (shouldn't happen with our error handling, but just in case)
        errors.push({ fileName: 'unknown', error: result.reason?.message || 'Processing failed' })
      }
    }

    // 8. Return results
    log.info("batch_done", { uploaded: uploaded.length, errors: errors.length, queueErrors: queueErrors.length })
    const status = uploaded.length > 0 ? 200 : 400
    const response: { uploaded: StatementResult[]; errors: UploadError[]; queueErrors?: QueueError[] } = { uploaded, errors }
    if (queueErrors.length > 0) {
      response.queueErrors = queueErrors
    }
    return NextResponse.json(response, { status })
  } catch (error) {
    log.error("upload_route_error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
