import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
    const sortParam = url.searchParams.get("sort") || "createdAt_desc";

    // Parse sort: "field_direction"
    const lastUnderscore = sortParam.lastIndexOf("_");
    const sortField = lastUnderscore > 0 ? sortParam.slice(0, lastUnderscore) : "createdAt";
    const sortDir = lastUnderscore > 0 ? sortParam.slice(lastUnderscore + 1) : "desc";

    const allowedSortFields = ["createdAt", "email", "firstName", "lastName"];
    const field = allowedSortFields.includes(sortField) ? sortField : "createdAt";
    const direction = sortDir === "asc" ? "asc" : "desc";

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          emailVerified: true,
          mfaEnabled: true,
          _count: { select: { filingYears: true } },
        },
        orderBy: { [field]: direction },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

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
    log("error", "admin_users_list_error", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
