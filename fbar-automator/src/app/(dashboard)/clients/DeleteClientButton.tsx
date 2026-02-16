"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface DeleteClientButtonProps {
  clientId: string
  clientName: string
}

export function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete client.")
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3">
        <p className="text-xs font-medium text-red-800">
          Delete {clientName}?
        </p>
        <p className="mt-1 text-xs text-red-700">
          This permanently removes the client and all their data.
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setConfirming(false); setError(null) }}
            disabled={deleting}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setConfirming(true)}
      title="Delete client"
    >
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  )
}
