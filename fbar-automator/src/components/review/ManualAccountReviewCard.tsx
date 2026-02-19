"use client"

import { useState } from "react"
import {
  Check,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualAccountReviewCardProps {
  account: {
    id: string
    institutionName: string
    accountNumber: string
    accountType: string
    institutionAddressCountry: string | null
    ownershipType: string
  }
  existingReview: {
    maxValueLocal: number | null
    currencyCode: string | null
    isValueUnknown: boolean
    maxValueUsd: number | null
  } | null
  filingYearId: string
  onSaved: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "KRW",
  "ILS", "MXN", "BRL", "SGD", "HKD", "TWD", "THB", "SEK", "NOK", "DKK",
  "NZD", "ZAR", "RUB", "PLN", "CZK", "HUF", "RON", "TRY", "AED", "SAR",
  "QAR", "KWD", "BHD", "OMR", "JOD", "EGP", "NGN", "KES", "GHS", "PHP",
  "IDR", "MYR", "VND", "PKR", "BDT", "LKR", "MMK", "KHR", "LAK", "PEN",
  "COP", "CLP", "ARS", "UYU",
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualAccountReviewCard({
  account,
  existingReview,
  filingYearId,
  onSaved,
}: ManualAccountReviewCardProps) {
  // Form fields — pre-populated from existing review if present
  const [amount, setAmount] = useState<number>(
    existingReview?.maxValueLocal ?? 0
  )
  const [currency, setCurrency] = useState<string>(
    existingReview?.currencyCode ?? "USD"
  )
  const [isValueUnknown, setIsValueUnknown] = useState<boolean>(
    existingReview?.isValueUnknown ?? false
  )

  // Manual exchange rate override (shown after 422)
  const [showManualRate, setShowManualRate] = useState(false)
  const [manualRate, setManualRate] = useState<number | null>(null)
  const [manualRateJustification, setManualRateJustification] = useState("")

  // UI state
  const [saving, setSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(existingReview !== null)
  const [savedUsd, setSavedUsd] = useState<number | null>(
    existingReview?.maxValueUsd ?? null
  )
  const [error, setError] = useState<string | null>(null)

  const inputClassName =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      filingYearId,
      maxValueLocal: isValueUnknown ? 0 : amount,
      currencyCode: currency,
      isValueUnknown,
    }

    if (manualRate != null) {
      body.manualRate = manualRate
      body.manualRateJustification = manualRateJustification
    }

    const res = await fetch(`/api/accounts/${account.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.status === 422) {
      const data = await res.json()
      setError(data.error)
      setShowManualRate(true)
      setSaving(false)
      return
    }

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Failed to save")
      setSaving(false)
      return
    }

    const data = await res.json()
    setSavedUsd(data.maxValueUsd ? parseFloat(data.maxValueUsd) : null)
    setIsSaved(true)
    setShowManualRate(false)
    onSaved()
    setSaving(false)
  }

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isSaved && "border-green-300"
      )}
    >
      {/* Header */}
      <CardHeader className="bg-gray-50">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span>
              {account.institutionName} &mdash; {account.accountNumber}
            </span>
          </span>
          <span className="text-sm font-normal text-gray-500">
            {account.accountType} &middot; {account.ownershipType}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Saved Banner */}
        {isSaved && (
          <div
            className="rounded-md border border-green-300 bg-green-50 p-3"
            role="status"
          >
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
              <p className="text-sm font-medium text-green-800">
                Saved
                {savedUsd != null && (
                  <> &mdash; Max value: ${formatCurrency(savedUsd)} USD</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div
            className="rounded-md border border-red-300 bg-red-50 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600"
                aria-hidden="true"
              />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Editable Fields */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900">
            Financial Data
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`manual-amount-${account.id}`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Maximum Account Value
              </label>
              <Input
                id={`manual-amount-${account.id}`}
                type="number"
                step="0.01"
                min="0"
                value={isValueUnknown ? "" : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                disabled={isValueUnknown}
                className={inputClassName}
                placeholder="0.00"
              />
            </div>
            <div>
              <label
                htmlFor={`manual-currency-${account.id}`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Currency
              </label>
              <select
                id={`manual-currency-${account.id}`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClassName}
                aria-label="Currency code"
              >
                {CURRENCY_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Value Unknown Checkbox */}
          <div className="mt-4 flex items-center gap-2">
            <input
              id={`manual-unknown-${account.id}`}
              type="checkbox"
              checked={isValueUnknown}
              onChange={(e) => setIsValueUnknown(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor={`manual-unknown-${account.id}`}
              className="text-sm text-gray-700"
            >
              Maximum value unknown
            </label>
          </div>
        </fieldset>

        {/* Manual Exchange Rate Override */}
        {showManualRate && (
          <fieldset className="rounded-md border border-yellow-300 bg-yellow-50 p-4">
            <legend className="px-1 text-sm font-semibold text-yellow-800">
              Manual Exchange Rate Required
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`manual-rate-${account.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Exchange Rate (to USD)
                </label>
                <Input
                  id={`manual-rate-${account.id}`}
                  type="number"
                  step="0.000001"
                  min="0"
                  value={manualRate ?? ""}
                  onChange={(e) =>
                    setManualRate(
                      e.target.value === ""
                        ? null
                        : parseFloat(e.target.value)
                    )
                  }
                  className={inputClassName}
                  placeholder="e.g. 1.08"
                />
              </div>
              <div>
                <label
                  htmlFor={`manual-rate-justification-${account.id}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Justification (required)
                </label>
                <Input
                  id={`manual-rate-justification-${account.id}`}
                  value={manualRateJustification}
                  onChange={(e) =>
                    setManualRateJustification(e.target.value)
                  }
                  className={inputClassName}
                  placeholder="Source of exchange rate"
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end border-t border-gray-200 pt-4">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              saving ||
              (!isValueUnknown && amount <= 0) ||
              (showManualRate &&
                (manualRate == null ||
                  manualRate <= 0 ||
                  !manualRateJustification.trim()))
            }
            className={
              isSaved
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }
          >
            {saving ? (
              <Loader2
                className="mr-1.5 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : isSaved ? (
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
            ) : null}
            {saving
              ? "Saving..."
              : isSaved
                ? "Update"
                : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
