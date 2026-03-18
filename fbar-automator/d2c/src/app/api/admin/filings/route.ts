import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

const VALID_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "REVIEWED",
  "SIGNED",
  "PAID",
  "SUBMITTING",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
] as const;

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const url = req.nextUrl;
    const statusParam = url.searchParams.get("status")?.trim() || "";
    const yearParam = url.searchParams.get("year")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
    const sortParam = url.searchParams.get("sort") || "updatedAt_desc";

    // Parse sort
    const lastUnderscore = sortParam.lastIndexOf("_");
    const sortField = lastUnderscore > 0 ? sortParam.slice(0, lastUnderscore) : "updatedAt";
    const sortDir = lastUnderscore > 0 ? sortParam.slice(lastUnderscore + 1) : "desc";

    const allowedSortFields = ["updatedAt", "createdAt", "calendarYear", "status"];
    const field = allowedSortFields.includes(sortField) ? sortField : "updatedAt";
    const direction = sortDir === "asc" ? "asc" : "desc";

    // Build where clause
    const where: Record<string, unknown> = {};

    if (statusParam) {
      const statusList = statusParam.split(",").filter((s) => VALID_STATUSES.includes(s as any));
      if (statusList.length > 0) {
        where.status = { in: statusList };
      }
    }

    if (yearParam) {
      const year = parseInt(yearParam, 10);
      if (!isNaN(year)) {
        where.calendarYear = year;
      }
    }

    if (search) {
      where.user = { email: { contains: search, mode: "insensitive" } };
    }

    const [filings, total] = await Promise.all([
      prisma.filingYear.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          payments: { select: { status: true }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { [field]: direction },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.filingYear.count({ where }),
    ]);

    const data = filings.map((f) => ({
      id: f.id,
      calendarYear: f.calendarYear,
      status: f.status,
      filingType: f.filingType,
      tier: f.tier,
      bsaId: f.bsaId,
      updatedAt: f.updatedAt,
      createdAt: f.createdAt,
      userEmail: f.user.email,
      userName: [f.user.firstName, f.user.lastName].filter(Boolean).join(" ") || null,
      paymentCount: f.payments.length,
      lastPaymentStatus: f.payments.length > 0 ? f.payments[0].status : null,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    log("error", "admin_filings_list_error", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
