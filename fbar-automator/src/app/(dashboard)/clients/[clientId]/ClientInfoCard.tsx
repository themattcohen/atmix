"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Building2, Pencil, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientInfoCardProps {
  clientId: string
  isAdmin: boolean
  client: {
    type: "INDIVIDUAL" | "ENTITY"
    lastName: string
    firstName: string | null
    tinType: string | null
    maskedTin: string | null
    dateOfBirth: string | null
    usAddress: { street?: string; city?: string; state?: string; zip?: string } | null
    activeAccountCount: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "ENTITY", label: "Entity" },
]

const TIN_TYPES = [
  { value: "", label: "None" },
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
// Component
// ---------------------------------------------------------------------------

export function ClientInfoCard({ clientId, isAdmin, client }: ClientInfoCardProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Edit form state
  const [type, setType] = useState(client.type)
  const [lastName, setLastName] = useState(client.lastName)
  const [firstName, setFirstName] = useState(client.firstName || "")
  const [tinType, setTinType] = useState(client.tinType || "")
  const [tin, setTin] = useState("")
  const [tinModified, setTinModified] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState(
    client.dateOfBirth ? client.dateOfBirth.split("T")[0] : ""
  )
  const [street, setStreet] = useState(client.usAddress?.street || "")
  const [city, setCity] = useState(client.usAddress?.city || "")
  const [state, setState] = useState(client.usAddress?.state || "")
  const [zip, setZip] = useState(client.usAddress?.zip || "")

  function resetForm() {
    setType(client.type)
    setLastName(client.lastName)
    setFirstName(client.firstName || "")
    setTinType(client.tinType || "")
    setTin("")
    setTinModified(false)
    setDateOfBirth(client.dateOfBirth ? client.dateOfBirth.split("T")[0] : "")
    setStreet(client.usAddress?.street || "")
    setCity(client.usAddress?.city || "")
    setState(client.usAddress?.state || "")
    setZip(client.usAddress?.zip || "")
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    // Cross-validate TIN and TIN Type
    const effectiveTinType = tinType || null
    const effectiveTin = tinModified ? (tin || null) : undefined
    if ((effectiveTin && !effectiveTinType) || (!effectiveTin && effectiveTinType && tinModified)) {
      setMessage({ type: "error", text: "Both TIN and TIN Type must be provided together." })
      setSaving(false)
      return
    }

    try {
      const payload: Record<string, unknown> = {
        type,
        lastName,
        firstName: firstName || null,
        tinType: effectiveTinType,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth + "T00:00:00.000Z").toISOString() : null,
        usAddress: (street || city || state || zip)
          ? { street: street || undefined, city: city || undefined, state: state || undefined, zip: zip || undefined }
          : null,
      }

      if (tinModified) {
        payload.tin = tin || null
      }

      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to save client.")
      }

      setMessage({ type: "success", text: "Client updated successfully." })
      router.refresh()
      setMode("view")
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete client.")
      }

      router.push("/clients")
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
      setSaving(false)
    }
  }

  const displayName = client.firstName
    ? `${client.firstName} ${client.lastName}`
    : client.lastName

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              {client.type === "INDIVIDUAL" ? (
                <User className="h-5 w-5 text-gray-600" />
              ) : (
                <Building2 className="h-5 w-5 text-gray-600" />
              )}
            </div>
            <div>
              <CardTitle>{displayName}</CardTitle>
              <p className="text-sm text-gray-500">
                {client.type === "INDIVIDUAL" ? "Individual" : "Entity"}
                {client.tinType && ` | ${client.tinType}: ${client.maskedTin}`}
              </p>
            </div>
          </div>
          {mode === "view" && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { resetForm(); setMode("edit") }}
                aria-label="Edit client"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMessage(null); setMode("confirmDelete") }}
                  aria-label="Delete client"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Feedback message */}
        {message && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
            role="alert"
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* VIEW MODE */}
        {mode === "view" && (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {client.dateOfBirth && (
              <div>
                <dt className="font-medium text-gray-500">Date of Birth</dt>
                <dd className="mt-1 text-gray-900">
                  {new Date(client.dateOfBirth).toLocaleDateString("en-US", { timeZone: "UTC" })}
                </dd>
              </div>
            )}
            {client.usAddress && (client.usAddress.street || client.usAddress.city) && (
              <div>
                <dt className="font-medium text-gray-500">US Address</dt>
                <dd className="mt-1 text-gray-900">
                  {client.usAddress.street && <>{client.usAddress.street}<br /></>}
                  {client.usAddress.city && <>{client.usAddress.city}, </>}
                  {client.usAddress.state} {client.usAddress.zip}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">Foreign Accounts</dt>
              <dd className="mt-1 text-gray-900">
                {client.activeAccountCount} active
              </dd>
            </div>
          </dl>
        )}

        {/* EDIT MODE */}
        {mode === "edit" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "INDIVIDUAL" | "ENTITY")}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  {CLIENT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">TIN</label>
                <Input
                  value={tin}
                  onChange={(e) => { setTin(e.target.value); setTinModified(true) }}
                  placeholder={client.maskedTin || "Tax Identification Number"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">TIN Type</label>
                <select
                  value={tinType}
                  onChange={(e) => setTinType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  {TIN_TYPES.map((tt) => (
                    <option key={tt.value} value={tt.value}>{tt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-gray-600">US Address</legend>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  <option value="">State</option>
                  {US_STATES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP code" maxLength={10} />
              </div>
            </fieldset>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saving || !lastName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => { resetForm(); setMode("view") }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODE */}
        {mode === "confirmDelete" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Are you sure you want to delete this client?
            </p>
            <p className="mt-1 text-sm text-red-700">
              This permanently deletes all accounts and filing data associated with this client. This action cannot be undone.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Client
              </Button>
              <Button variant="outline" onClick={() => setMode("view")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
