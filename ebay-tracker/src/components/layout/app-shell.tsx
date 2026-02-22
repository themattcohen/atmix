'use client'
import { useState, useEffect } from 'react'
import { useWatchlistStore } from '@/store/watchlist-store'
import { Sidebar } from './sidebar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useWatchlistStore((s) => s.sidebarOpen)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Desktop sidebar: fixed 320px */}
      {!isMobile && (
        <div
          className={`w-80 flex-shrink-0 border-l border-border bg-surface overflow-auto transition-all ${
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-l-0'
          }`}
        >
          <Sidebar />
        </div>
      )}

      {/* Mobile sidebar: overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={useWatchlistStore.getState().toggleSidebar}
          />
          <div className="absolute right-0 top-[49px] bottom-0 w-80 bg-surface border-l border-border overflow-auto">
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  )
}
