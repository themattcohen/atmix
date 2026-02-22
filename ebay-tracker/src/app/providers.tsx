'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SignalToastContainer } from '@/components/signals/signal-toast'
import { STALE_TIME_MS } from '@/lib/poll-intervals'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS },
    },
  }))
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <SignalToastContainer />
    </QueryClientProvider>
  )
}
