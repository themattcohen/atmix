"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { DropZone } from "@/components/upload/DropZone"
import { UploadProgress, type UploadingFile } from "@/components/upload/UploadProgress"
import { Button } from "@/components/ui/Button"

interface UploadSectionProps {
  clientId: string
  filingYearId: string
  filingYear: string
  existingFileNames?: string[]
}

interface StatementResult {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  processingStatus: string
}

interface UploadResponse {
  uploaded: StatementResult[]
  errors: Array<{ fileName: string; error: string }>
  queueErrors?: string[]
}

interface StatusResponse {
  processingStatus: string
  processingError?: string
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = [3000, 6000, 12000]

export function UploadSection({ clientId, filingYearId, filingYear, existingFileNames = [] }: UploadSectionProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const router = useRouter()
  const pollTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [workerWarning, setWorkerWarning] = useState(false)
  const [queueWarning, setQueueWarning] = useState(false)
  const workerWarningTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadingFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    []
  )

  const pollStatementStatus = useCallback(
    async (statementId: string, uploadId: string, startTime: number, retryCount = 0) => {
      try {
        const response = await fetch(`/api/statements/${statementId}/status`)

        if (!response.ok) {
          const status = response.status

          if (status === 401) {
            updateFile(uploadId, {
              status: "error",
              error: "Session expired. Please refresh and log in again.",
            })
            pollTimersRef.current.delete(uploadId)
            return
          }

          if (status === 429 || status >= 500) {
            if (retryCount < MAX_RETRIES) {
              console.warn(
                `[UploadSection] Status poll retry ${retryCount + 1}/${MAX_RETRIES} for ${statementId} (${status})`
              )
              const delay = RETRY_BACKOFF_MS[retryCount]
              const timer = setTimeout(
                () => pollStatementStatus(statementId, uploadId, startTime, retryCount + 1),
                delay
              )
              pollTimersRef.current.set(uploadId, timer)
              return
            }
            updateFile(uploadId, {
              status: "error",
              error: "Failed to check processing status",
            })
            pollTimersRef.current.delete(uploadId)
            return
          }

          // 404 or other 4xx — permanent failure
          updateFile(uploadId, {
            status: "error",
            error: "Failed to check processing status",
          })
          pollTimersRef.current.delete(uploadId)
          return
        }

        const data: StatusResponse = await response.json()

        if (data.processingStatus === "COMPLETED") {
          updateFile(uploadId, { status: "completed" })
          pollTimersRef.current.delete(uploadId)
          router.refresh()
        } else if (data.processingStatus === "FAILED") {
          updateFile(uploadId, {
            status: "error",
            error: data.processingError || "Extraction failed",
          })
          pollTimersRef.current.delete(uploadId)
        } else if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          updateFile(uploadId, {
            status: "error",
            error: "Processing timeout (5 minutes)",
          })
          pollTimersRef.current.delete(uploadId)
        } else {
          // Still processing — successful response, reset retry count
          const timer = setTimeout(
            () => pollStatementStatus(statementId, uploadId, startTime, 0),
            POLL_INTERVAL_MS
          )
          pollTimersRef.current.set(uploadId, timer)
        }
      } catch (err) {
        // Network error — retry with backoff
        if (retryCount < MAX_RETRIES) {
          console.warn(
            `[UploadSection] Status poll retry ${retryCount + 1}/${MAX_RETRIES} for ${statementId} (network error)`
          )
          const delay = RETRY_BACKOFF_MS[retryCount]
          const timer = setTimeout(
            () => pollStatementStatus(statementId, uploadId, startTime, retryCount + 1),
            delay
          )
          pollTimersRef.current.set(uploadId, timer)
          return
        }
        const message =
          err instanceof Error ? err.message : "Failed to check status"
        updateFile(uploadId, {
          status: "error",
          error: message,
        })
        pollTimersRef.current.delete(uploadId)
      }
    },
    [updateFile, router]
  )

  const uploadFile = useCallback(
    async (file: File, uploadId: string) => {
      updateFile(uploadId, { status: "uploading", progress: 10 })

      const formData = new FormData()
      formData.append("files", file)
      formData.append("filingYearId", filingYearId)

      try {
        updateFile(uploadId, { progress: 30 })

        const response = await fetch("/api/statements/upload", {
          method: "POST",
          body: formData,
        })

        updateFile(uploadId, { progress: 70 })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          const message =
            errorData?.error ?? `Upload failed (${response.status})`
          updateFile(uploadId, {
            status: "error",
            progress: 100,
            error: message,
          })
          return
        }

        const data: UploadResponse = await response.json()

        // Warn if extraction queue is unavailable
        if (data.queueErrors && data.queueErrors.length > 0) {
          setQueueWarning(true)
        }

        if (data.uploaded && data.uploaded.length > 0) {
          const statementId = data.uploaded[0].id
          updateFile(uploadId, { status: "processing", progress: 100 })

          // Start polling for completion
          const startTime = Date.now()
          const timer = setTimeout(
            () => pollStatementStatus(statementId, uploadId, startTime),
            POLL_INTERVAL_MS
          )
          pollTimersRef.current.set(uploadId, timer)
        } else {
          updateFile(uploadId, {
            status: "error",
            progress: 100,
            error: "Upload succeeded but no statement ID returned",
          })
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Network error during upload"
        updateFile(uploadId, {
          status: "error",
          progress: 100,
          error: message,
        })
      }
    },
    [filingYearId, updateFile, pollStatementStatus]
  )

  const handleFilesAccepted = useCallback(
    (acceptedFiles: File[]) => {
      // Check for duplicates against existing statements
      const existingNamesLower = new Set(existingFileNames.map((n) => n.toLowerCase()))
      // Also check against files already in the current upload batch
      const currentNamesLower = new Set(files.map((f) => f.name.toLowerCase()))

      const duplicates: File[] = []
      const uniqueFiles: File[] = []

      for (const file of acceptedFiles) {
        const nameLower = file.name.toLowerCase()
        if (existingNamesLower.has(nameLower) || currentNamesLower.has(nameLower)) {
          duplicates.push(file)
        } else {
          uniqueFiles.push(file)
          currentNamesLower.add(nameLower) // prevent intra-batch duplicates
        }
      }

      // Add duplicate files as immediate errors
      const dupEntries: UploadingFile[] = duplicates.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        status: "error" as const,
        progress: 100,
        error: `"${file.name}" has already been uploaded.`,
      }))

      // Create entries for unique files
      const newFiles: UploadingFile[] = uniqueFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        status: "pending" as const,
        progress: 0,
      }))

      setFiles((prev) => [...prev, ...dupEntries, ...newFiles])

      newFiles.forEach((uploadFile_entry, index) => {
        const file = uniqueFiles[index]
        uploadFile(file, uploadFile_entry.id)
      })
    },
    [uploadFile, existingFileNames, files]
  )

  // Cleanup polling timers on unmount
  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((timer) => clearTimeout(timer))
      pollTimersRef.current.clear()
    }
  }, [])

  // Show worker warning if files are stuck in "processing" for 30+ seconds
  useEffect(() => {
    const hasProcessing = files.some((f) => f.status === "processing")

    if (hasProcessing && !workerWarning) {
      workerWarningTimerRef.current = setTimeout(() => {
        // Re-check if still processing when timer fires
        setWorkerWarning(true)
      }, 30_000)
    } else if (!hasProcessing) {
      setWorkerWarning(false)
      if (workerWarningTimerRef.current) {
        clearTimeout(workerWarningTimerRef.current)
        workerWarningTimerRef.current = null
      }
    }

    return () => {
      if (workerWarningTimerRef.current) {
        clearTimeout(workerWarningTimerRef.current)
      }
    }
  }, [files, workerWarning])

  const isUploading = files.some(
    (f) => f.status === "uploading" || f.status === "pending"
  )

  const counts = {
    uploaded: files.length,
    processing: files.filter((f) => f.status === "processing").length,
    completed: files.filter((f) => f.status === "completed").length,
    errors: files.filter((f) => f.status === "error").length,
  }

  const allDone = files.length > 0 && files.every(
    (f) => f.status === "completed" || f.status === "error"
  )
  const completedCount = counts.completed

  const resetFiles = () => setFiles([])

  return (
    <div className="space-y-6">
      <DropZone onFilesAccepted={handleFilesAccepted} disabled={isUploading} />

      <UploadProgress files={files} />

      {queueWarning && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800">
            <strong>Files uploaded but extraction queue is temporarily unavailable.</strong>{" "}
            Your files are saved. Extraction will begin automatically when the queue recovers.
          </p>
        </div>
      )}

      {workerWarning && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-sm text-yellow-800">
            <strong>Processing is taking longer than expected.</strong>{" "}
            The background worker may be offline. Run{" "}
            <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs font-mono">
              npm run worker
            </code>{" "}
            to start it.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500"
          aria-live="polite"
        >
          <span>{counts.uploaded} file{counts.uploaded !== 1 ? "s" : ""} uploaded</span>
          {counts.processing > 0 && (
            <span className="text-yellow-600">
              {counts.processing} processing
            </span>
          )}
          {counts.completed > 0 && (
            <span className="text-green-600">
              {counts.completed} completed
            </span>
          )}
          {counts.errors > 0 && (
            <span className="text-red-600">
              {counts.errors} error{counts.errors !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {allDone && completedCount > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">
            {completedCount} statement{completedCount !== 1 ? "s" : ""} processed successfully
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            Review extracted data to verify accuracy before approving.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Link href={`/clients/${clientId}/${filingYear}/review`}>
              <Button variant="default" size="sm">Proceed to Review</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={resetFiles}>
              Upload More Files
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
