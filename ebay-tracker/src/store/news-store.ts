import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NewsSortKey = 'fetched_at' | 'source' | 'status' | 'mentions' | 'signals'
export type SortDir = 'asc' | 'desc'

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  fetchedAt: 70,
  source: 70,
  title: 300,
  status: 90,
  method: 60,
  mentions: 150,
  confidence: 70,
  eventType: 80,
  score: 50,
  keyword: 100,
  decay: 70,
  signalCount: 50,
}

interface NewsStore {
  sortBy: NewsSortKey
  sortDir: SortDir
  setSortAndDir: (col: NewsSortKey, dir: SortDir) => void
  columnWidths: Record<string, number>
  setColumnWidth: (col: string, width: number) => void
  visibleColumns: Record<string, boolean>
  toggleColumn: (col: string) => void
  _hydrated: boolean
}

export const useNewsStore = create<NewsStore>()(
  persist(
    (set) => ({
      sortBy: 'fetched_at',
      sortDir: 'desc',
      setSortAndDir: (col, dir) => set({ sortBy: col, sortDir: dir }),
      columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
      setColumnWidth: (col, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [col]: Math.max(30, width) },
        })),
      visibleColumns: {
        fetchedAt: true,
        source: true,
        title: true,
        status: true,
        method: true,
        mentions: true,
        confidence: true,
        eventType: true,
        score: true,
        keyword: true,
        decay: false,
        signalCount: true,
      },
      toggleColumn: (col) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [col]: !state.visibleColumns[col],
          },
        })),
      _hydrated: false,
    }),
    {
      name: 'ebay-news-store',
      partialize: (state) => ({
        columnWidths: state.columnWidths,
        visibleColumns: state.visibleColumns,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
      }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useNewsStore.setState({ _hydrated: true })
      },
    }
  )
)
