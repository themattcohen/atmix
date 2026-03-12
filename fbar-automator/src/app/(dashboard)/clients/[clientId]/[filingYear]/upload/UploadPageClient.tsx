"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { UploadSection } from "@/components/upload/UploadSection"
import { FileList, type StatementSummary } from "@/components/upload/FileList"

interface UploadPageClientProps {
  clientId: string
  filingYear: string
  filingYearId: string
  existingStatements: StatementSummary[]
  existingFileNames: string[]
  isAdmin: boolean
}

export function UploadPageClient({
  clientId,
  filingYear,
  filingYearId,
  existingStatements,
  existingFileNames,
  isAdmin,
}: UploadPageClientProps) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)

  const guardedNav = useCallback(
    (href: string) => {
      if (
        !isActive ||
        window.confirm(
          "Files are still processing on the server and will complete in the background.\n\nLeave this page?"
        )
      ) {
        router.push(href)
      }
    },
    [isActive, router]
  )

  const handleTabClick = useCallback(
    (href: string) => (e: React.MouseEvent) => {
      if (isActive) {
        e.preventDefault()
        guardedNav(href)
      }
    },
    [isActive, guardedNav]
  )

  const handleBackClick = useCallback(
    (e: React.MouseEvent) => {
      if (isActive) {
        e.preventDefault()
        guardedNav(`/clients/${clientId}/${filingYear}`)
      }
    },
    [isActive, guardedNav, clientId, filingYear]
  )

  const tabs = [
    { label: "Overview", href: `/clients/${clientId}/${filingYear}` },
    { label: "Upload", href: `/clients/${clientId}/${filingYear}/upload` },
    { label: "Review", href: `/clients/${clientId}/${filingYear}/review` },
    { label: "Export", href: `/clients/${clientId}/${filingYear}/export` },
  ]

  return (
    <div className="mt-8">
      <Link
        href={`/clients/${clientId}/${filingYear}`}
        onClick={handleBackClick}
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Filing Year {filingYear}
      </Link>

      {/* Navigation Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Filing year tabs">
          {tabs.map((tab) => {
            const isCurrent = tab.label === "Upload"
            return (
              <Link
                key={tab.label}
                href={tab.href}
                onClick={isCurrent ? undefined : handleTabClick(tab.href)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
                aria-current={isCurrent ? "page" : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-6 space-y-8">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Upload Statements
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload foreign bank statements for {filingYear} filing year.
              Supported formats: PDF, CSV, Excel, JPEG, PNG, HEIC, and TIFF.
            </p>
          </div>

          <UploadSection
            clientId={clientId}
            filingYearId={filingYearId}
            filingYear={filingYear}
            existingFileNames={existingFileNames}
            onActiveChange={setIsActive}
          />
        </section>

        <section>
          <FileList
            statements={existingStatements}
            clientId={clientId}
            filingYear={filingYear}
            isAdmin={isAdmin}
            onNavigate={guardedNav}
          />
        </section>
      </div>
    </div>
  )
}
