'use client'
import { useState, useRef, useEffect } from 'react'
import { useDragRank } from '@/hooks/use-drag-rank'

interface RankCellProps {
  itemId: string
  rank: number | null
}

export function RankCell({ itemId, rank }: RankCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const rankMutation = useDragRank()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleConfirm = () => {
    const newRank = parseInt(value, 10)
    if (newRank > 0 && newRank !== rank) {
      rankMutation.mutate({ itemId, newRank })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={handleKeyDown}
        className="w-8 bg-raised border border-border rounded px-1 py-0.5 text-xs text-text-primary text-center font-mono outline-none focus:border-accent"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setValue(rank?.toString() ?? '1')
        setEditing(true)
      }}
      className="w-8 text-center text-xs font-mono text-text-secondary hover:text-text-primary cursor-pointer"
      title="Click to edit rank"
    >
      {rank ?? '—'}
    </button>
  )
}
