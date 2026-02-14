"use client"

import Link from "next/link"
import { FileText, Image, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export interface StatementSummary {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  createdAt: string
  extractedAccountCount?: number
}

interface FileListProps {
  statements: StatementSummary[]
}

export function FileList({ statements }: FileListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploaded Statements</CardTitle>
      </CardHeader>
      <CardContent>
        {statements.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    File Name
                  </th>
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    Accounts Found
                  </th>
                  <th
                    scope="col"
                    className="pb-3 pr-4 font-medium text-gray-500"
                  >
                    Uploaded
                  </th>
                  <th
                    scope="col"
                    className="pb-3 font-medium text-gray-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((statement) => (
                  <StatementRow key={statement.id} statement={statement} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatementRow({ statement }: { statement: StatementSummary }) {
  const isImage = ["image/jpeg", "image/png", "image/heic", "image/tiff"].includes(
    statement.fileType
  )

  return (
    <tr className="group">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
            {isImage ? (
              <Image className="h-4 w-4 text-gray-500" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
            )}
          </div>
          <span className="truncate font-medium text-gray-900">
            {statement.fileName}
          </span>
        </div>
      </td>
      <td className="py-3 pr-4 text-gray-500">
        {formatFileType(statement.fileType)}
      </td>
      <td className="py-3 pr-4 text-gray-500">
        {formatFileSize(statement.fileSizeBytes)}
      </td>
      <td className="py-3 pr-4">
        <ProcessingStatusBadge status={statement.processingStatus} />
      </td>
      <td className="py-3 pr-4 text-gray-500">
        {statement.extractedAccountCount !== undefined
          ? statement.extractedAccountCount
          : "\u2014"}
      </td>
      <td className="py-3 pr-4 text-gray-500">
        {formatDate(statement.createdAt)}
      </td>
      <td className="py-3">
        <Link href={`#review-${statement.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </td>
    </tr>
  )
}

function ProcessingStatusBadge({
  status,
}: {
  status: StatementSummary["processingStatus"]
}) {
  const config = {
    PENDING: {
      label: "Pending",
      classes: "bg-gray-100 text-gray-600",
    },
    PROCESSING: {
      label: "Processing",
      classes: "bg-yellow-50 text-yellow-700",
    },
    COMPLETED: {
      label: "Completed",
      classes: "bg-green-50 text-green-700",
    },
    FAILED: {
      label: "Failed",
      classes: "bg-red-50 text-red-700",
    },
  } as const

  const { label, classes } = config[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        classes
      )}
    >
      {label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="rounded-full bg-gray-100 p-3">
        <FolderOpen className="h-6 w-6 text-gray-400" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-900">
        No statements uploaded yet
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Upload bank statements above to begin processing.
      </p>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFileType(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/heic": "HEIC",
    "image/tiff": "TIFF",
  }
  return map[mimeType] ?? mimeType.split("/").pop()?.toUpperCase() ?? "Unknown"
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
