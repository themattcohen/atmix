"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  FileWarning,
  X,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { ConsolidatedAccountCard } from "@/components/review/ConsolidatedAccountCard"
import type { ConsolidatedAccount } from "@/lib/consolidation"
import type { ExtractedAccount } from "@/types/extraction"

const DocumentViewer = dynamic(
  () =>
    import("@/components/review/DocumentViewer").then(
      (mod) => mod.DocumentViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[600px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatementWithExtraction {
  id: string
  fileName: string
  fileType: string
  filePath: string
  presignedUrl: string
  accounts: ExtractedAccount[]
}

interface ReviewPageClientProps {
  consolidatedAccounts: ConsolidatedAccount[]
  presignedUrlMap: Record<string, string>
  statements: StatementWithExtraction[]
  clientId: string
  filingYear: string
  filingYearId: string
  foreignAccounts: Array<{
    id: string
    accountNumber: string
    institutionName: string
  }>
}

// ---------------------------------------------------------------------------
// Client Component
// ---------------------------------------------------------------------------

export function ReviewPageClient({
  consolidatedAccounts,
  presignedUrlMap,
  statements,
  clientId,
  filingYear,
  filingYearId,
  foreignAccounts,
}: ReviewPageClientProps) {
  const router = useRouter()

  // Statement viewer state
  const [viewingStatementIds, setViewingStatementIds] = useState<
    string[] | null
  >(null)
  const [activeViewerIndex, setActiveViewerIndex] = useState(0)

  // Approve All state
  const [approveAllLoading, setApproveAllLoading] = useState(false)
  const [approveAllProgress, setApproveAllProgress] = useState({
    current: 0,
    total: 0,
  })
  const [approveAllResult, setApproveAllResult] = useState<{
    approved: number
    skipped: number
    failed: number
  } | null>(null)

  // Per-account approve handler
  const handleApprove = useCallback(
    async (
      foreignAccountId: string,
      maxValueLocal: number,
      currencyCode: string,
      corrections: Record<string, { original: unknown; corrected: unknown }>
    ) => {
      const response = await fetch(
        `/api/accounts/${foreignAccountId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filingYearId,
            maxValueLocal,
            currencyCode,
            corrections,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Approval failed (${response.status})`)
      }

      router.refresh()
    },
    [filingYearId, router]
  )

  // View statements handler
  const handleViewStatements = useCallback((statementIds: string[]) => {
    setViewingStatementIds(statementIds)
    setActiveViewerIndex(0)
  }, [])

  // Close statement viewer
  const handleCloseViewer = useCallback(() => {
    setViewingStatementIds(null)
    setActiveViewerIndex(0)
  }, [])

  // Approve All handler
  const handleApproveAll = useCallback(async () => {
    const approvable = consolidatedAccounts.filter((a) => a.foreignAccountId)
    if (approvable.length === 0) return

    setApproveAllLoading(true)
    setApproveAllResult(null)
    setApproveAllProgress({ current: 0, total: consolidatedAccounts.length })

    let approved = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < consolidatedAccounts.length; i++) {
      const account = consolidatedAccounts[i]
      setApproveAllProgress({
        current: i + 1,
        total: consolidatedAccounts.length,
      })

      if (!account.foreignAccountId) {
        skipped++
        continue
      }

      try {
        await handleApprove(
          account.foreignAccountId,
          account.maxBalance.amount,
          account.currency,
          {} // No corrections for bulk approve
        )
        approved++
      } catch {
        failed++
      }
    }

    setApproveAllLoading(false)
    setApproveAllResult({ approved, skipped, failed })
  }, [consolidatedAccounts, handleApprove])

  // Resolve statements for the viewer panel
  const viewingStatements = viewingStatementIds
    ? statements.filter((s) => viewingStatementIds.includes(s.id))
    : []

  // Empty state: statements exist but no accounts extracted
  if (consolidatedAccounts.length === 0 && statements.length > 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <FileWarning className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-4 text-sm text-gray-500">
          Statements were processed but no accounts could be extracted. Try
          re-uploading.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Header + Approve All */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {consolidatedAccounts.length} account
              {consolidatedAccounts.length !== 1 ? "s" : ""} found across{" "}
              {statements.length} statement
              {statements.length !== 1 ? "s" : ""}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Review and approve each account, or use batch approval below.
            </p>
          </div>
          {consolidatedAccounts.length > 1 && (
            <Button
              onClick={handleApproveAll}
              disabled={
                approveAllLoading ||
                consolidatedAccounts.filter((a) => a.foreignAccountId)
                  .length === 0
              }
              className="flex-shrink-0"
            >
              {approveAllLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving {approveAllProgress.current} of{" "}
                  {approveAllProgress.total}...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve All
                </>
              )}
            </Button>
          )}
        </div>

        {approveAllResult && (
          <div className="mt-3 flex items-center gap-4 text-xs">
            {approveAllResult.approved > 0 && (
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                {approveAllResult.approved} approved
              </span>
            )}
            {approveAllResult.skipped > 0 && (
              <span className="flex items-center gap-1 text-yellow-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {approveAllResult.skipped} skipped (no match)
              </span>
            )}
            {approveAllResult.failed > 0 && (
              <span className="flex items-center gap-1 text-red-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {approveAllResult.failed} failed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-account cards */}
      <div className="space-y-6">
        {consolidatedAccounts.map((account) => (
          <ConsolidatedAccountCard
            key={
              account.normalizedAccountNumber + "|" + account.currency
            }
            account={account}
            onApprove={handleApprove}
            onViewStatements={handleViewStatements}
            presignedUrls={presignedUrlMap}
          />
        ))}
      </div>

      {/* Statement Viewer Panel */}
      {viewingStatementIds && viewingStatements.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-300 bg-white shadow-2xl">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <div className="flex items-center gap-2">
              {viewingStatements.length > 1 ? (
                <nav className="flex gap-1" aria-label="Statement tabs">
                  {viewingStatements.map((stmt, idx) => (
                    <button
                      key={stmt.id}
                      type="button"
                      onClick={() => setActiveViewerIndex(idx)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        idx === activeViewerIndex
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {stmt.fileName}
                    </button>
                  ))}
                </nav>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  {viewingStatements[0].fileName}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCloseViewer}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close statement viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Viewer Content */}
          <div style={{ height: "50vh" }} className="overflow-auto">
            <DocumentViewer
              fileUrl={viewingStatements[activeViewerIndex].presignedUrl}
              fileType={viewingStatements[activeViewerIndex].fileType}
              fileName={viewingStatements[activeViewerIndex].fileName}
            />
          </div>
        </div>
      )}
    </div>
  )
}
