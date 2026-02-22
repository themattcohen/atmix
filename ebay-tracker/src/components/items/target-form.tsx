'use client'
import { useState } from 'react'
import { useTargets } from '@/hooks/use-targets'
import { formatCents, parseCents } from '@/lib/format'
import type { PriceTarget, TargetType } from '@/types'

interface TargetFormProps {
  itemId: string
}

interface TargetInputRowProps {
  label: string
  targetType: TargetType
  existingTargets: PriceTarget[]
  onSubmit: (targetType: TargetType, targetCents: number) => Promise<void>
  isPending: boolean
}

function TargetInputRow({ label, targetType, existingTargets, onSubmit, isPending }: TargetInputRowProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsedCents = parseCents(value)
  const isValid = parsedCents !== null

  const duplicate = isValid
    ? existingTargets.some(
        t => t.targetType === targetType && t.targetCents === parsedCents && t.status === 'active'
      )
    : false

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setError(null)
    try {
      await onSubmit(targetType, parsedCents!)
      setValue('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to set target')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-secondary pointer-events-none">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="w-full pl-5 pr-2 py-1.5 text-xs bg-raised border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent text-text-primary placeholder:text-text-secondary"
          />
        </div>
        <button
          type="submit"
          disabled={!isValid || isPending}
          className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          Set
        </button>
      </div>
      {value && !isValid && (
        <p className="text-[10px] text-status-sold">Enter a price greater than $0.00</p>
      )}
      {duplicate && (
        <p className="text-[10px] text-urgency-caution">You already have an active target at this price.</p>
      )}
      {error && (
        <p className="text-[10px] text-status-sold">{error}</p>
      )}
    </form>
  )
}

interface TargetRowProps {
  target: PriceTarget
  onAcknowledge: (id: number) => void
  onDeactivate: (id: number) => void
  onDelete: (id: number) => void
  disabled: boolean
}

function TargetRow({ target, onAcknowledge, onDeactivate, onDelete, disabled }: TargetRowProps) {
  const label = target.targetType === 'buy_below' ? 'Buy below' : 'Sell above'

  const statusColors: Record<string, string> = {
    active:       'text-status-active',
    triggered:    'text-urgency-caution',
    acknowledged: 'text-text-secondary',
    deactivated:  'text-text-secondary',
  }

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded ${target.status === 'triggered' ? 'bg-urgency-caution/10' : 'hover:bg-raised'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary">
          {label} {formatCents(target.targetCents)}
        </p>
        {target.status === 'triggered' && target.triggeredPriceCents !== null && (
          <p className="text-[10px] text-urgency-caution">
            Hit at {formatCents(target.triggeredPriceCents)}
            {target.triggeredAt && (
              <span className="text-text-secondary ml-1">
                on {new Date(target.triggeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </p>
        )}
        {(target.status === 'acknowledged' || target.status === 'deactivated') && target.triggeredPriceCents !== null && (
          <p className="text-[10px] text-text-secondary">
            Hit at {formatCents(target.triggeredPriceCents)}
          </p>
        )}
      </div>
      <span className={`text-[10px] font-medium capitalize ${statusColors[target.status] ?? 'text-text-secondary'}`}>
        {target.status}
      </span>
      <div className="flex gap-1">
        {target.status === 'triggered' && (
          <button
            onClick={() => onAcknowledge(target.id)}
            disabled={disabled}
            className="px-2 py-0.5 text-[10px] font-medium bg-urgency-caution/20 text-urgency-caution rounded hover:bg-urgency-caution/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Dismiss
          </button>
        )}
        {(target.status === 'active' || target.status === 'triggered') && (
          <button
            onClick={() => onDeactivate(target.id)}
            disabled={disabled}
            className="px-2 py-0.5 text-[10px] font-medium bg-raised text-text-secondary rounded hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Disable
          </button>
        )}
        <button
          onClick={() => onDelete(target.id)}
          disabled={disabled}
          className="px-2 py-0.5 text-[10px] font-medium text-status-sold/70 rounded hover:text-status-sold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function TargetForm({ itemId }: TargetFormProps) {
  const { data: targets = [], isLoading, create, update, remove } = useTargets(itemId)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const activeTargets = targets.filter(t => t.status === 'active' || t.status === 'triggered')
  const closedTargets = targets.filter(t => t.status === 'acknowledged' || t.status === 'deactivated')

  async function handleCreate(targetType: TargetType, targetCents: number) {
    setPendingAction('creating')
    setMutationError(null)
    try {
      await create.mutateAsync({ itemId, targetType, targetCents })
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create target')
    } finally {
      setPendingAction(null)
    }
  }

  function handleAcknowledge(id: number) {
    setPendingAction('acknowledging')
    setMutationError(null)
    update.mutate({ id, action: 'acknowledge' }, {
      onError: (err) => { setMutationError(err instanceof Error ? err.message : 'Failed to acknowledge target') },
      onSettled: () => { setPendingAction(null) },
    })
  }

  function handleDeactivate(id: number) {
    setPendingAction('deactivating')
    setMutationError(null)
    update.mutate({ id, action: 'deactivate' }, {
      onError: (err) => { setMutationError(err instanceof Error ? err.message : 'Failed to deactivate target') },
      onSettled: () => { setPendingAction(null) },
    })
  }

  function handleDelete(id: number) {
    setPendingAction('deleting')
    setMutationError(null)
    remove.mutate(id, {
      onError: (err) => { setMutationError(err instanceof Error ? err.message : 'Failed to delete target') },
      onSettled: () => { setPendingAction(null) },
    })
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
        Price Targets
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TargetInputRow
          label="Buy below"
          targetType="buy_below"
          existingTargets={targets}
          onSubmit={handleCreate}
          isPending={!!pendingAction}
        />
        <TargetInputRow
          label="Sell above"
          targetType="sell_above"
          existingTargets={targets}
          onSubmit={handleCreate}
          isPending={!!pendingAction}
        />
      </div>

      {mutationError && (
        <p className="text-xs text-status-sold mt-1">{mutationError}</p>
      )}

      {isLoading ? (
        <p className="text-xs text-text-secondary">Loading targets...</p>
      ) : activeTargets.length === 0 && closedTargets.length === 0 ? (
        <p className="text-xs text-text-secondary">No price targets set.</p>
      ) : (
        <div className="space-y-1">
          {activeTargets.map(target => (
            <TargetRow
              key={target.id}
              target={target}
              onAcknowledge={handleAcknowledge}
              onDeactivate={handleDeactivate}
              onDelete={handleDelete}
              disabled={!!pendingAction}
            />
          ))}
          {closedTargets.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary pt-2 pb-1">
                History
              </p>
              {closedTargets.map(target => (
                <TargetRow
                  key={target.id}
                  target={target}
                  onAcknowledge={handleAcknowledge}
                  onDeactivate={handleDeactivate}
                  onDelete={handleDelete}
                  disabled={!!pendingAction}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
