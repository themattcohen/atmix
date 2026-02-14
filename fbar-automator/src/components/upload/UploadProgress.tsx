"use client"

import {
  FileText,
  Image,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface UploadingFile {
  id: string
  name: string
  size: number
  status: "pending" | "uploading" | "processing" | "completed" | "error"
  progress: number
  error?: string
}

interface UploadProgressProps {
  files: UploadingFile[]
}

export function UploadProgress({ files }: UploadProgressProps) {
  if (files.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">
        Upload Progress
      </h3>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {files.map((file) => (
          <FileRow key={file.id} file={file} />
        ))}
      </ul>
    </div>
  )
}

function FileRow({ file }: { file: UploadingFile }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileIcon fileName={file.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-900">
            {file.name}
          </p>
          <StatusBadge status={file.status} />
        </div>

        <div className="mt-1 flex items-center gap-3">
          <div className="flex-1">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuenow={file.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${file.name} upload progress`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  {
                    "bg-gray-300": file.status === "pending",
                    "bg-blue-500": file.status === "uploading",
                    "bg-yellow-500": file.status === "processing",
                    "bg-green-500": file.status === "completed",
                    "bg-red-500": file.status === "error",
                  }
                )}
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {formatFileSize(file.size)}
          </span>
        </div>

        {file.status === "error" && file.error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {file.error}
          </p>
        )}
      </div>
    </li>
  )
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const isImage = ["jpg", "jpeg", "png", "heic", "tif", "tiff"].includes(ext)

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
      {isImage ? (
        <Image className="h-4 w-4 text-gray-500" aria-hidden="true" />
      ) : (
        <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
      )}
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: UploadingFile["status"]
}) {
  const config = {
    pending: {
      label: "Pending",
      classes: "bg-gray-100 text-gray-600",
      icon: null,
    },
    uploading: {
      label: "Uploading",
      classes: "bg-blue-50 text-blue-700",
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    },
    processing: {
      label: "Processing",
      classes: "bg-yellow-50 text-yellow-700",
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    },
    completed: {
      label: "Completed",
      classes: "bg-green-50 text-green-700",
      icon: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
    },
    error: {
      label: "Error",
      classes: "bg-red-50 text-red-700",
      icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
    },
  } as const

  const { label, classes, icon } = config[status]

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        classes
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
