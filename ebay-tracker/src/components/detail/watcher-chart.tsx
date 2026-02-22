'use client'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { PriceSnapshot } from '@/types'

interface WatcherChartProps {
  snapshots: PriceSnapshot[]
}

export function WatcherChart({ snapshots }: WatcherChartProps) {
  const chartData = snapshots.map((s, i) => {
    const prev = i > 0 ? (snapshots[i - 1].watcherCount ?? 0) : (s.watcherCount ?? 0)
    const current = s.watcherCount ?? 0
    return {
      date: new Date(s.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      watchers: current,
      trend: current - prev,
    }
  })

  const allWatchersNull = snapshots.every(s => s.watcherCount == null)

  if (chartData.length === 0 || allWatchersNull) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-center h-64" data-testid="watcher-chart">
        <p className="text-xs text-text-secondary">No watcher data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="watcher-chart">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Watcher Activity
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#30363d"
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#30363d"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              fontSize: 12,
              color: '#e6edf3',
            }}
          />
          <Bar dataKey="watchers" fill="#1d6ab5" opacity={0.6} barSize={20} />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
