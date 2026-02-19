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
import {
  generateFincenXml,
  validateFincenXml,
  type TransmitterConfig,
  type PreparerConfig,
} from "@/lib/export/fincen-xml"

type RouteContext = { params: Promise<{ filingYearId: string }> }

/**
 * Parses a Practice.address JSON field into street/city/state/zip components.
 * Returns empty strings for missing fields.
 */
function parsePracticeAddress(
  address: unknown
): { street: string; city: string; state: string; zip: string; country?: string } {
  if (!address || typeof address !== "object") {
    return { street: "", city: "", state: "", zip: "" }
  }
  const addr = address as Record<string, string | undefined>
  return {
    street: addr.street ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    zip: addr.zip ?? "",
    country: addr.country,
  }
}

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
    // 3. Fetch practice and user for transmitter/preparer config
    // -------------------------------------------------------------------

    const [practice, user, filingYear] = await Promise.all([
      prisma.practice.findUniqueOrThrow({
        where: { id: practiceId },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
      }),
      prisma.filingYear.findUniqueOrThrow({
        where: { id: filingYearId },
        include: { client: true },
      }),
    ])

    // -------------------------------------------------------------------
    // 4. Status check: only export reviewed/approved filings
    // -------------------------------------------------------------------

    if (filingYear.status !== "EXPORTED" && filingYear.status !== "FILED") {
      return new Response(
        JSON.stringify({
          error: `Cannot export XML: filing status is "${filingYear.status}". Filing must be in EXPORTED or FILED status.`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }

    // -------------------------------------------------------------------
    // 5. Validate TCC is configured
    // -------------------------------------------------------------------

    if (!practice.tcc) {
      return new Response(
        JSON.stringify({
          error:
            "Transmitter Control Code (TCC) required for XML export. Configure in Practice settings.",
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    }

    // -------------------------------------------------------------------
    // 6. Build transmitter and preparer configs
    // -------------------------------------------------------------------

    const practiceAddr = parsePracticeAddress(practice.address)

    const nameParts = user.name.trim().split(/\s+/)
    const preparerFirstName = nameParts.slice(0, -1).join(" ") || nameParts[0]
    const preparerLastName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : ""

    const transmitter: TransmitterConfig = {
      name: practice.name,
      tin: practice.ein ?? "",
      tcc: practice.tcc,
      phone: practice.phone ?? "",
      address: practiceAddr,
      contactName: user.name,
    }

    const preparerConfig: PreparerConfig = {
      firstName: preparerFirstName,
      lastName: preparerLastName,
      phone: practice.phone ?? "",
      ptin: user.ptin ?? "",
      selfEmployed: false,
      address: practiceAddr,
      firmName: practice.name,
      firmEin: practice.ein ?? "",
    }

    // -------------------------------------------------------------------
    // 7. Generate XML with pre-fetched data
    // -------------------------------------------------------------------

    const xml = await generateFincenXml(
      filingYearId,
      transmitter,
      preparerConfig,
      summary
    )

    // -------------------------------------------------------------------
    // 8. Validate generated XML
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
    // 9. Audit log
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
          null,
      },
    })

    // -------------------------------------------------------------------
    // 10. Return XML download
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
