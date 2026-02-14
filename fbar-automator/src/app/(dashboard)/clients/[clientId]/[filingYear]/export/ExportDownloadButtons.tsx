"use client"

import { useState } from "react"
import { Download, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/Button"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportDownloadButtonsProps {
  filingYearId: string
  type: "csv" | "xml" | "pdf"
  isReady: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportDownloadButtons({
  filingYearId,
  type,
  isReady,
}: ExportDownloadButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload(url: string, label: string) {
    if (!isReady) return
    setLoading(label)
    setError(null)

    try {
      const res = await fetch(url)
      if (!res.ok) {
        let message = "Download failed. Please try again."
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch {
          // response wasn't JSON, use default message
        }
        setError(message)
        return
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const disposition = res.headers.get("content-disposition")
      let filename = `export-${label}.${type === "xml" ? "xml" : type === "pdf" ? "pdf" : "csv"}`
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/)
        if (match?.[1]) filename = match[1]
      }

      const a = document.createElement("a")
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      setError("Download failed. Please check your connection and try again.")
    } finally {
      setLoading(null)
    }
  }

  if (type === "csv") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!isReady || loading === "fbar"}
          onClick={() =>
            handleDownload(
              `/api/export/${filingYearId}/csv?type=fbar`,
              "fbar"
            )
          }
        >
          {loading === "fbar" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download FBAR CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!isReady || loading === "accounts"}
          onClick={() =>
            handleDownload(
              `/api/export/${filingYearId}/csv?type=accounts`,
              "accounts"
            )
          }
        >
          {loading === "accounts" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download Accounts CSV
        </Button>
        {error && <ErrorMessage message={error} />}
      </>
    )
  }

  if (type === "xml") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!isReady || loading === "xml"}
          onClick={() =>
            handleDownload(`/api/export/${filingYearId}/xml`, "xml")
          }
        >
          {loading === "xml" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download XML
        </Button>
        {error && <ErrorMessage message={error} />}
      </>
    )
  }

  if (type === "pdf") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={!isReady || loading === "pdf"}
          onClick={() =>
            handleDownload(`/api/export/${filingYearId}/pdf`, "pdf")
          }
        >
          {loading === "pdf" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
        {error && <ErrorMessage message={error} />}
      </>
    )
  }

  return null
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2" role="alert">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" aria-hidden="true" />
      <p className="text-xs text-red-700">{message}</p>
    </div>
  )
}
