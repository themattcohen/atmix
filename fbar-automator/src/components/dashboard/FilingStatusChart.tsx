import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

interface FilingStatusChartProps {
  statusCounts: Record<string, number>
  totalFilings: number
}

const statusConfig: Record<string, { label: string; colorClass: string }> = {
  NOT_STARTED: { label: "Not Started", colorClass: "bg-gray-300" },
  IN_PROGRESS: { label: "In Progress", colorClass: "bg-blue-500" },
  REVIEWED: { label: "Reviewed", colorClass: "bg-yellow-500" },
  EXPORTED: { label: "Exported", colorClass: "bg-green-500" },
  FILED: { label: "Filed", colorClass: "bg-green-700" },
}

const statusOrder = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "REVIEWED",
  "EXPORTED",
  "FILED",
]

export function FilingStatusChart({
  statusCounts,
  totalFilings,
}: FilingStatusChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filing Status</CardTitle>
      </CardHeader>
      <CardContent>
        {totalFilings === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No filings yet</p>
          </div>
        ) : (
          <div>
            {/* Stacked horizontal bar */}
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
              {statusOrder.map((status) => {
                const count = statusCounts[status] || 0
                if (count === 0) return null
                const percentage = (count / totalFilings) * 100
                const config = statusConfig[status]

                return (
                  <div
                    key={status}
                    className={`${config.colorClass} transition-all`}
                    style={{ width: `${percentage}%` }}
                    title={`${config.label}: ${count}`}
                    role="img"
                    aria-label={`${config.label}: ${count} filing${count === 1 ? "" : "s"} (${Math.round(percentage)}%)`}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <ul className="mt-4 space-y-2" role="list">
              {statusOrder.map((status) => {
                const count = statusCounts[status] || 0
                const config = statusConfig[status]

                return (
                  <li
                    key={status}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${config.colorClass}`}
                        aria-hidden="true"
                      />
                      <span className="text-gray-700">{config.label}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {count.toLocaleString()}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
