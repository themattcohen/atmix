import type { NewsProcessedStatus, NewsExtractionMethod } from '@/types'

const statusStyles: Record<NewsProcessedStatus, string> = {
  matched: 'bg-green-500/15 text-green-400',
  ai_fallback: 'bg-amber-500/15 text-amber-400',
  no_match: 'bg-zinc-500/15 text-zinc-500',
  pending: 'bg-zinc-500/15 text-zinc-600',
}

const statusLabels: Record<NewsProcessedStatus, string> = {
  matched: 'Matched',
  ai_fallback: 'AI Fallback',
  no_match: 'No Match',
  pending: 'Pending',
}

const methodLabels: Record<NewsExtractionMethod, string | null> = {
  regex: 'Regex',
  ai: 'Haiku AI',
  none: null,
}

interface Props {
  status: NewsProcessedStatus
  method: NewsExtractionMethod
}

export function NewsStatusBadge({ status, method }: Props) {
  const methodLabel = methodLabels[method]

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyles[status]}`}>
        {statusLabels[status]}
      </span>
      {methodLabel && (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-500/10 text-zinc-400">
          {methodLabel}
        </span>
      )}
    </span>
  )
}
