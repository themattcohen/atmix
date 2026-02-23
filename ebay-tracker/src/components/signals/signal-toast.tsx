'use client'

import { useEffect, useState } from 'react'
import type { CardSignal } from '@/types'
import { useSignals } from '@/hooks/use-signals'
import { useSignalConfig } from '@/hooks/use-signal-config'

interface Toast {
  id: number
  signal: CardSignal
  expiresAt: number
}

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 8000

const borderColorMap: Record<string, string> = {
  'text-status-active': 'border-status-active',
  'text-status-sold': 'border-status-sold',
  'text-emerald-400': 'border-emerald-400',
  'text-orange-400': 'border-orange-400',
  'text-red-400': 'border-red-400',
  'text-blue-400': 'border-blue-400',
  'text-purple-400': 'border-purple-400',
  'text-amber-400': 'border-amber-400',
  'text-cyan-400': 'border-cyan-400',
  'text-violet-400': 'border-violet-400',
  'text-rose-400': 'border-rose-400',
  'text-lime-400': 'border-lime-400',
  'text-teal-400': 'border-teal-400',
  'text-slate-400': 'border-slate-400',
  'text-text-secondary': 'border-text-secondary',
}

export function SignalToastContainer() {
  const { data } = useSignals({ limit: 100, acknowledged: false })
  const { data: config } = useSignalConfig()
  const signals: CardSignal[] = data?.signals ?? []

  const [toasts, setToasts] = useState<Toast[]>([])
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set())

  // Add new high-impact signals as toasts
  useEffect(() => {
    const highImpact = signals.filter(
      (s) => Math.abs(s.score) >= 2 && !s.acknowledged && !seenIds.has(s.id)
    )

    if (highImpact.length === 0) return

    const newToasts: Toast[] = highImpact.map((s) => ({
      id: s.id,
      signal: s,
      expiresAt: Date.now() + AUTO_DISMISS_MS,
    }))

    setSeenIds((prev) => {
      const next = new Set(prev)
      highImpact.forEach((s) => next.add(s.id))
      return next
    })

    setToasts((prev) => [...newToasts, ...prev].slice(0, MAX_VISIBLE))
  }, [signals, seenIds])

  // Auto-dismiss timer
  useEffect(() => {
    if (toasts.length === 0) return

    const timer = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => t.expiresAt > now))
    }, 1000)

    return () => clearInterval(timer)
  }, [toasts.length])

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-[90vw] sm:max-w-sm" data-testid="signal-toast">
      {toasts.map((toast) => {
        const isPositive = toast.signal.score > 0
        const eventConfig = config?.signalConfig[toast.signal.eventType]
        const borderColor = eventConfig
          ? (borderColorMap[eventConfig.color] ?? 'border-border')
          : (isPositive ? 'border-status-active' : 'border-status-sold')
        const scoreColor = eventConfig?.color ?? (isPositive ? 'text-status-active' : 'text-status-sold')
        const eventLabel = eventConfig?.label ?? toast.signal.eventType.replace('_', ' ')

        return (
          <div
            key={toast.id}
            className={`bg-surface border ${borderColor} rounded-lg shadow-lg p-3 animate-in slide-in-from-right`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${scoreColor}`}>
                    {isPositive ? '+' : ''}{toast.signal.score}
                  </span>
                  <span className="text-[10px] font-semibold text-text-secondary uppercase">
                    {eventLabel}
                  </span>
                </div>
                <p className="text-xs text-text-primary mt-0.5 truncate">
                  {toast.signal.headline}
                </p>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-text-secondary hover:text-text-primary text-xs p-0.5"
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
