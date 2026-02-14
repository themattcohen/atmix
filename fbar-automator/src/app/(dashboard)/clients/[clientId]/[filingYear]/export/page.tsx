import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft,
  FileSpreadsheet,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFilingProgress } from "@/lib/approval"
import { ExportDownloadButtons } from "./ExportDownloadButtons"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportPageProps {
  params: Promise<{ clientId: string; filingYear: string }>
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    REVIEWED: "bg-yellow-100 text-yellow-800",
    EXPORTED: "bg-green-100 text-green-700",
    FILED: "bg-purple-100 text-purple-700",
  }
  const colorClass = colorMap[status] || "bg-gray-100 text-gray-700"
  const label = status.replace(/_/g, " ")

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function ExportPage({ params }: ExportPageProps) {
  const { clientId, filingYear } = await params
  const session = await auth()
  if (!session?.user?.practiceId) redirect("/login")

  // Fetch the filing year record
  const filingYearRecord = await prisma.filingYear.findFirst({
    where: {
      clientId,
      calendarYear: parseInt(filingYear, 10),
      client: { practiceId: session.user.practiceId },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  if (!filingYearRecord) {
    return (
      <>
        <Header
          title="Export FBAR Data"
          userName={session.user.name || ""}
        />
        <div className="mt-8">
          <Link
            href={`/clients/${clientId}/${filingYear}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Filing Year {filingYear}
          </Link>
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="h-8 w-8 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">
                Filing year not found.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Get filing progress data
  const progress = await getFilingProgress(filingYearRecord.id)

  const clientName = [
    filingYearRecord.client.firstName,
    filingYearRecord.client.lastName,
  ]
    .filter(Boolean)
    .join(" ")

  // Determine export readiness
  const isExportReady = ["REVIEWED", "EXPORTED", "FILED"].includes(
    progress.status
  )
  const isXmlReady = ["EXPORTED", "FILED"].includes(progress.status)

  // Format aggregate value
  const formattedAggregateValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(progress.aggregateMaxValueUSD)

  // Tab navigation
  const tabs = [
    { label: "Overview", href: `/clients/${clientId}/${filingYear}` },
    { label: "Upload", href: `/clients/${clientId}/${filingYear}/upload` },
    { label: "Review", href: `/clients/${clientId}/${filingYear}/review` },
    { label: "Export", href: `/clients/${clientId}/${filingYear}/export` },
  ]

  return (
    <>
      <Header title="Export FBAR Data" userName={session.user.name || ""} />

      <div className="mt-8">
        <Link
          href={`/clients/${clientId}/${filingYear}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Filing Year {filingYear}
        </Link>

        {/* Navigation Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Filing year tabs">
            {tabs.map((tab) => {
              const isActive = tab.label === "Export"
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

        {/* Filing Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Filing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Client</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {clientName}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <div className="mt-1">
                  <StatusBadge status={progress.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Accounts Reviewed
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {progress.reviewedAccounts} / {progress.totalAccounts}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Aggregate Max Value
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formattedAggregateValue}
                </p>
              </div>
            </div>

            {!isExportReady && (
              <div
                className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Filing not ready for export</p>
                  <p className="mt-0.5 text-xs">
                    All accounts must be reviewed and the filing must be
                    submitted for review before exporting. Current status:{" "}
                    {progress.status.replace(/_/g, " ")}.
                  </p>
                </div>
              </div>
            )}

            {isExportReady && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Filing is ready for export.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Options Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* CSV Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                CSV / Excel Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Download account data as CSV for use in spreadsheets and tax
                software.
              </p>
              <div className="mt-4 space-y-2">
                <ExportDownloadButtons
                  filingYearId={filingYearRecord.id}
                  type="csv"
                  isReady={true}
                />
              </div>
            </CardContent>
          </Card>

          {/* FinCEN XML Export */}
          <Card className={!isXmlReady ? "opacity-75" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode className="h-5 w-5 text-green-600" />
                FinCEN BSA E-Filing XML
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Generate XML file for direct upload to the FinCEN BSA E-Filing
                portal.
              </p>
              <div className="mt-4">
                {isXmlReady ? (
                  <ExportDownloadButtons
                    filingYearId={filingYearRecord.id}
                    type="xml"
                    isReady={true}
                  />
                ) : (
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      XML export is available after the filing has been approved
                      for export (status: EXPORTED or FILED).
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PDF Workpaper Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-red-600" />
                PDF Workpaper Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Generate formatted workpaper for practice documentation and
                record retention.
              </p>
              <div className="mt-4">
                <ExportDownloadButtons
                  filingYearId={filingYearRecord.id}
                  type="pdf"
                  isReady={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
