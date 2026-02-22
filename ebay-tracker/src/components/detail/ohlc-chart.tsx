'use client'
import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
} from 'recharts'
import type { OHLCDataPoint, RollupPeriod } from '@/types'
import { useHistory } from '@/hooks/use-history'

// ── Time range presets ───────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all'

const RANGES: Array<{ label: string; value: TimeRange }> = [
  { label: '7D',  value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y',  value: '1y' },
  { label: 'All', value: 'all' },
]

function rangeToFrom(range: TimeRange): string | undefined {
  if (range === 'all') return undefined
  const now = new Date()
  const from = new Date(now)
  if (range === '7d')  from.setDate(now.getDate() - 7)
  if (range === '30d') from.setDate(now.getDate() - 30)
  if (range === '90d') from.setDate(now.getDate() - 90)
  if (range === '1y')  from.setFullYear(now.getFullYear() - 1)
  return from.toISOString().slice(0, 10)
}

// ── Custom candlestick shape ─────────────────────────────────────────────────
//
// Recharts Bar with `shape` prop passes the yAxis reference (including .scale)
// into the custom shape component. CandleShape uses props.yAxis.scale to map
// dollar values to pixel coordinates for the wick and body.
//
// dataKey="high" gives the Bar a numeric anchor so Recharts allocates column
// space; CandleShape computes all four OHLC positions independently from payload.

interface CandleShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: OHLCDataPoint
  yAxis?: { scale?: (v: number) => number }
}

function CandleShape(props: CandleShapeProps) {
  const { x = 0, width = 0, payload, yAxis } = props
  if (!payload || !yAxis?.scale) return null

  const scale = yAxis.scale
  const yOpen  = scale(payload.open)
  const yClose = scale(payload.close)
  const yHigh  = scale(payload.high)
  const yLow   = scale(payload.low)

  const bullish   = payload.close >= payload.open
  const color     = bullish ? '#22c55e' : '#ef4444'
  const bodyTop    = Math.min(yOpen, yClose)
  const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1)  // min 1px for doji candles
  const candleX    = x + width * 0.1
  const candleW    = Math.max(width * 0.8, 2)
  const midX       = x + width / 2

  return (
    <g>
      {/* High-to-low wick */}
      <line x1={midX} y1={yHigh} x2={midX} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Open-to-close body */}
      <rect x={candleX} y={bodyTop} width={candleW} height={bodyHeight} fill={color} />
    </g>
  )
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

function OHLCTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p: OHLCDataPoint = payload[0]?.payload
  if (!p) return null

  const fmt = (v: number) => `$${v.toFixed(2)}`

  return (
    <div
      style={{
        backgroundColor: '#21262d',
        border: '1px solid #30363d',
        borderRadius: 6,
        fontSize: 12,
        color: '#e6edf3',
        padding: '8px 12px',
        lineHeight: '1.6',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.date}</div>
      <div>O: {fmt(p.open)} &nbsp; H: {fmt(p.high)}</div>
      <div>L: {fmt(p.low)} &nbsp; C: {fmt(p.close)}</div>
      <div style={{ color: '#8b949e' }}>Snaps: {p.volume}</div>
      {p.watcherHigh != null && (
        <div style={{ color: '#1d6ab5', marginTop: 2 }}>
          Watchers: {p.watcherLow ?? '?'} → {p.watcherClose ?? '?'} (peak {p.watcherHigh})
        </div>
      )}
    </div>
  )
}

// ── Period selector ──────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<RollupPeriod, string> = {
  day:   'Daily',
  week:  'Weekly',
  month: 'Monthly',
}

// ── Main component ───────────────────────────────────────────────────────────

interface OHLCChartProps {
  itemId: string
}

export function OHLCChart({ itemId }: OHLCChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d')
  const [period, setPeriod] = useState<RollupPeriod>('day')

  const from = rangeToFrom(timeRange)
  const { data: points, isLoading, isError } = useHistory({ itemId, period, from })

  const hasWatcherData = useMemo(
    () => (points ?? []).some(p => p.watcherHigh != null),
    [points]
  )

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="ohlc-chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Price History (OHLC)
        </h3>
        {/* Period tabs */}
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as RollupPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              data-testid={`period-${p}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Time range tabs */}
      <div className="flex gap-1 mb-3">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setTimeRange(r.value)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              timeRange === r.value
                ? 'bg-surface-hover text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid={`range-${r.value}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart body */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">Loading...</p>
        </div>
      ) : isError ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">Failed to load history</p>
        </div>
      ) : !points || points.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-xs text-text-secondary">
            No rollup data yet. Daily candlesticks build automatically at midnight UTC after your watchlist has been synced at least once.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={hasWatcherData ? 300 : 250}>
          <ComposedChart
            data={points}
            margin={{ top: 8, right: hasWatcherData ? 48 : 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8b949e', fontSize: 10 }}
              stroke="#30363d"
              interval="preserveStartEnd"
            />
            {/* Primary Y axis: price in dollars */}
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fill: '#8b949e', fontSize: 10 }}
              stroke="#30363d"
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              domain={['auto', 'auto']}
            />
            {/* Secondary Y axis: watcher count — rendered only when data exists */}
            {hasWatcherData && (
              <YAxis
                yAxisId="watchers"
                orientation="right"
                tick={{ fill: '#1d6ab5', fontSize: 10 }}
                stroke="#1d6ab5"
                width={40}
              />
            )}
            <Tooltip content={<OHLCTooltip />} />

            {/*
              Candlestick bars.
              dataKey="high" anchors the bar container height; CandleShape
              computes all four price positions from payload via yAxis.scale.
              isAnimationActive={false} prevents layout thrash during re-renders.
            */}
            <Bar
              yAxisId="price"
              dataKey="high"
              shape={<CandleShape />}
              isAnimationActive={false}
            />

            {/* Watcher count overlay as a dashed line on the secondary axis */}
            {hasWatcherData && (
              <Line
                yAxisId="watchers"
                type="monotone"
                dataKey="watcherClose"
                stroke="#1d6ab5"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {points && points.length > 0 && (
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <span
              style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block', borderRadius: 1 }}
            />
            Bullish
          </span>
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <span
              style={{ width: 10, height: 10, background: '#ef4444', display: 'inline-block', borderRadius: 1 }}
            />
            Bearish
          </span>
          {hasWatcherData && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#1d6ab5' }}>
              <span
                style={{ width: 16, height: 2, background: '#1d6ab5', display: 'inline-block' }}
              />
              Watchers
            </span>
          )}
        </div>
      )}
    </div>
  )
}
