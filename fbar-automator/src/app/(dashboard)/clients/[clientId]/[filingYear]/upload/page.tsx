import { redirect, notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { UploadPageClient } from "./UploadPageClient"
import type { StatementSummary } from "@/components/upload/FileList"

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
    processingError: stmt.processingError,
    createdAt: stmt.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    }),
    ...(stmt.extractedData ? { extractedAccountCount: 1 } : {}),
  }))

  const filingYearId = filingYearRecord.id

  return (
    <>
      <Header
        title="Upload Bank Statements"
        userName={session.user.name || ""}
      />

      <UploadPageClient
        clientId={clientId}
        filingYear={filingYear}
        filingYearId={filingYearId}
        existingStatements={existingStatements}
        existingFileNames={existingStatements.map((s) => s.fileName)}
        isAdmin={session.user.role === "ADMIN"}
      />
    </>
  )
}
