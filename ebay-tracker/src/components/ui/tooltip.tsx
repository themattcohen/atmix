'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}

export function Tooltip({ content, children, wide }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, flipUp: true })
  const containerRef = useRef<HTMLSpanElement>(null)

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const flipUp = rect.top > 120
    setCoords({
      top: flipUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left + rect.width / 2,
      flipUp,
    })
  }, [])

  useEffect(() => {
    if (visible) updatePosition()
  }, [visible, updatePosition])

  const widthClass = wide ? 'w-72' : 'whitespace-nowrap'
  const transformOrigin = coords.flipUp ? 'bottom center' : 'top center'

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && typeof document !== 'undefined' &&
        createPortal(
          <span
            style={{
              position: 'fixed',
              top: coords.flipUp ? undefined : coords.top,
              bottom: coords.flipUp ? `calc(100vh - ${coords.top}px)` : undefined,
              left: coords.left,
              transform: 'translateX(-50%)',
              transformOrigin,
              zIndex: 9999,
            }}
            className={`px-2 py-1.5 text-xs leading-relaxed text-text-primary bg-raised border border-border rounded shadow-lg pointer-events-none ${widthClass}`}
          >
            {content}
          </span>,
          document.body
        )
      }
    </span>
  )
}
