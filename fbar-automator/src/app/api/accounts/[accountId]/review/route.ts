import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { convertToUSD } from "@/lib/currency"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ accountId: string }> }

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const reviewBodySchema = z
  .object({
    filingYearId: z.string().uuid(),
    maxValueLocal: z.number().nonnegative(),
    currencyCode: z.string().min(3).max(3),
    corrections: z
      .record(
        z.string(),
        z.object({
          original: z.unknown(),
          corrected: z.unknown(),
        })
      )
      .optional(),
    isValueUnknown: z.boolean().optional(),
    manualRate: z.number().positive().optional(),
    manualRateJustification: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      // If a manual rate is provided, justification is required
      if (data.manualRate != null && !data.manualRateJustification) {
        return false
      }
      return true
    },
    {
      message: "manualRateJustification is required when manualRate is provided.",
      path: ["manualRateJustification"],
    }
  )

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Fetch a foreign account and verify it belongs to the authenticated user's
 * practice via the client ownership chain.
 */
async function getAuthorizedAccount(accountId: string, practiceId: string) {
  const account = await prisma.foreignAccount.findFirst({
    where: {
      id: accountId,
      client: {
        practiceId,
      },
    },
    include: {
      client: {
        select: { practiceId: true },
      },
    },
  })

  return account
}

