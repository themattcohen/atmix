import { redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { safeDecrypt } from "@/lib/encryption"
import { SettingsClient } from "./SettingsClient"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PracticeData {
  id: string
  name: string
  address: {
    street?: string
    city?: string
    state?: string
    zip?: string
  } | null
  ein: string | null
}

export interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  mfaEnabled: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const practice = await prisma.practice.findUniqueOrThrow({
    where: { id: session.user.practiceId },
  })

  const users = await prisma.user.findMany({
    where: { practiceId: session.user.practiceId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  const isAdmin = session.user.role === "ADMIN"
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  let displayEin: string | null = null
  if (practice.ein) {
    const decrypted = safeDecrypt(practice.ein)
    const digits = decrypted.replace(/\D/g, "")
    displayEin = digits.length >= 4 ? `**-***${digits.slice(-4)}` : "****"
  }

  const practiceData: PracticeData = {
    id: practice.id,
    name: practice.name,
    address: practice.address as PracticeData["address"],
    ein: displayEin,
  }

  const teamMembers: TeamMember[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    mfaEnabled: u.mfaEnabled,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <>
      <Header title="Settings" userName={session.user.name || ""} />

      <div className="mt-8">
        <SettingsClient
          practice={practiceData}
          teamMembers={teamMembers}
          isAdmin={isAdmin}
          hasApiKey={hasApiKey}
          currentUserId={session.user.id}
        />
      </div>

      {/* More Settings */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">More Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/settings/exchange-rates"
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
          >
            <h3 className="text-sm font-medium text-gray-900">Exchange Rates</h3>
            <p className="mt-1 text-xs text-gray-500">
              View and sync Treasury exchange rates for FBAR USD conversion.
            </p>
          </Link>
          <Link
            href="/settings/data-retention"
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
          >
            <h3 className="text-sm font-medium text-gray-900">Data Retention</h3>
            <p className="mt-1 text-xs text-gray-500">
              Configure data retention policies and automatic cleanup schedules.
            </p>
          </Link>
        </div>
      </div>
    </>
  )
}
