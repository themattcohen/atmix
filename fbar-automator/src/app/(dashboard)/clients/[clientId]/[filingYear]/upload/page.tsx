import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { UploadSection } from "@/components/upload/UploadSection"
import { FileList, type StatementSummary } from "@/components/upload/FileList"

interface UploadPageProps {
  params: Promise<{ clientId: string; filingYear: string }>
}

export default async function UploadPage({ params }: UploadPageProps) {
  const { clientId, filingYear } = await params
  const session = await auth()
  if (!session?.user) {
    return null // or redirect("/login")
  }

  // Placeholder: in production, fetch existing statements from the database
  const existingStatements: StatementSummary[] = []

  // Placeholder: in production, resolve the filing year record ID from clientId + filingYear
  const filingYearId = `${clientId}-${filingYear}`

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
            <FileList statements={existingStatements} />
          </section>
        </div>
      </div>
    </>
  )
}
