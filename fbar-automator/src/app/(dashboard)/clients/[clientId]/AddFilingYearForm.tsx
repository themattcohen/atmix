"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface AddFilingYearFormProps {
  clientId: string
}

export function AddFilingYearForm({ clientId }: AddFilingYearFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarYear, setCalendarYear] = useState(
    String(new Date().getFullYear() - 1)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const year = parseInt(calendarYear, 10)
    if (isNaN(year) || year < 2000 || year > 2099) {
      setError("Please enter a valid year between 2000 and 2099.")
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch(`/api/clients/${clientId}/filing-years`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarYear: year }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create filing year.")
        return
      }

      setOpen(false)
      setError(null)
      router.push(`/clients/${clientId}/${year}`)
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
        Add Year
      </Button>
    )
  }

  return (
    <div className="w-full mt-2 rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">New Filing Year</h4>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Calendar Year *
          </label>
          <Input
            type="number"
            min={2000}
            max={2099}
            value={calendarYear}
            onChange={(e) => setCalendarYear(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Create
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setOpen(false); setError(null) }}
        >
          Cancel
        </Button>
      </form>
    </div>
  )
}
