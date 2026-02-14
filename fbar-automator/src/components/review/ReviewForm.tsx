"use client"

import { useState, useCallback } from "react"
import {
  Check,
  AlertTriangle,
  Edit3,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { COUNTRY_CODES } from "@/types/fincen"
import type { ExtractedAccount } from "@/types/extraction"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CorrectionEntry {
  original: unknown
  corrected: unknown
}

type CorrectionMap = Record<string, CorrectionEntry>

interface ReviewFormProps {
  statementId: string
  accounts: ExtractedAccount[]
  onApprove: (
    accountIndex: number,
    corrections: Record<string, unknown>
  ) => Promise<void>
  onRejectReExtract: (statementId: string) => Promise<void>
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

function ModifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      <Edit3 className="h-3 w-3" aria-hidden="true" />
      Modified
    </span>
  )
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
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
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-800">
              {w}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Field label component with optional confidence badge and modified indicator
// ---------------------------------------------------------------------------

function FieldLabel({
  label,
  confidence,
  isModified,
  htmlFor,
}: {
  label: string
  confidence?: ConfidenceLevel
  isModified: boolean
  htmlFor?: string
}) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      {confidence && <ConfidenceBadge level={confidence} />}
      {isModified && <ModifiedBadge />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-account editable section
// ---------------------------------------------------------------------------

interface AccountSectionProps {
  account: ExtractedAccount
  accountIndex: number
  onApprove: (
    accountIndex: number,
    corrections: Record<string, unknown>
  ) => Promise<void>
  onRejectReExtract: (statementId: string) => Promise<void>
  statementId: string
}

const ACCOUNT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "securities", label: "Securities" },
  { value: "other", label: "Other" },
]

