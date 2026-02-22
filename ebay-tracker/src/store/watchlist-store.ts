import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ListingStatus, ListingType } from '@/types'

export type SortKey = 'rank' | 'price' | 'watchers' | 'end_time' | 'bid_count' | 'status'
export type SortDir = 'asc' | 'desc'

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  rank: 40,
  image: 40,
  title: 240,
  price: 80,
  delta: 80,
  watchers: 100,
  bidCount: 50,
  timeLeft: 90,
  status: 70,
  signals: 90,
  queue: 32,
}

interface WatchlistStore {
  // Filters
  statusFilter: ListingStatus | 'All'
  typeFilter: ListingType | 'All'
  searchQuery: string
  setStatusFilter: (s: ListingStatus | 'All') => void
  setTypeFilter: (t: ListingType | 'All') => void
  setSearchQuery: (q: string) => void
  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  // Column visibility
  visibleColumns: Record<string, boolean>
  toggleColumn: (col: string) => void
  // Sparkline timeframe preference
  sparklineDays: 7 | 14 | 30
  setSparklineDays: (d: 7 | 14 | 30) => void
  // Sort (Feature 2)
  sortBy: SortKey
  sortDir: SortDir
  setSortAndDir: (col: SortKey, dir: SortDir) => void
  // Column widths (Feature 3)
  columnWidths: Record<string, number>
  setColumnWidth: (col: string, width: number) => void
  // Hydration flag for SSR safety
  _hydrated: boolean
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set) => ({
      // Filters
      statusFilter: 'All',
      typeFilter: 'All',
      searchQuery: '',
      setStatusFilter: (s) => set({ statusFilter: s }),
      setTypeFilter: (t) => set({ typeFilter: t }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      // Column visibility
      visibleColumns: {
        rank: true,
        image: true,
        title: true,
        price: true,
        delta: true,
        watchers: true,
        bidCount: true,
        timeLeft: true,
        status: true,
        signals: true,
        queue: true,
      },
      toggleColumn: (col) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [col]: !state.visibleColumns[col],
          },
        })),
      // Sparkline timeframe
      sparklineDays: 7,
      setSparklineDays: (d) => set({ sparklineDays: d }),
      // Sort
      sortBy: 'rank',
      sortDir: 'asc',
      setSortAndDir: (col, dir) => set({ sortBy: col, sortDir: dir }),
      // Column widths
      columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
      setColumnWidth: (col, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [col]: Math.max(30, width) },
        })),
      // Hydration
      _hydrated: false,
    }),
    {
      name: 'watchlist-ui',
      partialize: (state) => ({
        columnWidths: state.columnWidths,
        visibleColumns: state.visibleColumns,
        sparklineDays: state.sparklineDays,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
      }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useWatchlistStore.setState({ _hydrated: true })
      },
    }
  )
)
