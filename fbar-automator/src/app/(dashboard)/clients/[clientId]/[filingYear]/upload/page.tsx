import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect, notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { UploadSection } from "@/components/upload/UploadSection"
import { FileList, type StatementSummary } from "@/components/upload/FileList"

interface UploadPageProps {
  params: Promise<{ clientId: string; filingYear: string }>
}

export default async function UploadPage({ params }: UploadPageProps) {
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

  // Find filing year record
  const filingYearRecord = await prisma.filingYear.findUnique({
    where: {
      clientId_calendarYear: {
        clientId,
        calendarYear,
      },
    },
  })
  if (!filingYearRecord) {
    notFound()
  }

  // Fetch existing statements
  const statements = await prisma.statement.findMany({
    where: { filingYearId: filingYearRecord.id },
    include: {
      extractedData: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Map to StatementSummary format
  const existingStatements: StatementSummary[] = statements.map((stmt) => ({
    id: stmt.id,
    fileName: stmt.fileName,
    fileType: stmt.fileType,
    fileSizeBytes: stmt.fileSizeBytes,
    processingStatus: stmt.processingStatus as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
    createdAt: stmt.createdAt.toISOString(),
    ...(stmt.extractedData ? { extractedAccountCount: 1 } : {}),
  }))

  const filingYearId = filingYearRecord.id

  return (
    <>
      <Header
        title="Upload Bank Statements"
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
              const isActive = tab.label === "Upload"
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

        <div className="mt-6 space-y-8">
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Upload Statements
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload foreign bank statements for {filingYear} filing year.
                Supported formats: PDF, JPEG, PNG, HEIC, and TIFF.
              </p>
            </div>

            <UploadSection clientId={clientId} filingYearId={filingYearId} />
          </section>

          <section>
            <FileList statements={existingStatements} clientId={clientId} filingYear={filingYear} />
          </section>
        </div>
      </div>
    </>
  )
}
