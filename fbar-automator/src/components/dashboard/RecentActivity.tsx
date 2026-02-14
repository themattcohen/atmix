import {
  Upload,
  FileCheck,
  Download,
  UserPlus,
  Edit,
  Trash2,
  Eye,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: Date
  userName: string | null
}

interface RecentActivityProps {
  entries: AuditEntry[]
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return "just now"
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  }
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
  }

  return date.toLocaleDateString()
}

const actionIconMap: Record<string, typeof Activity> = {
  STATEMENT_UPLOADED: Upload,
  ACCOUNT_REVIEWED: FileCheck,
  FILING_EXPORTED: Download,
  USER_CREATED: UserPlus,
  USER_UPDATED: Edit,
  CLIENT_CREATED: UserPlus,
  CLIENT_UPDATED: Edit,
  CLIENT_DELETED: Trash2,
  FILING_CREATED: FileCheck,
  FILING_UPDATED: Edit,
  FILING_REVIEWED: Eye,
  ACCOUNT_CREATED: UserPlus,
  ACCOUNT_UPDATED: Edit,
}

const actionColorMap: Record<string, string> = {
  STATEMENT_UPLOADED: "text-blue-600 bg-blue-50",
  ACCOUNT_REVIEWED: "text-green-600 bg-green-50",
  FILING_EXPORTED: "text-purple-600 bg-purple-50",
  USER_CREATED: "text-indigo-600 bg-indigo-50",
  FILING_REVIEWED: "text-amber-600 bg-amber-50",
}

function formatAction(action: string, entityType: string): string {
  const actionWords = action.toLowerCase().replace(/_/g, " ")
  const entityWords = entityType.toLowerCase().replace(/_/g, " ")
  return `${actionWords} (${entityWords})`
}

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {entries.map((entry) => {
              const Icon = actionIconMap[entry.action] || Activity
              const colorClass =
                actionColorMap[entry.action] || "text-gray-600 bg-gray-50"

              return (
                <li key={entry.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">
                        {entry.userName || "System"}
                      </span>{" "}
                      {formatAction(entry.action, entry.entityType)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {getRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
