'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SignalToastContainer } from '@/components/signals/signal-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchInterval: 60_000 },
    },
  }))
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <SignalToastContainer />
    </QueryClientProvider>
  )
}
