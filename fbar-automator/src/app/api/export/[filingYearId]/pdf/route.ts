// ---------------------------------------------------------------------------
// GET /api/export/[filingYearId]/pdf
// ---------------------------------------------------------------------------
// Downloads an FBAR workpaper PDF for a filing year. The PDF contains a
// cover/summary page and detailed per-account sections suitable for tax
// practice documentation and internal review.
//
// Authorization: authenticated user whose practice owns the filing year.
// Audit: creates a WORKPAPER_PDF_EXPORTED audit log entry on success.
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFilingYearWithFullData } from "@/lib/approval"
import { generateWorkpaperPdf } from "@/lib/export/pdf"

type RouteContext = { params: Promise<{ filingYearId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const { filingYearId } = await context.params

    // 2. Fetch data once with ownership verification
    const summary = await getFilingYearWithFullData(
      filingYearId,
      session.user.practiceId
    )

    // 3. Generate PDF workpaper with pre-fetched data
    const buffer = await generateWorkpaperPdf(filingYearId, summary)

    // 4. Create audit log entry
    const clientLastName = summary.client.lastName.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )
    const year = summary.filingYear.calendarYear

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        practiceId: session.user.practiceId,
        action: "WORKPAPER_PDF_EXPORTED",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: year,
          clientId: summary.client.id,
          clientLastName: summary.client.lastName,
        },
        ipAddress: null,
      },
    })

    // 5. Return PDF download
    const filename = `fbar_workpaper_${year}_${clientLastName}.pdf`

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("GET /api/export/[filingYearId]/pdf error:", error)
    return new Response(
      JSON.stringify({
        error: "An internal error occurred. Please try again later.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
