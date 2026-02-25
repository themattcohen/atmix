"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
