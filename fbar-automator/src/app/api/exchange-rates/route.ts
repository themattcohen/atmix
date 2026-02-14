import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { getRatesForYear, syncTreasuryRates } from "@/lib/treasury"

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const yearQuerySchema = z.coerce
  .number()
  .int()
  .min(2000)
  .max(2100)

const syncBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
})

// ---------------------------------------------------------------------------
// GET /api/exchange-rates?year=2024
//
// Returns the Treasury exchange rates for a given calendar year. These are
// the Dec 31 rates used for FBAR USD conversion.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    // 2. Validate the year query parameter
    const yearParam = request.nextUrl.searchParams.get("year")
    if (!yearParam) {
      return NextResponse.json(
        { error: "year query parameter is required." },
        { status: 400 }
      )
    }

    const parsed = yearQuerySchema.safeParse(yearParam)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "year must be a valid integer between 2000 and 2100." },
        { status: 400 }
      )
    }

    const year = parsed.data

    // 3. Fetch rates from the treasury service
    const rates = await getRatesForYear(year)

    return NextResponse.json({ year, rates })
  } catch (error) {
    console.error("GET /api/exchange-rates error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/exchange-rates
//
// Manually trigger a sync of Treasury exchange rates for a given year.
// Restricted to ADMIN users only.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    // 2. Require ADMIN role
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin access required." },
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const parsed = syncBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { year } = parsed.data

    // 4. Sync rates from Treasury
    const count = await syncTreasuryRates(year)

    return NextResponse.json({
      success: true,
      year,
      ratesSynced: count,
    })
  } catch (error) {
    console.error("POST /api/exchange-rates error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
