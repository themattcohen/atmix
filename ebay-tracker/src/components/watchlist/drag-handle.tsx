'use client'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import type { DraggableAttributes } from '@dnd-kit/core'

interface DragHandleProps {
  listeners?: SyntheticListenerMap
  attributes?: DraggableAttributes
}

export function DragHandle({ listeners, attributes }: DragHandleProps) {
  return (
    <button
      className="cursor-grab active:cursor-grabbing p-1 text-text-secondary hover:text-text-primary touch-none"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="3" r="1.5" />
        <circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  )
}
