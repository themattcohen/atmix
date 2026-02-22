'use client'
import { useState } from 'react'
import type { ScoreBreakdown } from '@/types'

interface ScoreBreakdownChipProps {
  score: number
  breakdown: ScoreBreakdown
  muted?: boolean
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function ScoreBreakdownChip({ score, breakdown, muted = false }: ScoreBreakdownChipProps) {
  const [visible, setVisible] = useState(false)

  const scorePct = Math.round(score * 100)

  // Chip color based on score
  const chipClass =
    muted
      ? 'bg-raised text-text-secondary'
      : score >= 0.75
        ? 'bg-status-active/20 text-status-active'
        : score >= 0.50
          ? 'bg-urgency-caution/20 text-urgency-caution'
          : 'bg-raised text-text-secondary'

  // Build aria-label with full breakdown text
  const ariaLabel = [
    `Score ${scorePct}%:`,
    `rank ${pct(breakdown.rankValue)},`,
    `urgency ${pct(breakdown.urgencyScore)},`,
    `confidence ${pct(breakdown.confidenceScore)},`,
    `competition ${pct(breakdown.competitionPenalty)},`,
    `opportunity ${pct(breakdown.priceOpportunity)}`,
  ].join(' ')

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Chip */}
      <span
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none cursor-default ${chipClass}`}
        aria-label={ariaLabel}
      >
        {scorePct}%
      </span>

      {/* Tooltip */}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          role="tooltip"
        >
          <span className="block bg-raised border border-border rounded shadow-lg p-3 min-w-[220px] text-xs">
            <span className="block text-text-primary font-semibold mb-2">Score Breakdown</span>
            <span className="block space-y-1">
              {/* Rank priority */}
              <span className="flex justify-between gap-4">
                <span className="text-text-secondary">Rank priority</span>
                <span className="text-text-primary font-mono whitespace-nowrap">
                  {pct(breakdown.rankValue)}{' '}
                  <span className="text-text-secondary text-[10px]">×0.40</span>
                </span>
              </span>
              {/* Price opportunity */}
              <span className="flex justify-between gap-4">
                <span className="text-text-secondary">Price opportunity</span>
                <span className="text-text-primary font-mono whitespace-nowrap">
                  {pct(breakdown.priceOpportunity)}{' '}
                  <span className="text-text-secondary text-[10px]">×0.20</span>
                </span>
              </span>
              {/* Urgency */}
              <span className="flex justify-between gap-4">
                <span className="text-text-secondary">Urgency</span>
                <span className="text-text-primary font-mono whitespace-nowrap">
                  {pct(breakdown.urgencyScore)}{' '}
                  <span className="text-text-secondary text-[10px]">×0.20</span>
                </span>
              </span>
              {/* Buy confidence */}
              <span className="flex justify-between gap-4">
                <span className="text-text-secondary">Buy confidence</span>
                <span className="text-text-primary font-mono whitespace-nowrap">
                  {pct(breakdown.confidenceScore)}{' '}
                  <span className="text-text-secondary text-[10px]">×0.10</span>
                </span>
              </span>
              {/* Competition */}
              <span className="flex justify-between gap-4">
                <span className="text-text-secondary">Competition</span>
                <span className="text-text-primary font-mono whitespace-nowrap">
                  -{pct(breakdown.competitionPenalty)}{' '}
                  <span className="text-text-secondary text-[10px]">×0.10</span>
                </span>
              </span>
            </span>
            {/* Divider */}
            <span className="block border-t border-border my-2" />
            {/* Total */}
            <span className="flex justify-between gap-4">
              <span className="text-text-primary font-semibold">Total score</span>
              <span className="text-text-primary font-mono font-semibold">{pct(breakdown.total)}</span>
            </span>
          </span>
        </span>
      )}
    </span>
  )
}
