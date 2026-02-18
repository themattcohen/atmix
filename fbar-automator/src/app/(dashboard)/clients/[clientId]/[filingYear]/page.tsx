import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Clock,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFilingProgress } from "@/lib/approval"
import { FilingActions } from "./FilingActions"

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-gray-100 text-gray-700",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700",
  },
  REVIEWED: {
    label: "Reviewed",
    className: "bg-yellow-100 text-yellow-700",
  },
  EXPORTED: {
    label: "Exported",
    className: "bg-green-100 text-green-700",
  },
  FILED: {
    label: "Filed",
    className: "bg-green-100 text-green-700",
  },
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface FilingYearPageProps {
  params: Promise<{ clientId: string; filingYear: string }>
}

export default async function FilingYearPage({
  params,
}: FilingYearPageProps) {
  const { clientId, filingYear } = await params
  const session = await auth()
  if (!session?.user?.practiceId) redirect("/login")

  const practiceId = session.user.practiceId
  const role = session.user.role || "PREPARER"
  const calendarYear = parseInt(filingYear, 10)

  if (isNaN(calendarYear)) notFound()

  // Fetch client and filing year in a single query using include
  const filingYearRecord = await prisma.filingYear.findUnique({
    where: {
      clientId_calendarYear: {
        clientId,
        calendarYear,
      },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          practiceId: true,
        },
      },
    },
  })

  if (!filingYearRecord || filingYearRecord.client.practiceId !== practiceId) {
    notFound()
  }

  const client = filingYearRecord.client

  // Get filing progress
  const progress = await getFilingProgress(filingYearRecord.id)

  const clientName = client.firstName
    ? `${client.firstName} ${client.lastName}`
    : client.lastName

  const badge = STATUS_BADGE[progress.status]

  // Navigation tabs
  const tabs = [
    { label: "Overview", href: `/clients/${clientId}/${filingYear}` },
    { label: "Upload", href: `/clients/${clientId}/${filingYear}/upload` },
    { label: "Review", href: `/clients/${clientId}/${filingYear}/review` },
    { label: "Export", href: `/clients/${clientId}/${filingYear}/export` },
  ]

  return (
    <>
      <Header
        title={`${clientName} - ${filingYear} FBAR`}
        userName={session.user.name || ""}
      />

      <div className="mt-8">
        <Link
          href={`/clients/${clientId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Client
        </Link>

        {/* Navigation Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Filing year tabs">
            {tabs.map((tab) => {
              const isActive = tab.label === "Overview"
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Status Overview */}
        <div className="mt-6 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Filing Year {filingYear}
          </h2>
          {badge && (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
        </div>

        {/* Progress Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Statements */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statements</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {progress.completedStatements}{" "}
                    <span className="text-sm font-normal text-gray-400">
                      / {progress.totalStatements}
                    </span>
                  </p>
                </div>
              </div>
              {progress.failedStatements > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  {progress.failedStatements} failed
                </p>
              )}
              {progress.pendingStatements > 0 && (
                <p className="mt-1 text-xs text-yellow-600">
                  {progress.pendingStatements} pending
                </p>
              )}
            </CardContent>
          </Card>

          {/* Accounts Reviewed */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Accounts Reviewed</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {progress.reviewedAccounts}{" "}
                    <span className="text-sm font-normal text-gray-400">
                      / {progress.totalAccounts}
                    </span>
                  </p>
                </div>
              </div>
              {progress.isFullyReviewed && (
                <p className="mt-2 text-xs text-green-600">
                  All accounts reviewed
                </p>
              )}
            </CardContent>
          </Card>

          {/* Aggregate Max Value */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    progress.exceedsThreshold
                      ? "bg-yellow-50"
                      : "bg-gray-50"
                  }`}
                >
                  <DollarSign
                    className={`h-5 w-5 ${
                      progress.exceedsThreshold
                        ? "text-yellow-600"
                        : "text-gray-600"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Aggregate Max Value (USD)</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatUSD(progress.aggregateMaxValueUSD)}
                  </p>
                </div>
              </div>
              {progress.exceedsThreshold ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  Exceeds $10,000 threshold - FBAR required
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Below $10,000 threshold
                </p>
              )}
            </CardContent>
          </Card>

          {/* Filing Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Filing Status</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {badge?.label || progress.status}
                  </p>
                </div>
              </div>
              {filingYearRecord.reviewedAt && (
                <p className="mt-2 text-xs text-gray-500">
                  Reviewed:{" "}
                  {new Date(filingYearRecord.reviewedAt).toLocaleDateString(
                    "en-US"
                  )}
                </p>
              )}
              {filingYearRecord.filedAt && (
                <p className="mt-1 text-xs text-gray-500">
                  Filed:{" "}
                  {new Date(filingYearRecord.filedAt).toLocaleDateString(
                    "en-US"
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <FilingActions
          filingYearId={filingYearRecord.id}
          status={progress.status}
          isFullyReviewed={progress.isFullyReviewed}
          isReadyForReview={progress.isReadyForReview}
          userRole={role}
          totalStatements={progress.totalStatements}
          pendingStatements={progress.pendingStatements}
          failedStatements={progress.failedStatements}
          totalAccounts={progress.totalAccounts}
          reviewedAccounts={progress.reviewedAccounts}
        />

        {/* Progress Banner */}
        {!progress.isFullyReviewed && progress.totalAccounts > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-amber-800">
                {progress.reviewedAccounts} of {progress.totalAccounts} accounts reviewed. Complete all reviews to submit this filing.
              </p>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-amber-100">
              <div
                className="h-2 rounded-full bg-amber-500 transition-all"
                style={{ width: `${progress.totalAccounts > 0 ? (progress.reviewedAccounts / progress.totalAccounts) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Links */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Upload Statements */}
              <Link
                href={`/clients/${clientId}/${filingYear}/upload`}
                className={`rounded-lg border p-4 text-sm transition-colors ${
                  progress.totalStatements === 0
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <p className={`font-medium ${progress.totalStatements === 0 ? "text-blue-900" : "text-gray-900"}`}>
                  Upload Statements
                </p>
                <p className={`mt-1 ${progress.totalStatements === 0 ? "text-blue-700" : "text-gray-500"}`}>
                  {progress.totalStatements === 0 ? "Start here — upload bank statements" : `${progress.totalStatements} statements uploaded`}
                </p>
              </Link>

              {/* Review Accounts */}
              <Link
                href={`/clients/${clientId}/${filingYear}/review`}
                className={`rounded-lg border p-4 text-sm transition-colors ${
                  progress.totalStatements > 0 && !progress.isFullyReviewed
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                    : progress.totalStatements === 0
                      ? "border-gray-200 opacity-60"
                      : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <p className={`font-medium ${
                  progress.totalStatements > 0 && !progress.isFullyReviewed ? "text-blue-900" : "text-gray-900"
                }`}>
                  Review Accounts
                </p>
                <p className={`mt-1 ${
                  progress.totalStatements > 0 && !progress.isFullyReviewed ? "text-blue-700" : "text-gray-500"
                }`}>
                  {progress.reviewedAccounts} of {progress.totalAccounts} reviewed
                </p>
              </Link>

              {/* Export Filing */}
              <Link
                href={`/clients/${clientId}/${filingYear}/export`}
                className={`rounded-lg border p-4 text-sm transition-colors ${
                  progress.isFullyReviewed
                    ? "border-green-300 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-200 opacity-60"
                }`}
              >
                <p className={`font-medium ${progress.isFullyReviewed ? "text-green-900" : "text-gray-900"}`}>
                  Export Filing
                </p>
                <p className={`mt-1 ${progress.isFullyReviewed ? "text-green-700" : "text-gray-500"}`}>
                  {progress.isReadyForExport ? "Ready for export" : "Complete review first"}
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

