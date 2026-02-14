import { redirect } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/StatsCards"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { FilingStatusChart } from "@/components/dashboard/FilingStatusChart"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.practiceId) {
    redirect("/login")
  }

  const practiceId = session.user.practiceId

  // Run all queries in parallel for performance
  const [
    totalClients,
    activeAccounts,
    filingStatusGroups,
    recentAuditLogs,
  ] = await Promise.all([
    // Total clients for this practice
    prisma.client.count({
      where: { practiceId },
    }),

    // Total active foreign accounts (via clients in this practice)
    prisma.foreignAccount.count({
      where: {
        isActive: true,
        client: { practiceId },
      },
    }),

    // Filing years grouped by status
    prisma.filingYear.groupBy({
      by: ["status"],
      where: {
        client: { practiceId },
      },
      _count: { status: true },
    }),

    // Recent audit log entries (last 10)
    prisma.auditLog.findMany({
      where: { practiceId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
      },
    }),
  ])

  // Build filing status counts map
  const statusCounts: Record<string, number> = {}
  let totalFilings = 0
  for (const group of filingStatusGroups) {
    statusCounts[group.status] = group._count.status
    totalFilings += group._count.status
  }

  // Compute derived stats
  const activeFilings =
    (statusCounts["IN_PROGRESS"] || 0) + (statusCounts["REVIEWED"] || 0)
  const exportedFilings =
    (statusCounts["EXPORTED"] || 0) + (statusCounts["FILED"] || 0)

  // Map audit log entries for the RecentActivity component
  const activityEntries = recentAuditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt,
    userName: log.user?.name ?? null,
  }))

  return (
    <>
      <Header title="Dashboard" userName={session.user.name || ""} />

      <div className="mt-8 space-y-8">
        {/* Stats Cards */}
        <StatsCards
          totalClients={totalClients}
          activeAccounts={activeAccounts}
          activeFilings={activeFilings}
          exportedFilings={exportedFilings}
        />

        {/* Two-column layout: Filing Status (left) + Recent Activity (right) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FilingStatusChart
            statusCounts={statusCounts}
            totalFilings={totalFilings}
          />
          <RecentActivity entries={activityEntries} />
        </div>
      </div>
    </>
  )
}
