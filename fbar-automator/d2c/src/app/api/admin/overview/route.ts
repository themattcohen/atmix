import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [totalUsers, filingsByStatus, revenueResult, stuckCount, recentFilings] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.filingYear.groupBy({
          by: ["status"],
          orderBy: { status: "asc" },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: { status: "COMPLETED" },
          _sum: { amount: true },
          _count: true,
        }),
        // Stuck: SUBMITTING >1hr OR SUBMITTED >72hr without acknowledgedAt
        prisma.filingYear.count({
          where: {
            OR: [
              {
                status: "SUBMITTING",
                updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
              },
              {
                status: "SUBMITTED",
                acknowledgedAt: null,
                updatedAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
              },
            ],
          },
        }),
        prisma.filingYear.findMany({
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            calendarYear: true,
            status: true,
            updatedAt: true,
            user: { select: { email: true } },
          },
        }),
      ]);

    return NextResponse.json({
      data: {
        totalUsers,
        filingsByStatus: filingsByStatus.map((f: any) => ({
          status: f.status,
          count: f._count?._all ?? 0,
        })),
        revenue: {
          totalCompletedCount: revenueResult._count,
          totalUsd: (revenueResult._sum.amount ?? 0).toString(),
        },
        stuckCount,
        recentFilings: recentFilings.map((f) => ({
          id: f.id,
          userEmail: f.user.email,
          calendarYear: f.calendarYear,
          status: f.status,
          updatedAt: f.updatedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    log("error", "admin.overview.error", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
