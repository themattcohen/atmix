'use client'
import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}

export function Tooltip({ content, children, wide }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [flipUp, setFlipUp] = useState(true)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (visible && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      // If too close to top, show below
      setFlipUp(rect.top > 250)
    }
  }, [visible])

  const widthClass = wide ? 'w-72' : 'whitespace-nowrap'
  const posClass = flipUp
    ? 'bottom-full mb-1.5'
    : 'top-full mt-1.5'

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className={`absolute left-1/2 -translate-x-1/2 ${posClass} px-2 py-1 text-xs text-text-primary bg-raised border border-border rounded shadow-lg z-50 pointer-events-none ${widthClass}`}>
          {content}
        </span>
      )}
    </span>
  )
}
