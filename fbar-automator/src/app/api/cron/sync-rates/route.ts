import { NextRequest, NextResponse } from "next/server"
import { syncTreasuryRates } from "@/lib/treasury"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error("CRON_SECRET not configured")
      return NextResponse.json(
        { error: "Cron endpoint not configured." },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      )
    }

    // FBAR rates are for the prior calendar year
    const targetYear = new Date().getFullYear() - 1

    const count = await syncTreasuryRates(targetYear)

    return NextResponse.json({
      message: `Synced ${count} exchange rates for ${targetYear}.`,
      year: targetYear,
      ratesSynced: count,
    })
  } catch (error) {
    console.error("POST /api/cron/sync-rates error:", error)
    return NextResponse.json(
      { error: "Failed to sync exchange rates." },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // GET handler mirrors POST for Vercel/Railway cron compatibility
  return POST(request)
}
