import { create } from 'zustand'
import type { ListingStatus, ListingType } from '@/types'

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
}

export const useWatchlistStore = create<WatchlistStore>((set) => ({
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
    queue: true,
  },
  toggleColumn: (col) =>
    set((state) => ({
      visibleColumns: {
        ...state.visibleColumns,
        [col]: !state.visibleColumns[col],
      },
    })),
}))
