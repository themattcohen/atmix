import { test, expect } from '@playwright/test'
import type { WatchlistItem } from '../../src/types'
import { mockEventsResponse } from './helpers/mock-data'

// ---------------------------------------------------------------------------
// Inline factory — mirrors makeItem() from helpers/mock-data.ts so this file
// is self-contained for the budget-specific mock shapes.
// ---------------------------------------------------------------------------
function makeItem(overrides: Partial<WatchlistItem> & { id: string; title: string }): WatchlistItem {
  return {
    rank: null,
    currentPrice: 5000,
    buyItNowPrice: null,
    shippingCost: 0,
    listingType: 'Auction',
    conditionName: 'Used',
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    timeLeft: 'P3D',
    sellerId: 'seller123',
    sellerFeedback: 100,
    watcherCount: 0,
    bidCount: 0,
    imageUrl: null,
    listingUrl: 'https://www.ebay.com/itm/test',
    status: 'Active',
    isInQueue: false,
    notes: null,
    firstSeenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSyncedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeWatchlistResponse(ranked: WatchlistItem[], unranked: WatchlistItem[] = []) {
  return {
    data: {
      ranked,
      unranked,
      counts: {
        active: ranked.length + unranked.length,
        sold: 0,
        ended: 0,
        total: ranked.length + unranked.length,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Shared API interceptor — routes both exact and query-string variants of
// /api/items. Mirrors the interceptApis() pattern from watchlist-table.spec.ts.
// ---------------------------------------------------------------------------
function interceptBudgetApis(
  page: import('@playwright/test').Page,
  watchlistResponse: ReturnType<typeof makeWatchlistResponse>
) {
  return Promise.all([
    page.route('**/api/items?*', (route) =>
      route.fulfill({ json: watchlistResponse })
    ),
    page.route('**/api/items', (route) =>
      route.fulfill({ json: watchlistResponse })
    ),
    page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    ),
  ])
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Test 1 — 3 FixedPrice ranked items (no mode multiplier applies to FixedPrice)
// $50 + $120 = $170 fits exactly; $200 is over-budget.
const budget3Items: WatchlistItem[] = [
  makeItem({
    id: 'B1',
    title: 'Budget Item Alpha',
    rank: 1,
    currentPrice: 5000,   // $50.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
  makeItem({
    id: 'B2',
    title: 'Budget Item Beta',
    rank: 2,
    currentPrice: 12000,  // $120.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
  makeItem({
    id: 'B3',
    title: 'Budget Item Gamma',
    rank: 3,
    currentPrice: 20000,  // $200.00
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    status: 'Active',
  }),
]

// Test 2 — 2 Auction items, no BIN, no shipping.
// Mode cost table (currentPrice * multiplier):
//   Moderate    (1.25x): A=$125, B=$100  → budget $130: A selected, B excluded
//   Aggressive  (1.10x): A=$110, B=$88   → budget $130: A selected, B excluded
//   Conservative(1.50x): A=$150, B=$120  → budget $130: A over-budget, B selected
const budgetAuctionItems: WatchlistItem[] = [
  makeItem({
    id: 'A1',
    title: 'Auction Item Alpha',
    rank: 1,
    currentPrice: 10000,  // $100.00
    shippingCost: 0,
    listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null,
    watcherCount: 0,
    bidCount: 0,
    status: 'Active',
  }),
  makeItem({
    id: 'A2',
    title: 'Auction Item Beta',
    rank: 2,
    currentPrice: 8000,   // $80.00
    shippingCost: 0,
    listingType: 'Auction',
    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    buyItNowPrice: null,
    watcherCount: 0,
    bidCount: 0,
    status: 'Active',
  }),
]

// Test 3 — 5 unranked items only (rank === null).
const budgetUnrankedItems: WatchlistItem[] = [
  makeItem({ id: 'U1', title: 'Unranked Item One',   rank: null, currentPrice: 2000, status: 'Active' }),
  makeItem({ id: 'U2', title: 'Unranked Item Two',   rank: null, currentPrice: 3000, status: 'Active' }),
  makeItem({ id: 'U3', title: 'Unranked Item Three', rank: null, currentPrice: 1500, status: 'Active' }),
  makeItem({ id: 'U4', title: 'Unranked Item Four',  rank: null, currentPrice: 4500, status: 'Active' }),
  makeItem({ id: 'U5', title: 'Unranked Item Five',  rank: null, currentPrice: 800,  status: 'Active' }),
]

// Test 4 — 1 ranked FixedPrice item. Sub-scores are deterministic:
//   rank=1/1 → rankValue=1.0, FixedPrice → confidenceScore=1.0,
//   endTime=null → urgencyScore=0.10, watcherCount=5/bidCount=0 → competitionPenalty≈0.23,
//   FixedPrice → priceOpportunity=0.50
const budgetSingleItem: WatchlistItem[] = [
  makeItem({
    id: 'S1',
    title: 'Score Tooltip Item',
    rank: 1,
    currentPrice: 4500,   // $45.00 — well under any $500 test budget
    shippingCost: 0,
    listingType: 'FixedPrice',
    endTime: null,
    buyItNowPrice: null,
    watcherCount: 5,
    bidCount: 0,
    status: 'Active',
  }),
]

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Budget Optimizer', () => {
  // -------------------------------------------------------------------------
  // T29: Basic Optimization
  // 3 FixedPrice items, $170 budget, Moderate mode.
  // Items 1 ($50) and 2 ($120) are selected — sum = $170 exactly.
  // Item 3 ($200) is excluded with "over-total-budget" reason.
  // -------------------------------------------------------------------------
  test('T29: basic optimization selects items that fit budget and excludes over-budget item', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budget3Items))

    // Clear any persisted state from a previous test run
    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Moderate is the default mode — no explicit click needed.
    // Enter $170 budget.
    await page.getByLabel(/Budget/i).fill('170')

    // Wait for picks table to appear with selected items
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()

    // Items 1 and 2 should appear in picks
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Budget Item Alpha' })
    ).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Budget Item Beta' })
    ).toBeVisible()

    // Item 3 should appear in excluded tab
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(page.getByTestId('budget-excluded-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Budget Item Gamma' })
    ).toBeVisible()

    // Excluded reason for over-budget item
    await expect(
      page.getByTestId('budget-excluded-table').getByText('Over budget')
    ).toBeVisible()

    // BudgetSummary stat cards
    const summary = page.getByTestId('budget-summary')
    await expect(summary).toBeVisible()

    // 2 items selected
    await expect(summary.getByText('2')).toBeVisible()

    // Est. total $170.00
    await expect(summary.getByText('$170.00')).toBeVisible()

    // Remaining $0.00
    await expect(summary.getByText('$0.00')).toBeVisible()

    // Budget used 100%
    await expect(summary.getByText('100%')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // T30: Mode Change Recalculates Results
  // 2 Auction items, $130 budget.
  // Moderate / Aggressive → Item A selected, Item B excluded.
  // Conservative → Item A over-budget, Item B selected (result flips).
  // -------------------------------------------------------------------------
  test('T30: switching auction mode recalculates picks without page navigation', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budgetAuctionItems))

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $130 budget
    await page.getByLabel(/Budget/i).fill('130')

    // --- Moderate (default) ---
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // Item B should be in excluded
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Auction Item Beta' })
    ).toBeVisible()

    // --- Aggressive mode ---
    await page.getByRole('radio', { name: /Aggressive/i }).check()

    // Results update in place — picks tab shows item A (same selection)
    await page.getByRole('tab', { name: /Picks/i }).click()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // --- Conservative mode — result flips ---
    await page.getByRole('radio', { name: /Conservative/i }).check()

    // Item A now exceeds the $130 budget (est. cost = $150) → excluded
    await page.getByRole('tab', { name: /Excluded/i }).click()
    await expect(page.getByTestId('budget-excluded-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-excluded-table').getByRole('link', { name: 'Auction Item Alpha' })
    ).toBeVisible()

    // Exclusion reason: over total budget
    await expect(
      page.getByTestId('budget-excluded-table').getByText('Over budget')
    ).toBeVisible()

    // Item B is now the pick (est. cost = $120 ≤ $130)
    await page.getByRole('tab', { name: /Picks/i }).click()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Auction Item Beta' })
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // T31: No Ranked Items Shows Empty State
  // Watchlist has 5 unranked items. Any budget entered shows empty state.
  // -------------------------------------------------------------------------
  test('T31: no ranked items shows empty state and link to watchlist', async ({ page }) => {
    await interceptBudgetApis(
      page,
      makeWatchlistResponse([], budgetUnrankedItems)
    )

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter a budget to trigger optimizer
    await page.getByLabel(/Budget/i).fill('500')

    // No picks or excluded tables rendered
    await expect(page.getByTestId('budget-picks-table')).not.toBeVisible()
    await expect(page.getByTestId('budget-excluded-table')).not.toBeVisible()

    // Empty state with expected title
    await expect(page.getByText('No ranked items to optimize')).toBeVisible()

    // "Go to Watchlist" link navigates to /
    const watchlistLink = page.getByRole('link', { name: 'Go to Watchlist' })
    await expect(watchlistLink).toBeVisible()
    await watchlistLink.click()
    await expect(page).toHaveURL('/')
  })

  // -------------------------------------------------------------------------
  // T32: Score Breakdown Tooltip
  // 1 ranked FixedPrice item fits in budget. Hovering the score chip shows
  // all five sub-score rows and a total score row.
  // -------------------------------------------------------------------------
  test('T32: hovering score chip shows sub-score breakdown tooltip', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budgetSingleItem))

    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $500 — the $45 item fits easily
    await page.getByLabel(/Budget/i).fill('500')

    // Wait for picks table
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
    await expect(
      page.getByTestId('budget-picks-table').getByRole('link', { name: 'Score Tooltip Item' })
    ).toBeVisible()

    // Locate the score chip in the picks table.
    // ScoreBreakdownChip renders a chip with aria-label="Score N%: ..."
    const scoreChip = page.getByTestId('budget-picks-table').locator('[aria-label^="Score"]').first()
    await expect(scoreChip).toBeVisible()

    // Hover to trigger tooltip
    await scoreChip.hover()

    // Tooltip should contain all five sub-score labels
    await expect(page.getByText('Rank priority')).toBeVisible()
    await expect(page.getByText('Price opportunity')).toBeVisible()
    await expect(page.getByText('Urgency')).toBeVisible()
    await expect(page.getByText('Buy confidence')).toBeVisible()
    await expect(page.getByText('Competition')).toBeVisible()

    // Total score row must also be visible
    await expect(page.getByText('Total score')).toBeVisible()

    // Extract the total score percentage from the chip aria-label and verify
    // it matches what is shown in the tooltip's "Total score" row.
    const chipLabel = await scoreChip.getAttribute('aria-label')
    // aria-label format: "Score 72%: rank 100%, urgency 10%, ..."
    const chipPctMatch = chipLabel?.match(/Score\s+(\d+)%/)
    expect(chipPctMatch).not.toBeNull()
    const chipPct = chipPctMatch![1]

    // The tooltip's total score line should contain the same percentage
    const totalScoreLine = page.locator('text=Total score').locator('..')
    await expect(totalScoreLine).toContainText(chipPct)
  })

  // -------------------------------------------------------------------------
  // T33: Budget Persistence Across Navigation
  // Enter $500 + Conservative mode on /budget, navigate to /, navigate back.
  // Zustand persist middleware (localStorage) should restore both values.
  // -------------------------------------------------------------------------
  test('T33: budget amount and auction mode persist across navigation', async ({ page }) => {
    await interceptBudgetApis(page, makeWatchlistResponse(budget3Items))

    // Start from a clean slate
    await page.addInitScript(() => {
      localStorage.removeItem('ebay-budget-optimizer-v1')
    })

    await page.goto('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Enter $500 budget — use role/name to target the text input specifically
    const budgetInput = page.getByRole('textbox', { name: 'Budget' })
    await budgetInput.fill('500')
    await expect(budgetInput).toHaveValue('500')

    // Select Conservative mode
    await page.getByRole('radio', { name: /Conservative/i }).check()
    await expect(page.getByRole('radio', { name: /Conservative/i })).toBeChecked()

    // Navigate away to the watchlist page
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page).toHaveURL('/')

    // Navigate back to /budget — use exact: true to avoid matching "Budget Item..." links
    await page.getByRole('link', { name: 'Budget', exact: true }).click()
    await expect(page).toHaveURL('/budget')
    await expect(page.getByTestId('budget-page')).toBeVisible()

    // Budget input should be restored
    await expect(page.getByRole('textbox', { name: 'Budget' })).toHaveValue('500')

    // Conservative mode should still be selected
    await expect(page.getByRole('radio', { name: /Conservative/i })).toBeChecked()

    // Results should be re-rendered (optimizer ran on restored state)
    await expect(page.getByTestId('budget-summary')).toBeVisible()
    await expect(page.getByTestId('budget-picks-table')).toBeVisible()
  })
})
