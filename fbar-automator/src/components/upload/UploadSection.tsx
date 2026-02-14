"use client"

import { useState, useCallback } from "react"
import { DropZone } from "@/components/upload/DropZone"
import { UploadProgress, type UploadingFile } from "@/components/upload/UploadProgress"

interface UploadSectionProps {
  clientId: string
  filingYearId: string
}

export function UploadSection({ clientId, filingYearId }: UploadSectionProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadingFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      )
    },
    []
  )

  const uploadFile = useCallback(
    async (file: File, uploadId: string) => {
      updateFile(uploadId, { status: "uploading", progress: 10 })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("filingYearId", filingYearId)
      formData.append("clientId", clientId)

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

        updateFile(uploadId, { status: "processing", progress: 100 })
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
    [clientId, filingYearId, updateFile]
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
