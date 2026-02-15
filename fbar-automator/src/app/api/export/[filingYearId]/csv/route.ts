// ---------------------------------------------------------------------------
// GET /api/export/[filingYearId]/csv
// ---------------------------------------------------------------------------
// Downloads FBAR data as a CSV file. Supports two export types via query param:
//   ?type=fbar     (default) Full FBAR export with filer info and all accounts
//   ?type=accounts           Simplified account list for tax preparer workpapers
//
// Authorization: authenticated user whose practice owns the filing year.
// Filing status must be REVIEWED, EXPORTED, or FILED.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFilingYearWithFullData } from "@/lib/approval"
import { generateFBARCsv, generateAccountsCsv } from "@/lib/export/csv"

type RouteContext = { params: Promise<{ filingYearId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { filingYearId } = await context.params

    // 2. Fetch data once with ownership verification
    const summary = await getFilingYearWithFullData(
      filingYearId,
      session.user.practiceId
    )

    // 3. Status check: only export reviewed/approved filings
    const allowedStatuses = ["REVIEWED", "EXPORTED", "FILED"]
    if (!allowedStatuses.includes(summary.filingYear.status)) {
      return new Response(
        JSON.stringify({
          error: `Cannot export CSV: filing status is "${summary.filingYear.status}". Filing must be in REVIEWED, EXPORTED, or FILED status.`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }

    // 4. Determine export type from query params
    const { searchParams } = new URL(request.url)
    const exportType = searchParams.get("type") ?? "fbar"

    if (exportType !== "fbar" && exportType !== "accounts") {
      return new Response(
        JSON.stringify({ error: 'Invalid export type. Use "fbar" or "accounts".' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // 5. Generate CSV with pre-fetched data
    const csv =
      exportType === "fbar"
        ? await generateFBARCsv(filingYearId, summary)
        : await generateAccountsCsv(filingYearId, summary)

    // 6. Audit log for CSV export
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        practiceId: session.user.practiceId,
        action: "FILING_EXPORTED_CSV",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          exportType,
          calendarYear: summary.filingYear.calendarYear,
          clientLastName: summary.client.lastName,
          accountCount: summary.accounts.length,
        },
      },
    })

    // 7. Build filename
    const lastName = summary.client.lastName.replace(/[^a-zA-Z0-9]/g, "_")
    const year = summary.filingYear.calendarYear
    const suffix = exportType === "accounts" ? "_accounts" : ""
    const filename = `fbar_${lastName}_${year}${suffix}.csv`

    // 8. Return CSV download
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("GET /api/export/[filingYearId]/csv error:", error)
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
