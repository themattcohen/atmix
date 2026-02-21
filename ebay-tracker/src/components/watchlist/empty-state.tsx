'use client'

interface EmptyStateProps {
  hasFilters?: boolean
}

export function EmptyState({ hasFilters = false }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg className="w-12 h-12 text-text-secondary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
      <p className="text-sm text-text-primary font-medium mb-1">
        {hasFilters ? 'No items match your filters' : 'No items yet'}
      </p>
      <p className="text-xs text-text-secondary">
        {hasFilters
          ? 'Try adjusting your search or filters'
          : 'Add items to your eBay watchlist and sync to see them here'}
      </p>
    </div>
  )
}
