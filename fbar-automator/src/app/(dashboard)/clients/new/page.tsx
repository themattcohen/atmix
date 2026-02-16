"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "ENTITY", label: "Entity" },
]

const TIN_TYPES = [
  { value: "", label: "Select TIN Type" },
  { value: "SSN", label: "SSN" },
  { value: "ITIN", label: "ITIN" },
  { value: "EIN", label: "EIN" },
  { value: "FOREIGN_TIN", label: "Foreign TIN" },
]

const US_STATES = [
  "", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormErrors {
  [key: string]: string[] | undefined
}

// ---------------------------------------------------------------------------
// Page Component (client component since it contains a form with state)
// ---------------------------------------------------------------------------

export default function NewClientPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Form state
  const [type, setType] = useState("INDIVIDUAL")
  const [lastName, setLastName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [tin, setTin] = useState("")
  const [tinType, setTinType] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")

  // US Address
  const [usStreet, setUsStreet] = useState("")
  const [usCity, setUsCity] = useState("")
  const [usState, setUsState] = useState("")
  const [usZip, setUsZip] = useState("")

  // Mailing Address
  const [mailStreet, setMailStreet] = useState("")
  const [mailCity, setMailCity] = useState("")
  const [mailState, setMailState] = useState("")
  const [mailZip, setMailZip] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setGlobalError(null)

    // Cross-validate TIN and TIN Type: if one is provided, both must be
    if ((tin && !tinType) || (!tin && tinType)) {
      setGlobalError("Both TIN and TIN Type must be provided together.")
      setIsSubmitting(false)
      return
    }

    const payload: Record<string, unknown> = {
      type,
      lastName,
      firstName: firstName || null,
      tin: tin || null,
      tinType: tinType || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth + "T00:00:00.000Z").toISOString() : null,
    }

    // Only include address objects if any field is filled
    if (usStreet || usCity || usState || usZip) {
      payload.usAddress = {
        street: usStreet || undefined,
        city: usCity || undefined,
        state: usState || undefined,
        zip: usZip || undefined,
      }
    }

    if (mailStreet || mailCity || mailState || mailZip) {
      payload.mailingAddress = {
        street: mailStreet || undefined,
        city: mailCity || undefined,
        state: mailState || undefined,
        zip: mailZip || undefined,
      }
    }

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) {
          setErrors(data.details)
        } else {
          setGlobalError(data.error || "An error occurred.")
        }
        return
      }

      router.push(`/clients/${data.id}`)
      return
    } catch {
      setGlobalError("Network error. Please try again.")
    }
    setIsSubmitting(false)
  }

  function fieldError(name: string) {
    const errs = errors[name]
    if (!errs || errs.length === 0) return null
    return (
      <p className="mt-1 text-xs text-red-600">{errs[0]}</p>
    )
  }

  return (
    <div>
      {/* Header area - manual since this is a client component */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8 -mx-8 -mt-8">
        <h1 className="text-xl font-semibold text-gray-900">Add New Client</h1>
      </div>

      <div className="mt-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>

        <div className="mt-6 max-w-3xl rounded-lg border bg-white shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              Client Information
            </h3>
          </div>

          <div className="p-6 pt-0">
            {globalError && (
              <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  {CLIENT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
                {fieldError("type")}
              </div>

              {/* Name */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Last name or entity name"
                  />
                  {fieldError("lastName")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                  {fieldError("firstName")}
                </div>
              </div>

              {/* TIN */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TIN
                  </label>
                  <Input
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="Tax Identification Number"
                  />
                  {fieldError("tin")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TIN Type
                  </label>
                  <select
                    value={tinType}
                    onChange={(e) => setTinType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                    {TIN_TYPES.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {tt.label}
                      </option>
                    ))}
                  </select>
                  {fieldError("tinType")}
                </div>
              </div>

              {/* Date of Birth */}
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
                {fieldError("dateOfBirth")}
              </div>

              {/* US Address */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-gray-700">
                  US Address
                </legend>
                <div>
                  <Input
                    value={usStreet}
                    onChange={(e) => setUsStreet(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    value={usCity}
                    onChange={(e) => setUsCity(e.target.value)}
                    placeholder="City"
                  />
                  <select
                    value={usState}
                    onChange={(e) => setUsState(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                    <option value="">State</option>
                    {US_STATES.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={usZip}
                    onChange={(e) => setUsZip(e.target.value)}
                    placeholder="ZIP code"
                    maxLength={10}
                  />
                </div>
              </fieldset>

              {/* Mailing Address */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-gray-700">
                  Mailing Address
                </legend>
                <div>
                  <Input
                    value={mailStreet}
                    onChange={(e) => setMailStreet(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    value={mailCity}
                    onChange={(e) => setMailCity(e.target.value)}
                    placeholder="City"
                  />
                  <select
                    value={mailState}
                    onChange={(e) => setMailState(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                    <option value="">State</option>
                    {US_STATES.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={mailZip}
                    onChange={(e) => setMailZip(e.target.value)}
                    placeholder="ZIP code"
                    maxLength={10}
                  />
                </div>
              </fieldset>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-4 border-t">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Client
                </Button>
                <Link href="/clients">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
