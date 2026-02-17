import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft, FileWarning } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/Card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { ExtractionResult, ExtractedAccount } from "@/types/extraction"
import { consolidateAccounts } from "@/lib/consolidation"
import type { StatementWithExtraction } from "@/lib/consolidation"
import { ReviewPageClient } from "./ReviewPageClient"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewPageProps {
  params: Promise<{ clientId: string; filingYear: string }>
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { clientId, filingYear } = await params
  const session = await auth()
  if (!session?.user?.practiceId) {
    redirect("/login")
  }

  const practiceId = session.user.practiceId
  const calendarYear = parseInt(filingYear, 10)
  if (isNaN(calendarYear)) {
    notFound()
  }

  // Verify client ownership
  const client = await prisma.client.findFirst({
    where: { id: clientId, practiceId },
    select: { id: true },
  })
  if (!client) {
    notFound()
  }

  // Find the filing year record for this client
  const filingYearRecord = await prisma.filingYear.findUnique({
    where: {
      clientId_calendarYear: {
        clientId,
        calendarYear,
      },
    },
  })

  if (!filingYearRecord) {
    return (
      <>
        <Header
          title="Review Extracted Data"
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
              <FileWarning className="h-8 w-8 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">
                Filing year not found.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Fetch client's foreign accounts for matching
  const foreignAccounts = await prisma.foreignAccount.findMany({
    where: { clientId, isActive: true },
    select: { id: true, accountNumber: true, institutionName: true },
  })

  // Fetch completed statements with extracted data - use select for efficiency
  const statements = await prisma.statement.findMany({
    where: {
      filingYearId: filingYearRecord.id,
      processingStatus: "COMPLETED",
      extractedData: { isNot: null },
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      filePath: true,
      createdAt: true,
      extractedData: {
        select: {
          rawLlmResponse: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Build statement data with file URLs and parsed accounts
  const statementData: StatementWithExtraction[] = statements.map((stmt) => {
    // Use API proxy route instead of presigned URLs to avoid CORS issues
    const fileUrl = `/api/files/${encodeURIComponent(stmt.filePath)}`

    // Parse accounts from the raw LLM response stored in extractedData
    let accounts: ExtractedAccount[] = []
    if (stmt.extractedData?.rawLlmResponse) {
      try {
        const raw = stmt.extractedData.rawLlmResponse as unknown
        // rawLlmResponse is the full ExtractionResult JSON
        const extraction = raw as ExtractionResult
        if (extraction.accounts && Array.isArray(extraction.accounts)) {
          accounts = extraction.accounts
        }
      } catch {
        // If parsing fails, leave accounts empty.
      }
    }

    return {
      id: stmt.id,
      fileName: stmt.fileName,
      fileType: stmt.fileType,
      filePath: stmt.filePath,
      presignedUrl: fileUrl,
      accounts,
    }
  })

  // Consolidate accounts across all statements
  const consolidatedAccounts = consolidateAccounts(
    statementData,
    foreignAccounts,
    calendarYear
  )

  // Build presigned URL map for drill-down document viewing
  const presignedUrlMap: Record<string, string> = {}
  for (const stmt of statementData) {
    presignedUrlMap[stmt.id] = stmt.presignedUrl
  }

  const hasStatements = statementData.length > 0

  return (
    <>
      <Header
        title="Review Extracted Data"
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

        {/* Navigation Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Filing year tabs">
            {[
              { label: "Overview", href: `/clients/${clientId}/${filingYear}` },
              { label: "Upload", href: `/clients/${clientId}/${filingYear}/upload` },
              { label: "Review", href: `/clients/${clientId}/${filingYear}/review` },
              { label: "Export", href: `/clients/${clientId}/${filingYear}/export` },
            ].map((tab) => {
              const isActive = tab.label === "Review"
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

        {hasStatements ? (
          <div className="mt-6">
            <ReviewPageClient
              consolidatedAccounts={consolidatedAccounts}
              presignedUrlMap={presignedUrlMap}
              statements={statementData}
              clientId={clientId}
              filingYear={filingYear}
              filingYearId={filingYearRecord.id}
              foreignAccounts={foreignAccounts}
            />
          </div>
        ) : (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileWarning className="h-8 w-8 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">
                No completed extractions to review. Upload and process
                statements first.
              </p>
              <Link
                href={`/clients/${clientId}/${filingYear}/upload`}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Go to Upload
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
