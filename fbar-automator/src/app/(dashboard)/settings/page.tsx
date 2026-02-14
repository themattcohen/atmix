import { redirect } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
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

  const practiceData: PracticeData = {
    id: practice.id,
    name: practice.name,
    address: practice.address as PracticeData["address"],
    ein: practice.ein,
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
    </>
  )
}
