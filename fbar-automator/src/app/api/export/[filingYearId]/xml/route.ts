// ---------------------------------------------------------------------------
// GET /api/export/[filingYearId]/xml
// ---------------------------------------------------------------------------
// Downloads FBAR data as a FinCEN BSA E-Filing XML file. The XML follows
// the EFL_FBARXBatchSchema.xsd structure suitable for batch upload to the
// FinCEN BSA E-Filing System.
//
// SECURITY: The exported XML contains unmasked TINs and full account numbers.
// This is required by FinCEN for filing. The download is restricted to
// authenticated users within the owning practice, and only for filings in
// EXPORTED or FILED status (meaning they have been reviewed and approved).
//
// Authorization: authenticated user whose practice owns the filing year.
// Filing status must be EXPORTED or FILED.
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFilingYearWithFullData } from "@/lib/approval"
import { generateFincenXml, validateFincenXml } from "@/lib/export/fincen-xml"

type RouteContext = { params: Promise<{ filingYearId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // -------------------------------------------------------------------
    // 1. Authentication
    // -------------------------------------------------------------------

    const session = await auth()
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const { id: userId, practiceId } = session.user
    const { filingYearId } = await context.params

    // -------------------------------------------------------------------
    // 2. Fetch data once with ownership verification
    // -------------------------------------------------------------------

    const summary = await getFilingYearWithFullData(filingYearId, practiceId)

    // -------------------------------------------------------------------
    // 3. Status check: only export reviewed/approved filings
    // -------------------------------------------------------------------

    // Need to fetch filing year status separately since summary doesn't have full filing details
    const filingYear = await prisma.filingYear.findUniqueOrThrow({
      where: { id: filingYearId },
      include: { client: true },
    })

    if (filingYear.status !== "EXPORTED" && filingYear.status !== "FILED") {
      return new Response(
        JSON.stringify({
          error: `Cannot export XML: filing status is "${filingYear.status}". Filing must be in EXPORTED or FILED status.`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }

    // -------------------------------------------------------------------
    // 4. Generate XML with pre-fetched data
    // -------------------------------------------------------------------

    const xml = await generateFincenXml(filingYearId, summary)

    // -------------------------------------------------------------------
    // 5. Validate generated XML
    // -------------------------------------------------------------------

    const validation = validateFincenXml(xml)
    if (!validation.isValid) {
      console.error(
        "FinCEN XML validation failed for filingYearId:",
        filingYearId,
        validation.errors
      )
      return new Response(
        JSON.stringify({
          error: "Generated XML failed validation.",
          details: validation.errors,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    }

    // -------------------------------------------------------------------
    // 6. Audit log
    // -------------------------------------------------------------------

    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "FBAR_XML_EXPORTED",
        entityType: "FilingYear",
        entityId: filingYearId,
        metadata: {
          calendarYear: filingYear.calendarYear,
          clientId: filingYear.clientId,
          clientLastName: filingYear.client.lastName,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
      },
    })

    // -------------------------------------------------------------------
    // 7. Return XML download
    // -------------------------------------------------------------------

    const lastName = filingYear.client.lastName.replace(/[^a-zA-Z0-9]/g, "_")
    const year = filingYear.calendarYear
    const filename = `fbar_${year}_${lastName}.xml`

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("GET /api/export/[filingYearId]/xml error:", error)
    return new Response(
      JSON.stringify({
        error: "An internal error occurred. Please try again later.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