function AccountSection({
  account,
  accountIndex,
  onApprove,
  onRejectReExtract,
  statementId,
}: AccountSectionProps) {
  // Editable field state -- initialized from extracted values
  const [bankName, setBankName] = useState(account.bank_name ?? "")
  const [street, setStreet] = useState(account.bank_address.street ?? "")
  const [city, setCity] = useState(account.bank_address.city ?? "")
  const [stateProvince, setStateProvince] = useState(
    account.bank_address.state_province ?? ""
  )
  const [country, setCountry] = useState(account.bank_address.country ?? "")
  const [postalCode, setPostalCode] = useState(
    account.bank_address.postal_code ?? ""
  )
  const [accountNumber, setAccountNumber] = useState(account.account_number)
  const [accountType, setAccountType] = useState<string>(account.account_type)
  const [currency, setCurrency] = useState(account.currency)
  const [maxBalanceAmount, setMaxBalanceAmount] = useState(
    account.max_balance.amount
  )
  const [maxBalanceDate, setMaxBalanceDate] = useState(
    account.max_balance.date ?? ""
  )

  // Collapse state for balance table
  const [balancesOpen, setBalancesOpen] = useState(false)

  // Loading states
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  // Build corrections map by comparing current state to originals
  const buildCorrections = useCallback((): CorrectionMap => {
    const corrections: CorrectionMap = {}

    const check = (
      field: string,
      original: unknown,
      current: unknown
    ) => {
      const origStr = String(original ?? "")
      const currStr = String(current ?? "")
      if (origStr !== currStr) {
        corrections[field] = { original, corrected: current }
      }
    }

    check("bank_name", account.bank_name, bankName)
    check("bank_address.street", account.bank_address.street, street)
    check("bank_address.city", account.bank_address.city, city)
    check(
      "bank_address.state_province",
      account.bank_address.state_province,
      stateProvince
    )
    check("bank_address.country", account.bank_address.country, country)
    check(
      "bank_address.postal_code",
      account.bank_address.postal_code,
      postalCode
    )
    check("account_number", account.account_number, accountNumber)
    check("account_type", account.account_type, accountType)
    check("currency", account.currency, currency)
    check("max_balance.amount", account.max_balance.amount, maxBalanceAmount)
    check("max_balance.date", account.max_balance.date, maxBalanceDate)

    return corrections
  }, [
    account,
    bankName,
    street,
    city,
    stateProvince,
    country,
    postalCode,
    accountNumber,
    accountType,
    currency,
    maxBalanceAmount,
    maxBalanceDate,
  ])

  const corrections = buildCorrections()
  const correctionCount = Object.keys(corrections).length
  const isModified = (field: string) => field in corrections

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      // Convert corrections map to simple {field: correctedValue} for the API
      const correctionPayload: Record<string, unknown> = {}
      for (const [field, entry] of Object.entries(corrections)) {
        correctionPayload[field] = entry.corrected
      }
      await onApprove(accountIndex, correctionPayload)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await onRejectReExtract(statementId)
    } finally {
      setIsRejecting(false)
    }
  }

  const inputClassName =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

  const fieldId = (name: string) =>
    `account-${accountIndex}-${name}`

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gray-50">
        <CardTitle className="flex items-center justify-between">
          <span>
            Account {accountIndex + 1}: {account.bank_name ?? "Unknown Bank"}{" "}
            &mdash; {account.account_number}
          </span>
          <ConfidenceBadge level={account.confidence.overall} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Warnings */}
        <WarningList warnings={account.warnings} />

        {/* Bank Name */}
        <div>
          <FieldLabel
            label="Bank Name"
            confidence={account.confidence.bank_name}
            isModified={isModified("bank_name")}
            htmlFor={fieldId("bank_name")}
          />
          <Input
            id={fieldId("bank_name")}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className={inputClassName}
          />
        </div>

        {/* Bank Address */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900">
            Bank Address
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel
                label="Street"
                isModified={isModified("bank_address.street")}
                htmlFor={fieldId("street")}
              />
              <Input
                id={fieldId("street")}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel
                label="City"
                isModified={isModified("bank_address.city")}
                htmlFor={fieldId("city")}
              />
              <Input
                id={fieldId("city")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel
                label="State / Province"
                isModified={isModified("bank_address.state_province")}
                htmlFor={fieldId("state_province")}
              />
              <Input
                id={fieldId("state_province")}
                value={stateProvince}
                onChange={(e) => setStateProvince(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel
                label="Country"
                isModified={isModified("bank_address.country")}
                htmlFor={fieldId("country")}
              />
              <select
                id={fieldId("country")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClassName}
                aria-label="Country"
              >
                <option value="">Select country</option>
                {Object.entries(COUNTRY_CODES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} &mdash; {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel
                label="Postal Code"
                isModified={isModified("bank_address.postal_code")}
                htmlFor={fieldId("postal_code")}
              />
              <Input
                id={fieldId("postal_code")}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>
        </fieldset>

        {/* Account Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel
              label="Account Number"
              confidence={account.confidence.account_number}
              isModified={isModified("account_number")}
              htmlFor={fieldId("account_number")}
            />
            <Input
              id={fieldId("account_number")}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <FieldLabel
              label="Account Type"
              isModified={isModified("account_type")}
              htmlFor={fieldId("account_type")}
            />
            <select
              id={fieldId("account_type")}
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
            <FieldLabel
              label="Currency Code"
              confidence={account.confidence.currency}
              isModified={isModified("currency")}
              htmlFor={fieldId("currency")}
            />
            <Input
              id={fieldId("currency")}
              value={currency}
              onChange={(e) =>
                setCurrency(e.target.value.toUpperCase().slice(0, 3))
              }
              maxLength={3}
              className={inputClassName}
              placeholder="USD"
            />
          </div>
        </div>

        {/* Max Balance */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel
              label="Max Balance Amount"
              confidence={account.confidence.max_balance}
              isModified={isModified("max_balance.amount")}
              htmlFor={fieldId("max_balance_amount")}
            />
            <Input
              id={fieldId("max_balance_amount")}
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
          <div>
            <FieldLabel
              label="Max Balance Date"
              isModified={isModified("max_balance.date")}
              htmlFor={fieldId("max_balance_date")}
            />
            <Input
              id={fieldId("max_balance_date")}
              type="date"
              value={maxBalanceDate}
              onChange={(e) => setMaxBalanceDate(e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        {/* Balance Table */}
        {account.balances.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setBalancesOpen(!balancesOpen)}
              className="flex w-full items-center justify-between rounded-md bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              aria-expanded={balancesOpen}
              aria-controls={`balances-${accountIndex}`}
            >
              <span>
                Extracted Balances ({account.balances.length})
              </span>
              {balancesOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {balancesOpen && (
              <div
                id={`balances-${accountIndex}`}
                className="mt-2 overflow-x-auto"
              >
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-2 pr-4 font-medium" scope="col">
                        Date
                      </th>
                      <th className="pb-2 pr-4 text-right font-medium" scope="col">
                        Amount
                      </th>
                      <th className="pb-2 pr-4 font-medium" scope="col">
                        Label
                      </th>
                      <th className="pb-2 text-center font-medium" scope="col">
                        Is Maximum
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.balances.map((bal, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-b border-gray-100",
                          bal.is_maximum && "bg-green-50"
                        )}
                      >
                        <td className="py-2 pr-4 text-gray-900">
                          {bal.date ?? "N/A"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-900">
                          {formatCurrency(bal.amount)}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {bal.label}
                        </td>
                        <td className="py-2 text-center">
                          {bal.is_maximum ? (
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

        {/* Correction Count & Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-500">
            {correctionCount > 0 ? (
              <span className="font-medium text-blue-700">
                {correctionCount} correction{correctionCount !== 1 ? "s" : ""}{" "}
                made
              </span>
            ) : (
              "No corrections"
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isRejecting || isApproving}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isRejecting ? "Requesting..." : "Request Re-extraction"}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isApproving ? "Approving..." : "Approve Account"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main ReviewForm
// ---------------------------------------------------------------------------

export function ReviewForm({
  statementId,
  accounts,
  onApprove,
  onRejectReExtract,
  className,
}: ReviewFormProps) {
  if (accounts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-8 w-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">
            No accounts were extracted from this statement.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {accounts.map((account, index) => (
        <AccountSection
          key={`${statementId}-${index}`}
          account={account}
          accountIndex={index}
          onApprove={onApprove}
          onRejectReExtract={onRejectReExtract}
          statementId={statementId}
        />
      ))}
    </div>
  )
}
