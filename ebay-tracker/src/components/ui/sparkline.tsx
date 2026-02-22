'use client'
import { useId, useRef, useState, useCallback } from 'react'

interface SparklineProps {
  data: number[]           // price_cents values, chronological
  width?: number
  height?: number
  /** 'up' = price rose (red), 'down' = price fell (green), 'flat' = neutral (blue) */
  trend?: 'up' | 'down' | 'flat'
  showMinMax?: boolean
  showTooltip?: boolean
  /** Format function for tooltip values. Defaults to cents to dollars. */
  formatValue?: (cents: number) => string
}

function defaultFormat(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function Sparkline({
  data,
  width = 72,
  height = 22,
  trend,
  showMinMax = true,
  showTooltip = true,
  formatValue = defaultFormat,
}: SparklineProps) {
  const gradientId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: string } | null>(null)

  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // 2px padding top and bottom so dots at extremes aren't clipped
  const pad = 2
  const innerHeight = height - pad * 2

  const toSvgY = (cents: number) =>
    pad + innerHeight - ((cents - min) / range) * innerHeight

  const toSvgX = (i: number) => (i / (data.length - 1)) * width

  const points = data.map((v, i) => `${toSvgX(i).toFixed(1)},${toSvgY(v).toFixed(1)}`)
  const polylinePoints = points.join(' ')

  // Area path: line + close back along bottom
  const areaPath = [
    `M ${toSvgX(0).toFixed(1)},${toSvgY(data[0]).toFixed(1)}`,
    ...data.slice(1).map((v, i) => `L ${toSvgX(i + 1).toFixed(1)},${toSvgY(v).toFixed(1)}`),
    `L ${width},${height}`,
    `L 0,${height}`,
    'Z',
  ].join(' ')

  // Derived trend if not explicitly passed
  const resolvedTrend = trend ?? (
    data[data.length - 1] < data[0] ? 'down'
    : data[data.length - 1] > data[0] ? 'up'
    : 'flat'
  )

  const lineColor =
    resolvedTrend === 'down' ? '#22c55e'   // green-500 — price fell, good for buyer
    : resolvedTrend === 'up' ? '#ef4444'   // red-500   — price rose
    : '#1d6ab5'                             // accent blue — flat

  // Min and max point indices
  const minIdx = data.indexOf(min)
  const maxIdx = data.indexOf(max)

  // Tooltip interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!showTooltip || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    // Find nearest data point
    const idx = Math.round((mouseX / width) * (data.length - 1))
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx))
    const svgX = toSvgX(clampedIdx)
    const svgY = toSvgY(data[clampedIdx])
    setTooltip({ x: svgX, y: svgY, value: formatValue(data[clampedIdx]) })
  }, [showTooltip, data, width, formatValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block"
        aria-hidden="true"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          stroke="none"
        />

        {/* Line */}
        <polyline
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />

        {/* Min/max dots */}
        {showMinMax && range > 0 && (
          <>
            <circle
              cx={toSvgX(minIdx).toFixed(1)}
              cy={toSvgY(min).toFixed(1)}
              r={2}
              fill={resolvedTrend === 'down' ? '#22c55e' : '#8b949e'}
            />
            <circle
              cx={toSvgX(maxIdx).toFixed(1)}
              cy={toSvgY(max).toFixed(1)}
              r={2}
              fill={resolvedTrend === 'up' ? '#ef4444' : '#8b949e'}
            />
          </>
        )}

        {/* Hover crosshair dot */}
        {tooltip && (
          <circle
            cx={tooltip.x.toFixed(1)}
            cy={tooltip.y.toFixed(1)}
            r={2.5}
            fill={lineColor}
            stroke="#21262d"
            strokeWidth={1}
          />
        )}
      </svg>

      {/* Tooltip bubble — rendered outside SVG so it can overflow the cell */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-primary bg-raised border border-border shadow-md whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y - 24,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.value}
        </div>
      )}
    </div>
  )
}
