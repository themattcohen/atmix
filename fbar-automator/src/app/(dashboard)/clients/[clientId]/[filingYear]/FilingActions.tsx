"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send, ShieldCheck, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface FilingActionsProps {
  filingYearId: string
  status: string
  isFullyReviewed: boolean
  isReadyForReview: boolean
  userRole: string | undefined
}

export function FilingActions({
  filingYearId,
  status,
  isFullyReviewed,
  isReadyForReview,
  userRole,
}: FilingActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function performAction(
    action: string,
    endpoint: string,
    method: string = "POST"
  ) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filingYearId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Failed to ${action}.`)
        return
      }

      setSuccess(`Successfully ${action}.`)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Determine available actions based on current status
  const showSubmitForReview =
    (status === "NOT_STARTED" || status === "IN_PROGRESS") && isFullyReviewed
  const showApproveForExport =
    status === "REVIEWED" && (userRole === "ADMIN" || userRole === "REVIEWER")
  const showMarkAsFiled = status === "EXPORTED"

  if (!showSubmitForReview && !showApproveForExport && !showMarkAsFiled) {
    return null
  }

  return (
    <div className="mt-6 rounded-lg border bg-white p-4">
      <div className="flex items-center gap-3 flex-wrap">
        {showSubmitForReview && (
          <Button
            onClick={() =>
              performAction(
                "submitted for review",
                `/api/filing-years/${filingYearId}/submit`,
                "POST"
              )
            }
            disabled={isLoading || !isReadyForReview}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit for Review
          </Button>
        )}

        {showApproveForExport && (
          <Button
            onClick={() =>
              performAction(
                "approved for export",
                `/api/filing-years/${filingYearId}/approve`,
                "POST"
              )
            }
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Approve for Export
          </Button>
        )}

        {showMarkAsFiled && (
          <Button
            onClick={() =>
              performAction(
                "marked as filed",
                `/api/filing-years/${filingYearId}/filed`,
                "POST"
              )
            }
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Mark as Filed
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-3 text-sm text-green-600">{success}</p>
      )}

      {showSubmitForReview && !isReadyForReview && (
        <p className="mt-2 text-xs text-gray-500">
          All statements must be processed and all accounts reviewed before
          submitting for review.
        </p>
      )}
    </div>
  )
}
