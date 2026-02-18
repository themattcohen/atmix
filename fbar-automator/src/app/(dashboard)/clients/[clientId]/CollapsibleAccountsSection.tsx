"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

interface CollapsibleAccountsSectionProps {
  accountCount: number
  children: ReactNode
  addAccountForm: ReactNode
}

export function CollapsibleAccountsSection({
  accountCount,
  children,
  addAccountForm,
}: CollapsibleAccountsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(accountCount > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
          aria-expanded={isExpanded}
          data-testid="accounts-toggle"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <CardTitle>Foreign Accounts ({accountCount})</CardTitle>
        </button>
        {addAccountForm}
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </Card>
  )
}
