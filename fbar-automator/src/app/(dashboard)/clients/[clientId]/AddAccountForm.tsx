"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { COUNTRY_CODES } from "@/types/fincen"

interface AddAccountFormProps {
  clientId: string
}

export function AddAccountForm({ clientId }: AddAccountFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [accountNumber, setAccountNumber] = useState("")
  const [accountType, setAccountType] = useState("BANK")
  const [institutionName, setInstitutionName] = useState("")
  const [country, setCountry] = useState("")
  const [ownershipType, setOwnershipType] = useState("FINANCIAL_INTEREST")

  function reset() {
    setAccountNumber("")
    setAccountType("BANK")
    setInstitutionName("")
    setCountry("")
    setOwnershipType("FINANCIAL_INTEREST")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          accountType,
          institutionName,
          institutionAddressCountry: country || null,
          ownershipType,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create account.")
        return
      }

      reset()
      setOpen(false)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3 w-3" />
        Add Account
      </Button>
    )
  }

  return (
    <div className="w-full mt-2 rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">New Foreign Account</h4>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false) }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Institution Name *
            </label>
            <Input
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              required
              placeholder="Bank name"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Account Number *
            </label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
              placeholder="Account number"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            >
              <option value="BANK">Bank</option>
              <option value="SECURITIES">Securities</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              aria-label="Country"
            >
              <option value="">Select country</option>
              {Object.entries(COUNTRY_CODES).map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ownership
            </label>
            <select
              value={ownershipType}
              onChange={(e) => setOwnershipType(e.target.value)}
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            >
              <option value="FINANCIAL_INTEREST">Financial Interest</option>
              <option value="SIGNATURE_AUTHORITY">Signature Authority</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { reset(); setOpen(false) }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
