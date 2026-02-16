import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Search, Eye } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { safeDecrypt } from "@/lib/encryption"
import { DeleteClientButton } from "./DeleteClientButton"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskTIN(tin: string | null): string | null {
  if (!tin) return null
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return `***-**-${digits.slice(-4)}`
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-gray-100 text-gray-700",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700",
  },
  REVIEWED: {
    label: "Reviewed",
    className: "bg-yellow-100 text-yellow-700",
  },
  EXPORTED: {
    label: "Exported",
    className: "bg-green-100 text-green-700",
  },
  FILED: {
    label: "Filed",
    className: "bg-green-100 text-green-700",
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ClientsPageProps {
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const session = await auth()
  if (!session?.user?.practiceId) redirect("/login")

  const params = await searchParams
  const search = params.search
  const page = parseInt(params.page || "1", 10)
  const pageSize = 20
  const practiceId = session.user.practiceId

  const where = {
    practiceId,
    ...(search
      ? {
          OR: [
            { lastName: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        _count: {
          select: { foreignAccounts: true },
        },
        filingYears: {
          orderBy: { calendarYear: "desc" },
          take: 1,
          select: {
            id: true,
            calendarYear: true,
            status: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.client.count({ where }),
  ])

  const hasClients = clients.length > 0
  const totalPages = Math.ceil(total / pageSize)
  const isAdmin = session.user.role === "ADMIN"

  return (
    <>
      <Header title="Clients" userName={session.user.name || ""} />

      <div className="mt-8">
        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              Manage your clients and their FBAR filings.
            </p>
          </div>
          <Link href="/clients/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </Link>
        </div>

        {/* Search */}
        <form className="mt-4" action="/clients" method="GET">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by name..."
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            />
          </div>
        </form>

        {/* Table */}
        {hasClients ? (
          <>
            <Card className="mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">TIN</th>
                      <th className="px-6 py-3 font-medium">Accounts</th>
                      <th className="px-6 py-3 font-medium">Latest Filing</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients.map((client) => {
                      const latestFiling = client.filingYears[0]
                      const badge = latestFiling
                        ? STATUS_BADGE[latestFiling.status]
                        : null

                      return (
                        <tr
                          key={client.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {client.lastName}
                            {client.firstName ? `, ${client.firstName}` : ""}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {client.type === "INDIVIDUAL"
                              ? "Individual"
                              : "Entity"}
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-600">
                            {maskTIN(client.tin ? safeDecrypt(client.tin) : null) ?? "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {client._count.foreignAccounts}
                          </td>
                          <td className="px-6 py-4">
                            {latestFiling && badge ? (
                              <span className="flex items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {latestFiling.calendarYear}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Link href={`/clients/${client.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="mr-1 h-4 w-4" />
                                  View
                                </Button>
                              </Link>
                              {isAdmin && (
                                <DeleteClientButton
                                  clientId={client.id}
                                  clientName={`${client.lastName}${client.firstName ? `, ${client.firstName}` : ""}`}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages} ({total} total clients)
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/clients?${search ? `search=${search}&` : ""}page=${page - 1}`}
                    >
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/clients?${search ? `search=${search}&` : ""}page=${page + 1}`}
                    >
                      <Button variant="outline" size="sm">
                        Next
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-gray-500">
                {search
                  ? `No clients found matching "${search}".`
                  : "No clients yet. Add your first client to get started."}
              </p>
              {!search && (
                <Link href="/clients/new" className="mt-4">
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
