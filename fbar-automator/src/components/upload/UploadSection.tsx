"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { DropZone } from "@/components/upload/DropZone"
import { UploadProgress, type UploadingFile } from "@/components/upload/UploadProgress"

interface UploadSectionProps {
  clientId: string
  filingYearId: string
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
}

interface StatusResponse {
  processingStatus: string
  processingError?: string
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function UploadSection({ clientId, filingYearId }: UploadSectionProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const router = useRouter()
  const pollTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadingFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    []
  )

  const pollStatementStatus = useCallback(
    async (statementId: string, uploadId: string, startTime: number) => {
      try {
        const response = await fetch(`/api/statements/${statementId}/status`)

        if (!response.ok) {
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
          // Still processing, continue polling
          const timer = setTimeout(
            () => pollStatementStatus(statementId, uploadId, startTime),
            POLL_INTERVAL_MS
          )
          pollTimersRef.current.set(uploadId, timer)
        }
      } catch (err) {
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
      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        status: "pending" as const,
        progress: 0,
      }))

      setFiles((prev) => [...prev, ...newFiles])

      newFiles.forEach((uploadFile_entry, index) => {
        const file = acceptedFiles[index]
        uploadFile(file, uploadFile_entry.id)
      })
    },
    [uploadFile]
  )

  // Cleanup polling timers on unmount
  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((timer) => clearTimeout(timer))
      pollTimersRef.current.clear()
    }
  }, [])

  const isUploading = files.some(
    (f) => f.status === "uploading" || f.status === "pending"
  )

  const counts = {
    uploaded: files.length,
    processing: files.filter((f) => f.status === "processing").length,
    completed: files.filter((f) => f.status === "completed").length,
    errors: files.filter((f) => f.status === "error").length,
  }

  return (
    <div className="space-y-6">
      <DropZone onFilesAccepted={handleFilesAccepted} disabled={isUploading} />

      <UploadProgress files={files} />

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
    </div>
  )
}
