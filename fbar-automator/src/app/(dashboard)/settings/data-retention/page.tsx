import { redirect } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

export default async function DataRetentionPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <>
      <Header
        title="Data Retention"
        userName={session.user.name || ""}
      />
      <div className="mt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Data Retention</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure how long client data and filing records are retained.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">
                Data retention settings are under development. Planned features include:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li>Automatic purge of processed statement files after filing</li>
                <li>Configurable retention periods for audit logs</li>
                <li>Client data archival after configurable inactivity period</li>
                <li>Bulk data export before retention cleanup</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
