import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  Building2,
  User,
  Calendar,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { safeDecrypt } from "@/lib/encryption"
import { AddAccountForm } from "./AddAccountForm"
import { AddFilingYearForm } from "./AddFilingYearForm"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskTIN(tin: string | null): string | null {
  if (!tin) return null
  const digits = tin.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return `***-**-${digits.slice(-4)}`
}

function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num
  return "*".repeat(num.length - 4) + num.slice(-4)
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

interface ClientDetailPageProps {
  params: Promise<{ clientId: string }>
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { clientId } = await params
  const session = await auth()
  if (!session?.user?.practiceId) redirect("/login")

  const practiceId = session.user.practiceId

  const client = await prisma.client.findFirst({
    where: { id: clientId, practiceId },
    include: {
      foreignAccounts: {
        orderBy: [{ isActive: "desc" }, { institutionName: "asc" }],
      },
      filingYears: {
        orderBy: { calendarYear: "desc" },
        include: {
          _count: {
            select: {
              statements: true,
              reviewedAccountYears: true,
            },
          },
        },
      },
    },
  })

  if (!client) notFound()

  const usAddress = client.usAddress as {
    street?: string
    city?: string
    state?: string
    zip?: string
  } | null

  const displayName = client.firstName
    ? `${client.firstName} ${client.lastName}`
    : client.lastName

  return (
    <>
      <Header title="Client Details" userName={session.user.name || ""} />

      <div className="mt-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>

        {/* Client Info */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                {client.type === "INDIVIDUAL" ? (
                  <User className="h-5 w-5 text-gray-600" />
                ) : (
                  <Building2 className="h-5 w-5 text-gray-600" />
                )}
              </div>
              <div>
                <CardTitle>{displayName}</CardTitle>
                <p className="text-sm text-gray-500">
                  {client.type === "INDIVIDUAL" ? "Individual" : "Entity"}
                  {client.tinType && ` | ${client.tinType}: ${maskTIN(client.tin ? safeDecrypt(client.tin) : null)}`}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {client.dateOfBirth && (
                <div>
                  <dt className="font-medium text-gray-500">Date of Birth</dt>
                  <dd className="mt-1 text-gray-900">
                    {new Date(client.dateOfBirth).toLocaleDateString("en-US")}
                  </dd>
                </div>
              )}
              {usAddress && (usAddress.street || usAddress.city) && (
                <div>
                  <dt className="font-medium text-gray-500">US Address</dt>
                  <dd className="mt-1 text-gray-900">
                    {usAddress.street && <>{usAddress.street}<br /></>}
                    {usAddress.city && <>{usAddress.city}, </>}
                    {usAddress.state} {usAddress.zip}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-gray-500">Foreign Accounts</dt>
                <dd className="mt-1 text-gray-900">
                  {client.foreignAccounts.filter((a) => a.isActive).length} active
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Foreign Accounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Foreign Accounts</CardTitle>
              <AddAccountForm clientId={clientId} />
            </CardHeader>
            <CardContent>
              {client.foreignAccounts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 pr-4 font-medium">Institution</th>
                        <th className="pb-2 pr-4 font-medium">Account #</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Country</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {client.foreignAccounts.map((account) => (
                        <tr key={account.id}>
                          <td className="py-2 pr-4 font-medium text-gray-900">
                            {account.institutionName}
                          </td>
                          <td className="py-2 pr-4 font-mono text-gray-600">
                            {maskAccountNumber(account.accountNumber)}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {account.accountType}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {account.institutionAddressCountry || "-"}
                          </td>
                          <td className="py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                account.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {account.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No foreign accounts yet. Add accounts to begin FBAR filing.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Filing Years */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Filing Years</CardTitle>
              <AddFilingYearForm clientId={clientId} />
            </CardHeader>
            <CardContent>
              {client.filingYears.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 pr-4 font-medium">Year</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Statements</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {client.filingYears.map((fy) => {
                        const badge = STATUS_BADGE[fy.status]
                        return (
                          <tr key={fy.id}>
                            <td className="py-2 pr-4 font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {fy.calendarYear}
                              </div>
                            </td>
                            <td className="py-2 pr-4">
                              {badge && (
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-gray-600">
                              {fy._count.statements}
                            </td>
                            <td className="py-2">
                              <Link
                                href={`/clients/${clientId}/${fy.calendarYear}`}
                              >
                                <Button variant="ghost" size="sm">
                                  <Eye className="mr-1 h-3 w-3" />
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No filing years yet. Create a filing year to start the FBAR process.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

