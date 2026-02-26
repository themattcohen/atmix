"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

interface WorkflowChecklistProps {
  hasFilingYears: boolean
  hasData: boolean
  hasReviewedFiling: boolean
  clientId: string
  latestFilingYear: number | null
  accountCount: number
}

interface Step {
  label: string
  done: boolean
  incompleteDescription: string
  completeDescription: string
  href: string | null
}

export function WorkflowChecklist({
  hasFilingYears,
  hasData,
  hasReviewedFiling,
  clientId,
  latestFilingYear,
  accountCount,
}: WorkflowChecklistProps) {
  const allDone = hasFilingYears && hasData && hasReviewedFiling
  const [collapsed, setCollapsed] = useState(false)

  const steps: Step[] = [
    {
      label: "Add a filing year",
      done: hasFilingYears,
      incompleteDescription: "Create a filing year to start the FBAR process",
      completeDescription: "Filing year created",
      href: null,
    },
    {
      label: "Upload statements",
      done: hasData,
      incompleteDescription:
        "Upload bank statements and accounts will be detected automatically. You can also add accounts manually.",
      completeDescription: `Account data entered${accountCount > 0 ? ` — ${accountCount} account${accountCount !== 1 ? "s" : ""}` : ""}`,
      href: latestFilingYear
        ? `/clients/${clientId}/${latestFilingYear}/upload`
        : null,
    },
    {
      label: "Review & submit",
      done: hasReviewedFiling,
      incompleteDescription: "Review account values and submit the filing",
      completeDescription: "Filing submitted",
      href: latestFilingYear
        ? `/clients/${clientId}/${latestFilingYear}/review`
        : null,
    },
  ]

  const currentStepIndex = steps.findIndex((s) => !s.done)

  return (
    <div className="mt-6" data-testid="workflow-checklist">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Getting Started</CardTitle>
          {allDone && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              data-testid="workflow-toggle"
            >
              {collapsed ? (
                <>
                  Show <ChevronRight className="h-3 w-3" />
                </>
              ) : (
                <>
                  Hide <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </CardHeader>
        {!collapsed && (
          <CardContent>
            <ol className="space-y-4">
              {steps.map((step, i) => {
                const isCurrent = i === currentStepIndex
                const description = step.done
                  ? step.completeDescription
                  : step.incompleteDescription

                return (
                  <li key={step.label} className="flex items-start gap-3" data-testid={`workflow-step-${i + 1}`}>
                    {/* Circle indicator */}
                    {step.done ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                          isCurrent
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}

                    {/* Content */}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          step.done ? "text-gray-400 line-through" : "text-gray-900"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-sm ${
                          step.done ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {description}
                      </p>
                      {!step.done && step.href && isCurrent && (
                        <Link
                          href={step.href}
                          className="mt-1 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Go to {step.label.toLowerCase()} &rarr;
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
