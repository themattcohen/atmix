import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={{
          name: session.user.name || "",
          email: session.user.email || "",
          role: session.user.role || "preparer",
        }}
      />
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </div>
  )
}
