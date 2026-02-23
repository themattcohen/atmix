'use client'
import { useReducer, useEffect } from 'react'

type Urgency = 'normal' | 'caution' | 'urgent' | 'critical'

interface CountdownResult {
  timeLeft: string
  urgency: Urgency
}

// --- shared tick ---
const subscribers = new Set<() => void>()
let timerId: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void) {
  subscribers.add(cb)
  if (subscribers.size === 1) {
    timerId = setInterval(() => {
      for (const fn of subscribers) fn()
    }, 1000)
  }
  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0 && timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'Ended'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function getUrgency(ms: number): Urgency {
  if (ms <= 0) return 'critical'
  const hours = ms / (1000 * 60 * 60)
  if (hours > 24) return 'normal'
  if (hours >= 1) return 'caution'
  const minutes = ms / (1000 * 60)
  if (minutes < 5) return 'critical'
  return 'urgent'
}

export function useCountdown(endTime: string | null): CountdownResult {
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!endTime) return
    return subscribe(forceRender)
  }, [endTime])

  if (!endTime) {
    return { timeLeft: '—', urgency: 'normal' }
  }

  const ms = new Date(endTime).getTime() - Date.now()
  return {
    timeLeft: formatDuration(ms),
    urgency: getUrgency(ms),
  }
}
