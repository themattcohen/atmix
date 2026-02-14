"use client"

import { useState } from "react"
import {
  Building2,
  Key,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  UserPlus,
  Shield,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import type { PracticeData, TeamMember } from "./page"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsClientProps {
  practice: PracticeData
  teamMembers: TeamMember[]
  isAdmin: boolean
  hasApiKey: boolean
  currentUserId: string
}

// ---------------------------------------------------------------------------
// Role badge component
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    PREPARER: "bg-blue-100 text-blue-800",
    REVIEWER: "bg-green-100 text-green-800",
  }
  const colorClass = colorMap[role] || "bg-gray-100 text-gray-800"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {role}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Practice Information Section
// ---------------------------------------------------------------------------

function PracticeSection({
  practice,
  isAdmin,
}: {
  practice: PracticeData
  isAdmin: boolean
}) {
  const [name, setName] = useState(practice.name)
  const [street, setStreet] = useState(practice.address?.street || "")
  const [city, setCity] = useState(practice.address?.city || "")
  const [state, setState] = useState(practice.address?.state || "")
  const [zip, setZip] = useState(practice.address?.zip || "")
  const [ein, setEin] = useState(practice.ein || "")
  const [einModified, setEinModified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: { street, city, state, zip },
          ...(einModified ? { ein: ein || null } : {}),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save settings.")
      }

      setMessage({ type: "success", text: "Practice settings saved." })
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          Practice Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="practice-name"
              className="block text-sm font-medium text-gray-700"
            >
              Practice Name
            </label>
            <Input
              id="practice-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <div className="mt-1 space-y-2">
              <Input
                placeholder="Street address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={!isAdmin}
                aria-label="Street address"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!isAdmin}
                  aria-label="City"
                />
                <Input
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={!isAdmin}
                  maxLength={2}
                  aria-label="State"
                />
                <Input
                  placeholder="ZIP"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  disabled={!isAdmin}
                  maxLength={10}
                  aria-label="ZIP code"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="practice-ein"
              className="block text-sm font-medium text-gray-700"
            >
              EIN (Employer Identification Number)
            </label>
            <Input
              id="practice-ein"
              value={ein}
              onChange={(e) => {
                setEin(e.target.value)
                setEinModified(true)
              }}
              disabled={!isAdmin}
              placeholder="XX-XXXXXXX"
              className="mt-1 max-w-xs"
            />
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
              role="alert"
            >
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {isAdmin && (
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}

          {!isAdmin && (
            <p className="text-sm text-gray-500">
              Only administrators can edit practice settings.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// API Configuration Section
// ---------------------------------------------------------------------------

function ApiConfigSection({ hasApiKey }: { hasApiKey: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-gray-500" />
          API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Anthropic API Key:
            </span>
            {hasApiKey ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <CheckCircle className="h-3 w-3" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                <XCircle className="h-3 w-3" />
                Not configured
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500">
            The API key is configured via environment variables on the server. To
            update the key, modify the <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">ANTHROPIC_API_KEY</code> environment variable in your deployment configuration.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Team Members Section
// ---------------------------------------------------------------------------

function TeamSection({
  teamMembers,
  isAdmin,
  currentUserId,
}: {
  teamMembers: TeamMember[]
  isAdmin: boolean
  currentUserId: string
}) {
  const [members, setMembers] = useState(teamMembers)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<"PREPARER" | "REVIEWER">(
    "PREPARER"
  )
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    type: "success" | "error"
    text: string
    tempPassword?: string
  } | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteResult(null)

    try {
      const response = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create team member.")
      }

      setInviteResult({
        type: "success",
        text: `Team member ${data.name} created successfully.`,
        tempPassword: data.temporaryPassword,
      })

      // Add new member to list
      setMembers((prev) => [
        ...prev,
        {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          mfaEnabled: false,
          createdAt: new Date().toISOString(),
        },
      ])

      // Reset form fields
      setInviteEmail("")
      setInviteName("")
      setInviteRole("PREPARER")
    } catch (error) {
      setInviteResult({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      })
    } finally {
      setInviting(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Team Members
          </CardTitle>
          {isAdmin && !showInviteForm && (
            <Button
              size="sm"
              onClick={() => {
                setShowInviteForm(true)
                setInviteResult(null)
              }}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Invite Form */}
        {showInviteForm && isAdmin && (
          <form
            onSubmit={handleInvite}
            className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <h4 className="mb-3 text-sm font-medium text-gray-900">
              Invite New Team Member
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="invite-name"
                  className="block text-xs font-medium text-gray-600"
                >
                  Name
                </label>
                <Input
                  id="invite-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-xs font-medium text-gray-600"
                >
                  Email
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-xs font-medium text-gray-600"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "PREPARER" | "REVIEWER")
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  <option value="PREPARER">Preparer</option>
                  <option value="REVIEWER">Reviewer</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button type="submit" size="sm" disabled={inviting}>
                {inviting && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Create Member
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowInviteForm(false)
                  setInviteResult(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Invite Result */}
        {inviteResult && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              inviteResult.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
            role="alert"
          >
            <div className="flex items-center gap-2">
              {inviteResult.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {inviteResult.text}
            </div>
            {inviteResult.tempPassword && (
              <div className="mt-2 rounded border border-green-200 bg-white p-2">
                <p className="text-xs font-medium text-gray-700">
                  Temporary password (shown only once):
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                    {inviteResult.tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(inviteResult.tempPassword || "")
                    }
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Copy temporary password"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-200">
                <th
                  scope="col"
                  className="pb-3 pr-4 font-medium text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="pb-3 pr-4 font-medium text-gray-500"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="pb-3 pr-4 font-medium text-gray-500"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="pb-3 pr-4 font-medium text-gray-500"
                >
                  MFA
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {member.name}
                      </span>
                      {member.id === currentUserId && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{member.email}</td>
                  <td className="py-3 pr-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="py-3 pr-4">
                    {member.mfaEnabled ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <Shield className="h-3.5 w-3.5" />
                        <span className="text-xs">Enabled</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Disabled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            No team members found.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Danger Zone Section
// ---------------------------------------------------------------------------

function DangerZoneSection() {
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Export All Data
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Download a complete export of all practice data including
                clients, filings, and accounts. (Coming soon)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-shrink-0 cursor-not-allowed"
            >
              Export All Data
            </Button>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              Delete Practice Account
            </p>
            <p className="mt-1 text-xs text-gray-500">
              To delete your practice account and all associated data, please
              contact support. This action is irreversible and requires manual
              verification.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export function SettingsClient({
  practice,
  teamMembers,
  isAdmin,
  hasApiKey,
  currentUserId,
}: SettingsClientProps) {
  return (
    <div className="space-y-6">
      <PracticeSection practice={practice} isAdmin={isAdmin} />
      <ApiConfigSection hasApiKey={hasApiKey} />
      <TeamSection
        teamMembers={teamMembers}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
      {isAdmin && <DangerZoneSection />}
    </div>
  )
}
