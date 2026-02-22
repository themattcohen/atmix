'use client'
import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWatchlist } from '@/hooks/use-watchlist'
import { optimizeBudget } from '@/lib/budget/optimizer'
import type { AuctionMode, OptimizationResult } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseBudgetCents(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars) || dollars <= 0) return 0
  return Math.round(dollars * 100)
}

// ---------------------------------------------------------------------------
// Zustand store — only inputs are persisted; result is derived via useMemo
// ---------------------------------------------------------------------------

interface BudgetStore {
  budgetDollars: string
  auctionMode: AuctionMode
  setBudgetDollars: (value: string) => void
  setAuctionMode: (mode: AuctionMode) => void
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set) => ({
      budgetDollars: '',
      auctionMode: 'moderate',
      setBudgetDollars: (value) => set({ budgetDollars: value }),
      setAuctionMode: (mode) => set({ auctionMode: mode }),
    }),
    {
      name: 'ebay-budget-optimizer-v1',
      partialize: (state) => ({
        budgetDollars: state.budgetDollars,
        auctionMode: state.auctionMode,
      }),
    }
  )
)

// ---------------------------------------------------------------------------
// useBudget — composite hook used by the budget page
// ---------------------------------------------------------------------------

export interface UseBudgetReturn {
  result: OptimizationResult | null
  budgetDollars: string
  setBudgetDollars: (value: string) => void
  auctionMode: AuctionMode
  setAuctionMode: (mode: AuctionMode) => void
  isLoading: boolean
  isError: boolean
}

export function useBudget(): UseBudgetReturn {
  const { budgetDollars, auctionMode, setBudgetDollars, setAuctionMode } = useBudgetStore()
  const { data, isLoading, isError } = useWatchlist()

  const result = useMemo<OptimizationResult | null>(() => {
    const budgetCents = parseBudgetCents(budgetDollars)
    if (!data || budgetCents <= 0) return null
    const allItems = [...data.ranked, ...data.unranked]
    return optimizeBudget(allItems, budgetCents, auctionMode)
  }, [data, budgetDollars, auctionMode])

  return {
    result,
    budgetDollars,
    setBudgetDollars,
    auctionMode,
    setAuctionMode,
    isLoading,
    isError,
  }
}
