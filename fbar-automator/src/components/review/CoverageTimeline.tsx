"use client"

import { cn } from "@/lib/utils"

interface CoverageTimelineProps {
  monthsCovered: number[]
  monthsMissing: number[]
  className?: string
}

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function CoverageTimeline({
  monthsCovered,
  monthsMissing,
  className,
}: CoverageTimelineProps) {
  const coveredSet = new Set(monthsCovered)
  const coveredCount = coveredSet.size
  const isComplete = coveredCount === 12

  return (
    <div
      role="group"
      aria-label={`Month coverage: ${coveredCount} of 12 months covered`}
      className={cn(
        "rounded-md p-2",
        isComplete ? "bg-green-50" : "bg-amber-50",
        className
      )}
    >
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
        {MONTH_ABBREVS.map((abbrev, i) => {
          const monthNum = i + 1
          const isCovered = coveredSet.has(monthNum)
          return (
            <div
              key={monthNum}
              title={`${MONTH_NAMES[i]} - ${isCovered ? "Covered" : "Missing"}`}
              className={cn(
                "flex items-center justify-center rounded px-1 py-1.5 text-xs font-medium select-none",
                isCovered
                  ? "bg-green-500 text-white"
                  : "border-2 border-dashed border-gray-300 bg-gray-100 text-gray-400"
              )}
            >
              {abbrev}
            </div>
          )
        })}
      </div>
    </div>
  )
}
