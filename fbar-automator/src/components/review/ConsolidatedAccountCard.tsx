"use client"

import { useState, useCallback } from "react"
import {
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { CoverageTimeline } from "./CoverageTimeline"
import type { ConsolidatedAccount } from "@/lib/consolidation"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsolidatedAccountCardProps {
  account: ConsolidatedAccount
  onApprove: (
    foreignAccountId: string,
    maxValueLocal: number,
    currencyCode: string,
    corrections: Record<string, { original: unknown; corrected: unknown }>
  ) => Promise<void>
  onViewStatements: (statementIds: string[]) => void
  presignedUrls: Record<string, string>
  className?: string
}

type ConfidenceLevel = "high" | "medium" | "low"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        CONFIDENCE_STYLES[level]
      )}
      aria-label={`Confidence: ${level}`}
    >
      {level}
    </span>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const ACCOUNT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "securities", label: "Securities" },
  { value: "other", label: "Other" },
]

function maskAccountNumber(acctNum: string): string {
  if (acctNum.length <= 4) return acctNum
  return "****" + acctNum.slice(-4)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConsolidatedAccountCard({
  account,
  onApprove,
  onViewStatements,
  presignedUrls,
  className,
}: ConsolidatedAccountCardProps) {
  // Editable fields
  const [bankName, setBankName] = useState(account.bankName ?? "")
  const [accountType, setAccountType] = useState<string>(account.accountType)
  const [currency, setCurrency] = useState(account.currency)
  const [maxBalanceAmount, setMaxBalanceAmount] = useState(
    account.maxBalance.amount
  )

  // UI state
  const [balancesOpen, setBalancesOpen] = useState(false)
  const [statementsOpen, setStatementsOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Build corrections map comparing current state to originals
  const buildCorrections = useCallback(() => {
    const corrections: Record<
      string,
      { original: unknown; corrected: unknown }
    > = {}
    const check = (field: string, original: unknown, current: unknown) => {
      if (String(original ?? "") !== String(current ?? "")) {
        corrections[field] = { original, corrected: current }
      }
    }
    check("bank_name", account.bankName, bankName)
    check("account_type", account.accountType, accountType)
    check("currency", account.currency, currency)
    check("max_balance.amount", account.maxBalance.amount, maxBalanceAmount)
    return corrections
  }, [account, bankName, accountType, currency, maxBalanceAmount])

  const handleApprove = async () => {
    if (!account.foreignAccountId) return
    setIsApproving(true)
    setErrorMessage(null)
    try {
      const corrections = buildCorrections()
      await onApprove(
        account.foreignAccountId,
        maxBalanceAmount,
        currency,
        corrections
      )
      setIsApproved(true)
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Approval failed. Please try again."
      )
    } finally {
      setIsApproving(false)
    }
  }

  const handleViewStatements = () => {
    onViewStatements(account.sourceStatements.map((s) => s.statementId))
  }

  const sortedBalances = [...account.allBalances].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return -1
    if (!b.date) return 1
    return a.date.localeCompare(b.date)
  })

  const corrections = buildCorrections()
  const correctionCount = Object.keys(corrections).length

  const inputClassName =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="bg-gray-50">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span>
              {account.bankName ?? "Unknown Bank"} &mdash;{" "}
              {maskAccountNumber(account.displayAccountNumber)}
            </span>
          </span>
          <ConfidenceBadge level={account.overallConfidence} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Warnings */}
        {account.warnings.length > 0 && (
          <div
            className="rounded-md border border-yellow-300 bg-yellow-50 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600"
                aria-hidden="true"
              />
              <div className="space-y-1">
                {account.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-yellow-800">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Coverage Section */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            Statement Coverage
          </h4>
          <CoverageTimeline
            monthsCovered={account.coverage.monthsCovered}
            monthsMissing={account.coverage.monthsMissing}
          />
          {!account.coverage.isComplete && (
            <div
              className="mt-2 rounded-md border border-yellow-300 bg-yellow-50 p-3"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600"
                  aria-hidden="true"
                />
                <p className="text-sm text-yellow-800">
                  Statements cover {account.coverage.monthsCovered.length} of 12
                  months. Missing:{" "}
                  {account.coverage.monthsMissing
                    .map((m) => MONTH_NAMES[m])
                    .join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Max Balance Section */}
        <div
          className={cn(
            "rounded-md p-4",
            account.overallConfidence === "high"
              ? "bg-green-50"
              : "bg-gray-50"
          )}
        >
          <h4 className="mb-1 text-sm font-semibold text-gray-900">
            Maximum Balance
          </h4>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            ${formatCurrency(account.maxBalance.amount)}{" "}
            <span className="text-base font-normal text-gray-500">
              {account.currency}
            </span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {formatDate(account.maxBalance.date)} from{" "}
            {account.maxBalance.sourceFileName}
          </p>
        </div>

        {/* Editable Fields */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900">
            Account Details
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="consolidated-bank-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Bank Name
              </label>
              <Input
                id="consolidated-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="consolidated-account-type"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Account Type
              </label>
              <select
                id="consolidated-account-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className={inputClassName}
                aria-label="Account type"
              >
                {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="consolidated-currency"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Currency Code
              </label>
              <Input
                id="consolidated-currency"
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value.toUpperCase().slice(0, 3))
                }
                maxLength={3}
                className={inputClassName}
                placeholder="USD"
              />
            </div>
            <div>
              <label
                htmlFor="consolidated-max-balance"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Max Balance Amount
              </label>
              <Input
                id="consolidated-max-balance"
                type="number"
                step="0.01"
                min="0"
                value={maxBalanceAmount}
                onChange={(e) =>
                  setMaxBalanceAmount(parseFloat(e.target.value) || 0)
                }
                className={inputClassName}
              />
            </div>
          </div>
        </fieldset>

        {/* Collapsible Balance History */}
        {account.allBalances.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setBalancesOpen(!balancesOpen)}
              className="flex w-full items-center justify-between rounded-md bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              aria-expanded={balancesOpen}
              aria-controls="consolidated-balances"
            >
              <span>
                Balance History ({account.allBalances.length} entries from{" "}
                {account.coverage.totalStatements} {account.coverage.totalStatements === 1 ? "statement" : "statements"})
              </span>
              {balancesOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {balancesOpen && (
              <div id="consolidated-balances" className="mt-2 overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 pr-4 font-medium" scope="col">
                        Date
                      </th>
                      <th
                        className="pb-2 pr-4 text-right font-medium"
                        scope="col"
                      >
                        Amount
                      </th>
                      <th className="pb-2 pr-4 font-medium" scope="col">
                        Label
                      </th>
                      <th className="pb-2 pr-4 font-medium" scope="col">
                        Source File
                      </th>
                      <th className="pb-2 text-center font-medium" scope="col">
                        Is Max
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBalances.map((bal, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-b border-gray-100",
                          bal.isMaximum && "bg-green-50"
                        )}
                      >
                        <td className="py-2 pr-4 text-gray-900">
                          {formatDate(bal.date)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-900">
                          {formatCurrency(bal.amount)}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{bal.label}</td>
                        <td className="py-2 pr-4 text-gray-600">
                          {bal.sourceFileName}
                        </td>
                        <td className="py-2 text-center">
                          {bal.isMaximum ? (
                            <Check
                              className="mx-auto h-4 w-4 text-green-600"
                              aria-label="Yes"
                            />
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Source Statements */}
        {account.sourceStatements.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setStatementsOpen(!statementsOpen)}
              className="flex w-full items-center justify-between rounded-md bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              aria-expanded={statementsOpen}
              aria-controls="consolidated-statements"
            >
              <span>
                Source Statements ({account.sourceStatements.length} {account.sourceStatements.length === 1 ? "file" : "files"})
              </span>
              {statementsOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {statementsOpen && (
              <div
                id="consolidated-statements"
                className="mt-2 space-y-2"
              >
                {account.sourceStatements.map((stmt) => (
                  <div
                    key={stmt.statementId}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText
                        className="h-4 w-4 text-gray-400"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {stmt.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(stmt.periodStart)} &ndash;{" "}
                          {formatDate(stmt.periodEnd)}
                        </p>
                      </div>
                    </div>
                    {presignedUrls[stmt.statementId] && (
                      <a
                        href={presignedUrls[stmt.statementId]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Success Banner */}
        {isApproved && (
          <div
            className="rounded-md border border-green-300 bg-green-50 p-3"
            role="status"
          >
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
              <p className="text-sm font-medium text-green-800">
                Account approved successfully
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div
            className="rounded-md border border-red-300 bg-red-50 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600"
                aria-hidden="true"
              />
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-500">
            {correctionCount > 0 ? (
              <span className="font-medium text-blue-700">
                {correctionCount} correction
                {correctionCount !== 1 ? "s" : ""} made
              </span>
            ) : (
              "No corrections"
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewStatements}
              disabled={isApproved}
            >
              <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
              View Statements
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={
                isApproving ||
                isApproved ||
                !account.foreignAccountId
              }
              title={
                !account.foreignAccountId
                  ? "No matching foreign account found"
                  : undefined
              }
              className={
                isApproved
                  ? "bg-green-700 text-white"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
            >
              {isApproving ? (
                <Loader2
                  className="mr-1.5 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              {isApproved
                ? "Approved"
                : isApproving
                  ? "Approving..."
                  : "Approve Account"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