// ---------------------------------------------------------------------------
// POST /api/accounts/[accountId]/review
//
// Approve / review an account for a filing year. Creates or updates the
// ReviewedAccountYear record with the confirmed max value, exchange rate,
// and any corrections the reviewer made to the extracted data.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { id: userId, practiceId } = session.user
    const { accountId } = await context.params

    // Validate UUID format for accountId
    if (!UUID_REGEX.test(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID format." },
        { status: 400 }
      )
    }

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const parsed = reviewBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const {
      filingYearId,
      maxValueLocal,
      currencyCode,
      corrections,
      isValueUnknown,
      manualRate,
      manualRateJustification,
    } = parsed.data

    // 3. Verify the account belongs to the user's practice
    const account = await getAuthorizedAccount(accountId, practiceId)
    if (!account) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      )
    }

    // 4. Verify the filing year exists and belongs to the same practice
    const filingYear = await prisma.filingYear.findUnique({
      where: { id: filingYearId },
      include: {
        client: {
          select: { practiceId: true },
        },
      },
    })

    if (!filingYear || filingYear.client.practiceId !== practiceId) {
      return NextResponse.json(
        { error: "Filing year not found." },
        { status: 404 }
      )
    }

    // 5. Determine the exchange rate
    let exchangeRate: number
    let exchangeRateSource: "TREASURY" | "MANUAL"
    let maxValueUsd: number

    if (manualRate != null) {
      // Manual rate provided by the reviewer
      exchangeRate = manualRate
      exchangeRateSource = "MANUAL"
      maxValueUsd = maxValueLocal / exchangeRate
    } else if (currencyCode === "USD") {
      // No conversion needed for USD accounts
      exchangeRate = 1
      exchangeRateSource = "TREASURY"
      maxValueUsd = maxValueLocal
    } else {
      // Use the Treasury rate via the currency conversion service
      const conversion = await convertToUSD(
        maxValueLocal,
        currencyCode,
        filingYear.calendarYear
      )
      if (!conversion) {
        return NextResponse.json(
          { error: `No exchange rate found for ${currencyCode} in ${filingYear.calendarYear}` },
          { status: 422 }
        )
      }
      exchangeRate = conversion.exchangeRate
      exchangeRateSource = conversion.source as "TREASURY" | "MANUAL"
      maxValueUsd = conversion.usdAmount
    }

    // 6. Upsert ReviewedAccountYear
    const reviewedAccountYear = await prisma.reviewedAccountYear.upsert({
      where: {
        foreignAccountId_filingYearId: {
          foreignAccountId: accountId,
          filingYearId,
        },
      },
      create: {
        foreignAccountId: accountId,
        filingYearId,
        maxValueLocal,
        currencyCode,
        exchangeRate,
        exchangeRateSource,
        manualRateJustification: manualRateJustification ?? null,
        maxValueUsd,
        isValueUnknown: isValueUnknown ?? false,
        reviewedById: userId,
        reviewedAt: new Date(),
        corrections: corrections ? (corrections as unknown as Prisma.InputJsonValue) : undefined,
      },
      update: {
        maxValueLocal,
        currencyCode,
        exchangeRate,
        exchangeRateSource,
        manualRateJustification: manualRateJustification ?? null,
        maxValueUsd,
        isValueUnknown: isValueUnknown ?? false,
        reviewedById: userId,
        reviewedAt: new Date(),
        corrections: corrections ? (corrections as unknown as Prisma.InputJsonValue) : undefined,
      },
    })

    // 7. Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId,
        practiceId,
        action: "ACCOUNT_REVIEWED",
        entityType: "ReviewedAccountYear",
        entityId: reviewedAccountYear.id,
        metadata: {
          foreignAccountId: accountId,
          filingYearId,
          currencyCode,
          maxValueLocal,
          maxValueUsd,
          exchangeRateSource,
          hasCorrections: corrections != null,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip"),
      },
    })

    // 8. Update FilingYear status to IN_PROGRESS if currently NOT_STARTED
    if (filingYear.status === "NOT_STARTED") {
      await prisma.filingYear.update({
        where: { id: filingYearId },
        data: { status: "IN_PROGRESS" },
      })
    }

    // 9. Return the created/updated record
    return NextResponse.json({
      id: reviewedAccountYear.id,
      foreignAccountId: reviewedAccountYear.foreignAccountId,
      filingYearId: reviewedAccountYear.filingYearId,
      maxValueLocal: reviewedAccountYear.maxValueLocal?.toString() ?? null,
      currencyCode: reviewedAccountYear.currencyCode,
      exchangeRate: reviewedAccountYear.exchangeRate?.toString() ?? null,
      exchangeRateSource: reviewedAccountYear.exchangeRateSource,
      manualRateJustification: reviewedAccountYear.manualRateJustification,
      maxValueUsd: reviewedAccountYear.maxValueUsd?.toString() ?? null,
      isValueUnknown: reviewedAccountYear.isValueUnknown,
      reviewedById: reviewedAccountYear.reviewedById,
      reviewedAt: reviewedAccountYear.reviewedAt,
      corrections: reviewedAccountYear.corrections,
    })
  } catch (error) {
    console.error("POST /api/accounts/[accountId]/review error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/accounts/[accountId]/review?filingYearId=xxx
//
// Returns the ReviewedAccountYear for the given account and filing year,
// or null if the account has not yet been reviewed for that year.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const { practiceId } = session.user
    const { accountId } = await context.params

    // Validate UUID format for accountId
    if (!UUID_REGEX.test(accountId)) {
      return NextResponse.json(
        { error: "Invalid account ID format." },
        { status: 400 }
      )
    }

    // 2. Validate query params
    const filingYearId = request.nextUrl.searchParams.get("filingYearId")
    if (!filingYearId) {
      return NextResponse.json(
        { error: "filingYearId query parameter is required." },
        { status: 400 }
      )
    }

    // 3. Verify the account belongs to the user's practice
    const account = await getAuthorizedAccount(accountId, practiceId)
    if (!account) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      )
    }

    // 4. Fetch the ReviewedAccountYear if it exists
    const reviewedAccountYear = await prisma.reviewedAccountYear.findUnique({
      where: {
        foreignAccountId_filingYearId: {
          foreignAccountId: accountId,
          filingYearId,
        },
      },
    })

    if (!reviewedAccountYear) {
      return NextResponse.json({ review: null })
    }

    return NextResponse.json({
      review: {
        id: reviewedAccountYear.id,
        foreignAccountId: reviewedAccountYear.foreignAccountId,
        filingYearId: reviewedAccountYear.filingYearId,
        maxValueLocal: reviewedAccountYear.maxValueLocal?.toString() ?? null,
        currencyCode: reviewedAccountYear.currencyCode,
        exchangeRate: reviewedAccountYear.exchangeRate?.toString() ?? null,
        exchangeRateSource: reviewedAccountYear.exchangeRateSource,
        manualRateJustification: reviewedAccountYear.manualRateJustification,
        maxValueUsd: reviewedAccountYear.maxValueUsd?.toString() ?? null,
        isValueUnknown: reviewedAccountYear.isValueUnknown,
        reviewedById: reviewedAccountYear.reviewedById,
        reviewedAt: reviewedAccountYear.reviewedAt,
        corrections: reviewedAccountYear.corrections,
      },
    })
  } catch (error) {
    console.error("GET /api/accounts/[accountId]/review error:", error)
    return NextResponse.json(
      { error: "An internal error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
