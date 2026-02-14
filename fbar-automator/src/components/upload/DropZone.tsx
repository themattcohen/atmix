"use client"

import { useCallback } from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/tiff": [".tif", ".tiff"],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface DropZoneProps {
  onFilesAccepted: (files: File[]) => void
  disabled?: boolean
}

export function DropZone({ onFilesAccepted, disabled = false }: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesAccepted(acceptedFiles)
      }
    },
    [onFilesAccepted]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
          {
            "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50":
              !isDragActive && !isDragReject && !disabled,
            "border-blue-400 bg-blue-50": isDragActive && !isDragReject,
            "border-red-400 bg-red-50": isDragReject,
            "pointer-events-none border-gray-200 bg-gray-50 opacity-60":
              disabled,
          }
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload files by dropping them here or clicking to browse"
        aria-disabled={disabled}
      >
        <input {...getInputProps()} aria-label="File upload input" />

        <div
          className={cn("rounded-full p-3", {
            "bg-gray-100": !isDragActive && !isDragReject,
            "bg-blue-100": isDragActive && !isDragReject,
            "bg-red-100": isDragReject,
          })}
        >
          <Upload
            className={cn("h-8 w-8", {
              "text-gray-400": !isDragActive && !isDragReject,
              "text-blue-500": isDragActive && !isDragReject,
              "text-red-500": isDragReject,
            })}
            aria-hidden="true"
          />
        </div>

        <div className="mt-4 text-center">
          {isDragReject ? (
            <p className="text-sm font-medium text-red-600">
              Some files are not supported
            </p>
          ) : isDragActive ? (
            <p className="text-sm font-medium text-blue-600">
              Drop files here to upload
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-gray-900 underline">Click to upload</span>{" "}
                or drag and drop
              </p>
              <p className="mt-1 text-xs text-gray-500">
                PDF, JPEG, PNG, HEIC, or TIFF up to 50MB each
              </p>
            </>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <RejectionErrors rejections={fileRejections} />
      )}
    </div>
  )
}

function RejectionErrors({ rejections }: { rejections: readonly FileRejection[] }) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 p-3"
      role="alert"
    >
      <p className="text-sm font-medium text-red-800">
        {rejections.length === 1
          ? "1 file was rejected:"
          : `${rejections.length} files were rejected:`}
      </p>
      <ul className="mt-1 list-inside list-disc space-y-1">
        {rejections.map(({ file, errors }) => (
          <li key={file.name} className="text-xs text-red-700">
            <span className="font-medium">{file.name}</span>
            {" \u2014 "}
            {errors.map((e) => formatRejectionError(e.code)).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatRejectionError(code: string): string {
  switch (code) {
    case "file-invalid-type":
      return "unsupported file type"
    case "file-too-large":
      return "exceeds 50MB limit"
    case "file-too-small":
      return "file is too small"
    case "too-many-files":
      return "too many files"
    default:
      return "upload error"
  }
}
