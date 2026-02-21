'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { PriceSnapshot } from '@/types'

interface PriceChartProps {
  snapshots: PriceSnapshot[]
}

export function PriceChart({ snapshots }: PriceChartProps) {
  const chartData = snapshots.map((s) => ({
    date: new Date(s.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: s.priceCents / 100,
  }))

  if (chartData.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-center h-64" data-testid="price-chart">
        <p className="text-xs text-text-secondary">No price history yet</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4" data-testid="price-chart">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Price History
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1d6ab5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1d6ab5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#30363d"
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#30363d"
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              fontSize: 12,
              color: '#e6edf3',
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#1d6ab5"
            fill="url(#priceGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
