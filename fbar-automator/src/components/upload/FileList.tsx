"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Image, FolderOpen, Trash2, Table } from "lucide-react"
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
  clientId: string
  filingYear: string
  isAdmin?: boolean
}

export function FileList({ statements, clientId, filingYear, isAdmin = false }: FileListProps) {
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
                  <StatementRow
                    key={statement.id}
                    statement={statement}
                    clientId={clientId}
                    filingYear={filingYear}
                    isAdmin={isAdmin}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatementRow({
  statement,
  clientId,
  filingYear,
  isAdmin,
}: {
  statement: StatementSummary
  clientId: string
  filingYear: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isImage = ["image/jpeg", "image/png", "image/heic", "image/tiff"].includes(
    statement.fileType
  )
  const isTabular = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(
    statement.fileType
  )

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/statements/${statement.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error ?? "Failed to delete statement.")
        return
      }
      router.refresh()
    } catch {
      alert("Failed to delete statement. Please try again.")
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <tr className="group">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
            {isTabular ? (
              <Table className="h-4 w-4 text-gray-500" aria-hidden="true" />
            ) : isImage ? (
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
        <div className="flex items-center gap-1">
          <Link href={`/clients/${clientId}/${filingYear}/review`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
          {isAdmin && (
            <>
              {showConfirm ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting || statement.processingStatus === "PROCESSING"}
                  >
                    {deleting ? "Deleting..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={statement.processingStatus === "PROCESSING"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  title={
                    statement.processingStatus === "PROCESSING"
                      ? "Cannot delete while processing"
                      : "Delete statement"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
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
    "text/csv": "CSV",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
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
