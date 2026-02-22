'use client'

import type { CardSignal } from '@/types'
import { useSignalConfig } from '@/hooks/use-signal-config'

interface SignalDetailTooltipProps {
  signal: CardSignal
}

export function SignalDetailTooltip({ signal }: SignalDetailTooltipProps) {
  const { data: config } = useSignalConfig()

  if (!config) {
    return <span className="text-[10px] text-text-secondary">Loading...</span>
  }

  const eventConfig = config.signalConfig[signal.eventType]
  const sourceConfig = config.sourceConfig[signal.source]
  const formula = config.scoringFormula

  if (!eventConfig || !sourceConfig) return null

  const scorePrefix = signal.score > 0 ? '+' : ''
  const decayLabel = eventConfig.decayDays
    ? `${eventConfig.decayDays} days`
    : 'Never (permanent)'

  // Reverse-engineer confidence components from composite
  // composite = 0.4*source + 0.3*classification + 0.3*match
  const sourceConf = sourceConfig.multiplier
  const classConf = eventConfig.confidence
  // match confidence = (composite - 0.4*source - 0.3*class) / 0.3
  const matchConf = Math.max(0, Math.min(1,
    (signal.confidence - formula.sourceWeight * sourceConf - formula.classificationWeight * classConf) / formula.matchWeight
  ))

  return (
    <div className="space-y-2 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold text-text-primary text-xs">{eventConfig.labelLong}</span>
        <span className={`font-bold text-xs ${eventConfig.color}`}>{scorePrefix}{signal.score}</span>
      </div>
      <p className="text-[10px] text-text-secondary italic">{eventConfig.description}</p>

      <hr className="border-border" />

      {/* Trigger */}
      <div>
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Triggered by</div>
        {signal.matchedKeyword ? (
          <div className="text-[10px] text-text-primary">
            Keyword: <span className="font-mono bg-background px-1 rounded">&quot;{signal.matchedKeyword}&quot;</span>
          </div>
        ) : (
          <div className="text-[10px] text-text-secondary">Keyword data not available</div>
        )}
      </div>

      <hr className="border-border" />

      {/* Scoring breakdown */}
      <div>
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Scoring Breakdown</div>
        <div className="space-y-0.5 text-[10px] font-mono">
          <div className="flex justify-between">
            <span className="text-text-secondary">Base score</span>
            <span className="text-text-primary">{scorePrefix}{eventConfig.baseScore} ({signal.eventType})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Source</span>
            <span className="text-text-primary">{sourceConfig.label} ({'\u00D7'}{sourceConf})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Classification</span>
            <span className="text-text-primary">{Math.round(classConf * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Player match</span>
            <span className="text-text-primary">{Math.round(matchConf * 100)}%</span>
          </div>
          <div className="flex justify-between border-t border-border pt-0.5 mt-0.5">
            <span className="text-text-secondary font-semibold">{'\u2192'} Composite</span>
            <span className="text-text-primary font-semibold">{Math.round(signal.confidence * 100)}%</span>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* Meta */}
      <div className="space-y-0.5 text-[10px]">
        <div className="text-text-secondary">
          Formula: {formula.description}
        </div>
        <div className="text-text-secondary">
          Expires: {decayLabel}
        </div>
      </div>

      {/* All keywords */}
      <div>
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Monitored keywords</div>
        <div className="text-[10px] text-text-secondary leading-relaxed">
          {eventConfig.keywords.join(', ')}
        </div>
      </div>
    </div>
  )
}
