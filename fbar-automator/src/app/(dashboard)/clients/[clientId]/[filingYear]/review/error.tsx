"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export default function ReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Review page error:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Review page error
      </h2>
      <p className="mt-2 max-w-md text-center text-sm text-gray-500">
        There was a problem loading the review data. This may be a temporary issue — try again or go back.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/clients"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Clients
        </Link>
      </div>
    </div>
  )
}
