'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWatchlistStore } from '@/store/watchlist-store'
import { SyncButton } from '@/components/watchlist/sync-button'

export function TopBar() {
  const pathname = usePathname()
  const toggleSidebar = useWatchlistStore((s) => s.toggleSidebar)

  const navLinks = [
    { href: '/', label: 'Watchlist' },
    { href: '/trends', label: 'Trends' },
  ]

  return (
    <header className="h-[49px] bg-surface border-b border-border flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Logo */}
      <span className="text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap">
        eBay Watchlist
      </span>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-2">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              pathname === link.href
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-raised'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync button */}
      <SyncButton />

      {/* Sidebar toggle (mobile) */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 text-text-secondary hover:text-text-primary hover:bg-raised rounded transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  )
}
