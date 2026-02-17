"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

interface RetentionSettings {
  statementRetentionDays: number
  auditLogRetentionDays: number
  inactiveClientArchiveDays: number
}

export default function DataRetentionPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<RetentionSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings/data-retention")
        if (res.status === 401) {
          router.push("/login")
          return
        }
        if (!res.ok) {
          setError("Failed to load retention settings.")
          return
        }
        const data = await res.json()
        setSettings(data)
      } catch {
        setError("Failed to load retention settings.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setError("")
    setSuccess("")
    setIsSaving(true)

    try {
      const res = await fetch("/api/settings/data-retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save settings.")
        return
      }

      setSuccess("Retention settings saved.")
    } catch {
      setError("Failed to save settings.")
    } finally {
      setIsSaving(false)
    }
  }

  function updateField(field: keyof RetentionSettings, value: string) {
    if (!settings) return
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setSettings({ ...settings, [field]: num })
    }
  }

  if (isLoading) {
    return (
      <div className="mt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Data Retention</h1>
          <p className="mt-1 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Data Retention</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure how long client data and filing records are retained.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Retention Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="statementRetentionDays"
                className="block text-sm font-medium text-gray-700"
              >
                Statement files (days)
              </label>
              <input
                id="statementRetentionDays"
                type="number"
                min={30}
                max={3650}
                value={settings?.statementRetentionDays ?? ""}
                onChange={(e) =>
                  updateField("statementRetentionDays", e.target.value)
                }
                className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                How long uploaded statement files are retained (30-3,650 days).
              </p>
            </div>

            <div>
              <label
                htmlFor="auditLogRetentionDays"
                className="block text-sm font-medium text-gray-700"
              >
                Audit logs (days)
              </label>
              <input
                id="auditLogRetentionDays"
                type="number"
                min={365}
                max={3650}
                value={settings?.auditLogRetentionDays ?? ""}
                onChange={(e) =>
                  updateField("auditLogRetentionDays", e.target.value)
                }
                className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                How long audit log entries are retained (365-3,650 days).
              </p>
            </div>

            <div>
              <label
                htmlFor="inactiveClientArchiveDays"
                className="block text-sm font-medium text-gray-700"
              >
                Inactive client archival (days)
              </label>
              <input
                id="inactiveClientArchiveDays"
                type="number"
                min={90}
                max={3650}
                value={settings?.inactiveClientArchiveDays ?? ""}
                onChange={(e) =>
                  updateField("inactiveClientArchiveDays", e.target.value)
                }
                className="mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Days of inactivity before a client is archived (90-3,650 days).
              </p>
            </div>

            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-xs text-yellow-800">
                Automatic purge is not yet implemented. Settings are saved for future use.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
