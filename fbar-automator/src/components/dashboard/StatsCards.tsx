import { Users, Building2, Clock, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"

interface StatsCardsProps {
  totalClients: number
  activeAccounts: number
  activeFilings: number
  exportedFilings: number
}

const iconStyles = {
  clients: "bg-blue-50 text-blue-600",
  accounts: "bg-purple-50 text-purple-600",
  active: "bg-amber-50 text-amber-600",
  exported: "bg-green-50 text-green-600",
} as const

export function StatsCards({
  totalClients,
  activeAccounts,
  activeFilings,
  exportedFilings,
}: StatsCardsProps) {
  const stats = [
    {
      label: "Total Clients",
      value: totalClients,
      icon: Users,
      colorKey: "clients" as const,
    },
    {
      label: "Active Accounts",
      value: activeAccounts,
      icon: Building2,
      colorKey: "accounts" as const,
    },
    {
      label: "Active Filings",
      value: activeFilings,
      icon: Clock,
      colorKey: "active" as const,
    },
    {
      label: "Exported / Filed",
      value: exportedFilings,
      icon: CheckCircle,
      colorKey: "exported" as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label} className="p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-full p-3 ${iconStyles[stat.colorKey]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
