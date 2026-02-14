"use client"

import { useState, useCallback } from "react"
import { FileText, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReviewForm } from "@/components/review/ReviewForm"
import { DocumentViewer } from "@/components/review/DocumentViewer"
import type { ExtractedAccount } from "@/types/extraction"

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
  statements: StatementWithExtraction[]
  clientId: string
  filingYear: string
}

// ---------------------------------------------------------------------------
// Client Wrapper Component
// ---------------------------------------------------------------------------

export function ReviewPageClient({
  statements,
  clientId,
  filingYear,
}: ReviewPageClientProps) {
  const [activeStatementIndex, setActiveStatementIndex] = useState(0)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const activeStatement = statements[activeStatementIndex]

  const handleApprove = useCallback(
    async (accountIndex: number, corrections: Record<string, unknown>) => {
      const response = await fetch(
        `/api/accounts/${activeStatement.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statementId: activeStatement.id,
            accountIndex,
            corrections,
            clientId,
            filingYear,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error ?? `Approval failed (${response.status})`
        throw new Error(message)
      }
    },
    [activeStatement, clientId, filingYear]
  )

  const handleRejectReExtract = useCallback(
    async (statementId: string) => {
      const response = await fetch(
        `/api/statements/${statementId}/reprocess`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data?.error ?? `Re-extraction request failed (${response.status})`
        throw new Error(message)
      }
    },
    []
  )

  return (
    <div className="space-y-4">
      {/* Statement Selector */}
      {statements.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm shadow-sm hover:bg-gray-50"
            aria-expanded={selectorOpen}
            aria-haspopup="listbox"
            aria-label="Select statement to review"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="font-medium text-gray-900">
                {activeStatement.fileName}
              </span>
              <span className="text-gray-500">
                ({activeStatement.accounts.length} account
                {activeStatement.accounts.length !== 1 ? "s" : ""})
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                selectorOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {selectorOpen && (
            <ul
              role="listbox"
              aria-label="Statements"
              className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              {statements.map((stmt, index) => (
                <li
                  key={stmt.id}
                  role="option"
                  aria-selected={index === activeStatementIndex}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50",
                    index === activeStatementIndex &&
                      "bg-blue-50 text-blue-700"
                  )}
                  onClick={() => {
                    setActiveStatementIndex(index)
                    setSelectorOpen(false)
                  }}
                >
                  <FileText
                    className="h-4 w-4 flex-shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{stmt.fileName}</span>
                  <span className="text-xs text-gray-500">
                    {stmt.accounts.length} account
                    {stmt.accounts.length !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Side-by-side split view */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 260px)" }}>
        {/* Left panel: Document Viewer */}
        <div className="w-1/2 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <DocumentViewer
            fileUrl={activeStatement.presignedUrl}
            fileType={activeStatement.fileType}
            fileName={activeStatement.fileName}
          />
        </div>

        {/* Right panel: Review Form */}
        <div className="w-1/2 overflow-y-auto">
          <ReviewForm
            statementId={activeStatement.id}
            accounts={activeStatement.accounts}
            onApprove={handleApprove}
            onRejectReExtract={handleRejectReExtract}
          />
        </div>
      </div>
    </div>
  )
}
