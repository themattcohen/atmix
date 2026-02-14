"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
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

  function handleDownload(url: string, label: string) {
    if (!isReady) return
    setLoading(label)

    // Open the export URL in a new tab to trigger the download.
    // Use a brief timeout so the loading indicator renders before navigation.
    setTimeout(() => {
      window.open(url, "_blank")
      setLoading(null)
    }, 300)
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
      </>
    )
  }

  if (type === "xml") {
    return (
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
    )
  }

  if (type === "pdf") {
    return (
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
    )
  }

  return null
}
