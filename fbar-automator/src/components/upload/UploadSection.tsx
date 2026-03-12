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
  onActiveChange?: (isActive: boolean) => void
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

interface BatchStatusResponse {
  statuses: Record<string, {
    processingStatus: string
    processingError?: string | null
  }>
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const BATCH_POLL_MAX_RETRIES = 3
const BATCH_POLL_RETRY_MS = [3000, 6000, 12000]
const UPLOAD_MAX_RETRIES = 5
const UPLOAD_RETRY_BASE_MS = 5000 // 5s base, doubles each attempt

export function UploadSection({ clientId, filingYearId, filingYear, existingFileNames = [], onActiveChange }: UploadSectionProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const router = useRouter()
  const [workerWarning, setWorkerWarning] = useState(false)
  const [queueWarning, setQueueWarning] = useState(false)
  const workerWarningTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Batch polling state: maps uploadId → { statementId, startTime }
  const pollMapRef = useRef<Map<string, { statementId: string; startTime: number }>>(new Map())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollRetryCountRef = useRef(0)

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadingFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    []
  )

  // Single batch poll tick — called every POLL_INTERVAL_MS
  const batchPollTick = useCallback(async () => {
    const entries = Array.from(pollMapRef.current.entries())
    if (entries.length === 0) {
      // Nothing left to poll — stop the interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const idMap: Record<string, string> = {} // statementId → uploadId
    const statementIds: string[] = []
    const now = Date.now()

    for (const [uploadId, { statementId, startTime }] of entries) {
      // Check timeout before even polling
      if (now - startTime > POLL_TIMEOUT_MS) {
        updateFile(uploadId, {
          status: "error",
          error: "Processing timeout (5 minutes)",
        })
        pollMapRef.current.delete(uploadId)
        continue
      }
      idMap[statementId] = uploadId
      statementIds.push(statementId)
    }

    if (statementIds.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    try {
      const response = await fetch("/api/statements/batch-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: statementIds }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired — mark all as error and stop
          for (const uploadId of Object.values(idMap)) {
            updateFile(uploadId, {
              status: "error",
              error: "Session expired. Please refresh and log in again.",
            })
            pollMapRef.current.delete(uploadId)
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          return
        }

        // 429 or 5xx — retry with backoff
        if (response.status === 429 || response.status >= 500) {
          if (pollRetryCountRef.current < BATCH_POLL_MAX_RETRIES) {
            console.warn(
              `[UploadSection] Batch status poll retry ${pollRetryCountRef.current + 1}/${BATCH_POLL_MAX_RETRIES} (${response.status})`
            )
            pollRetryCountRef.current++
            return // interval will fire again
          }
          // Retries exhausted — mark all as error
          for (const uploadId of Object.values(idMap)) {
            updateFile(uploadId, {
              status: "error",
              error: "Failed to check processing status",
            })
            pollMapRef.current.delete(uploadId)
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          return
        }

        // Other error — mark all as error
        for (const uploadId of Object.values(idMap)) {
          updateFile(uploadId, {
            status: "error",
            error: "Failed to check processing status",
          })
          pollMapRef.current.delete(uploadId)
        }
        return
      }

      // Success — reset retry counter
      pollRetryCountRef.current = 0

      const data: BatchStatusResponse = await response.json()
      let anyCompleted = false

      for (const [statementId, uploadId] of Object.entries(idMap)) {
        const status = data.statuses[statementId]
        if (!status) continue // Not returned — still processing or not found

        if (status.processingStatus === "COMPLETED") {
          updateFile(uploadId, { status: "completed" })
          pollMapRef.current.delete(uploadId)
          anyCompleted = true
        } else if (status.processingStatus === "FAILED") {
          updateFile(uploadId, {
            status: "error",
            error: status.processingError || "Extraction failed",
          })
          pollMapRef.current.delete(uploadId)
        }
        // else still processing — leave in pollMap for next tick
      }

      if (anyCompleted) {
        router.refresh()
      }

      // If nothing left to poll, stop the interval
      if (pollMapRef.current.size === 0 && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    } catch (err) {
      // Network error — retry
      if (pollRetryCountRef.current < BATCH_POLL_MAX_RETRIES) {
        console.warn(
          `[UploadSection] Batch status poll retry ${pollRetryCountRef.current + 1}/${BATCH_POLL_MAX_RETRIES} (network error)`
        )
        pollRetryCountRef.current++
        return
      }
      // Retries exhausted
      const message = err instanceof Error ? err.message : "Failed to check status"
      for (const uploadId of Object.values(idMap)) {
        updateFile(uploadId, { status: "error", error: message })
        pollMapRef.current.delete(uploadId)
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [updateFile, router])

  // Register a statement for batch polling and ensure interval is running
  const startPolling = useCallback(
    (statementId: string, uploadId: string) => {
      pollMapRef.current.set(uploadId, { statementId, startTime: Date.now() })

      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(batchPollTick, POLL_INTERVAL_MS)
      }
    },
    [batchPollTick]
  )

  const uploadFile = useCallback(
    async (file: File, uploadId: string) => {
      const formData = new FormData()
      formData.append("files", file)
      formData.append("filingYearId", filingYearId)

      let skipNextDelay = false

      for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
        if (attempt > 0 && !skipNextDelay) {
          // Show as pending while waiting to retry (not error)
          updateFile(uploadId, { status: "pending", progress: 0 })
          const delay = UPLOAD_RETRY_BASE_MS * Math.pow(2, attempt - 1)
          console.warn(
            `[UploadSection] Upload retry ${attempt}/${UPLOAD_MAX_RETRIES} for "${file.name}" in ${delay}ms`
          )
          await new Promise((r) => setTimeout(r, delay))
        }
        skipNextDelay = false

        updateFile(uploadId, { status: "uploading", progress: 10 })

        let response: Response
        try {
          updateFile(uploadId, { progress: 30 })
          response = await fetch("/api/statements/upload", {
            method: "POST",
            body: formData,
          })
        } catch (err) {
          // Network error — retry if attempts remain
          if (attempt < UPLOAD_MAX_RETRIES) continue
          const message =
            err instanceof Error ? err.message : "Network error during upload"
          updateFile(uploadId, {
            status: "error",
            progress: 100,
            error: message,
          })
          return
        }

        updateFile(uploadId, { progress: 70 })

        if (response.ok) {
          const data: UploadResponse = await response.json()

          // Warn if extraction queue is unavailable
          if (data.queueErrors && data.queueErrors.length > 0) {
            setQueueWarning(true)
          }

          if (data.uploaded && data.uploaded.length > 0) {
            const statementId = data.uploaded[0].id
            updateFile(uploadId, { status: "processing", progress: 100 })
            startPolling(statementId, uploadId)
          } else {
            updateFile(uploadId, {
              status: "error",
              progress: 100,
              error: "Upload succeeded but no statement ID returned",
            })
          }
          return
        }

        // 429 — retry if attempts remain, respect Retry-After header
        if (response.status === 429 && attempt < UPLOAD_MAX_RETRIES) {
          const retryAfterHeader = response.headers.get("Retry-After")
          if (retryAfterHeader) {
            const retrySeconds = parseInt(retryAfterHeader, 10)
            if (!isNaN(retrySeconds) && retrySeconds > 0) {
              updateFile(uploadId, { status: "pending", progress: 0 })
              console.warn(
                `[UploadSection] 429 Retry-After ${retrySeconds}s for "${file.name}"`
              )
              await new Promise((r) => setTimeout(r, retrySeconds * 1000))
              // Already waited — skip the exponential backoff at top of loop
              skipNextDelay = true
            }
          }
          continue
        }

        // Permanent error (non-429 or retries exhausted)
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
    },
    [filingYearId, updateFile, startPolling]
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

      // Concurrency-limited upload: max 3 in-flight at a time to avoid
      // overwhelming the server and triggering 429 rate limits on Claude API.
      const UPLOAD_CONCURRENCY = 3
      let running = 0
      let nextIndex = 0

      const startNext = () => {
        while (running < UPLOAD_CONCURRENCY && nextIndex < newFiles.length) {
          const idx = nextIndex++
          running++
          uploadFile(uniqueFiles[idx], newFiles[idx].id).finally(() => {
            running--
            startNext()
          })
        }
      }
      startNext()
    },
    [uploadFile, existingFileNames, files]
  )

  // Cleanup batch polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      pollMapRef.current.clear()
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

  const isActive = files.some(
    (f) => f.status === "uploading" || f.status === "pending" || f.status === "processing"
  )

  const isUploading = files.some(
    (f) => f.status === "uploading" || f.status === "pending"
  )

  // Notify parent of active state changes
  useEffect(() => {
    onActiveChange?.(isActive)
  }, [isActive, onActiveChange])

  // Warn on browser close/refresh while active
  useEffect(() => {
    if (!isActive) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isActive])

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
