'use client'

import { useState } from 'react'
import { useSignalConfig } from '@/hooks/use-signal-config'

export function SignalExplainer() {
  const [expanded, setExpanded] = useState(false)
  const { data: config } = useSignalConfig()

  const signalConfig = config?.signalConfig
  const sourceConfig = config?.sourceConfig
  const scoringFormula = config?.scoringFormula

  return (
    <div className="mb-4 bg-surface border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-raised transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-xs font-medium text-text-primary">How Signals Work</span>
        <span className="text-text-secondary text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 flex flex-col gap-5">

          {/* What signals are */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-1.5">What Are Signals?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Signals fire when sports news matches a player on one of your watchlist cards. Each card is linked to a player via AI title parsing or manual mapping.
            </p>
          </section>

          {/* Event types table */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-2">Event Types</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Event</th>
                    <th className="text-left text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Description</th>
                    <th className="text-right text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Score</th>
                    <th className="text-right text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Decay</th>
                    <th className="text-left text-[10px] text-text-secondary font-medium pb-1.5">Example Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {signalConfig
                    ? Object.entries(signalConfig).map(([key, cfg]) => {
                        const exampleKeywords = cfg.keywords.slice(0, 3).join(', ')
                        const decayLabel = cfg.decayDays ? `${cfg.decayDays}d` : 'permanent'
                        const scoreText = cfg.baseScore > 0 ? `+${cfg.baseScore}` : String(cfg.baseScore)
                        return (
                          <tr key={key} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 pr-3">
                              <span className={`font-semibold text-[10px] ${cfg.color}`}>
                                {cfg.labelLong}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-[10px] text-text-secondary max-w-[180px]">
                              {cfg.description}
                            </td>
                            <td className="py-1.5 pr-3 text-right font-mono text-[10px] text-text-primary">
                              {scoreText}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-[10px] text-text-secondary">
                              {decayLabel}
                            </td>
                            <td className="py-1.5 text-[10px] text-text-secondary">
                              {exampleKeywords}
                            </td>
                          </tr>
                        )
                      })
                    : (
                      <tr>
                        <td colSpan={5} className="py-2 text-[10px] text-text-secondary">Loading...</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Score explanation */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-1.5">Score</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Each event type has a base score from <span className="text-red-400 font-mono">-3</span> (very negative) to <span className="text-emerald-400 font-mono">+3</span> (very positive). This score reflects the expected impact on card value.
            </p>
          </section>

          {/* Confidence formula */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-1.5">Confidence Formula</h3>
            <p className="text-xs text-text-secondary leading-relaxed font-mono bg-background border border-border rounded px-3 py-2">
              {scoringFormula
                ? `Confidence = ${scoringFormula.sourceWeight} × source reliability + ${scoringFormula.classificationWeight} × classification confidence + ${scoringFormula.matchWeight} × match confidence`
                : 'Confidence = 0.4 × source reliability + 0.3 × classification confidence + 0.3 × match confidence'
              }
            </p>
          </section>

          {/* Source reliability table */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-2">Source Reliability</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Source</th>
                  <th className="text-right text-[10px] text-text-secondary font-medium pb-1.5 pr-3">Multiplier</th>
                  <th className="text-left text-[10px] text-text-secondary font-medium pb-1.5">Reliability</th>
                </tr>
              </thead>
              <tbody>
                {sourceConfig
                  ? Object.entries(sourceConfig)
                      .sort((a, b) => b[1].multiplier - a[1].multiplier)
                      .map(([key, src]) => (
                        <tr key={key} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-3 text-[10px] text-text-primary">{src.label}</td>
                          <td className="py-1.5 pr-3 text-right font-mono text-[10px] text-text-primary">{src.multiplier.toFixed(2)}</td>
                          <td className="py-1.5 text-[10px] text-text-secondary">{src.reliability}</td>
                        </tr>
                      ))
                  : (
                    <tr>
                      <td colSpan={3} className="py-2 text-[10px] text-text-secondary">Loading...</td>
                    </tr>
                  )}
              </tbody>
            </table>
          </section>

          {/* Decay model */}
          <section>
            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-1.5">Decay Model</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Signals expire based on event severity: <span className="text-text-primary">14 days</span> (minor events), <span className="text-text-primary">30 days</span> (moderate events), or <span className="text-text-primary">permanent</span> (severe career-altering events like season-ending injuries, suspensions, releases).
            </p>
          </section>

        </div>
      )}
    </div>
  )
}
