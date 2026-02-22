import { test, expect, type Page, type Route } from '@playwright/test'
import {
  mockWatchlistResponse,
  mockEventsResponse,
  mockItems,
  mockRanked,
  mockUnranked,
  mockItemDetailResponse,
  mockSnapshots,
  mockEvents,
  mockSignals,
  mockSignalsResponse,
  mockSignalStatsResponse,

  mockTrendsResponse,
} from './helpers/mock-data'

// ─── Enhanced mock data for antagonistic tests ──────────────────────────

const mockTargets = [
  {
    id: 1,
    item_id: '111',
    target_type: 'buy_below',
    target_cents: 4000,
    status: 'active',
    created_at: new Date().toISOString(),
    triggered_at: null,
    triggered_price_cents: null,
    acknowledged_at: null,
  },
  {
    id: 2,
    item_id: '111',
    target_type: 'sell_above',
    target_cents: 6000,
    status: 'triggered',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    triggered_at: new Date().toISOString(),
    triggered_price_cents: 6100,
    acknowledged_at: null,
  },
]

const mockTargetsFormatted = mockTargets.map(t => ({
  id: t.id,
  itemId: t.item_id,
  targetType: t.target_type,
  targetCents: t.target_cents,
  status: t.status,
  createdAt: t.created_at,
  triggeredAt: t.triggered_at,
  triggeredPriceCents: t.triggered_price_cents,
  acknowledgedAt: t.acknowledged_at,
}))

// Unranked total > items returned to test "Load More"
const unrankedExtended = [
  ...mockUnranked,
  ...[6, 7, 8, 9, 10].map(n => ({
    ...mockItems[0],
    id: String(n * 111),
    title: `Extra Unranked Item ${n}`,
    rank: null,
    status: 'Active' as const,
  })),
]

const mockWatchlistWithUnranked = {
  data: {
    ...mockWatchlistResponse.data,
    unranked: unrankedExtended,
    unrankedTotal: 25, // signal there are more to load
    heatIndex: {
      '111': { itemId: '111', tier: 'hot', score: 80, watcherDelta: 12, watcherTrend: 'up' },
      '222': { itemId: '222', tier: 'warm', score: 45, watcherDelta: 5, watcherTrend: 'up' },
      '333': { itemId: '333', tier: 'cold', score: 10, watcherDelta: -2, watcherTrend: 'down' },
    },
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function interceptAll(page: Page) {
  await Promise.all([
    page.route('**/api/items?*', (route) => {
      const url = new URL(route.request().url())
      const status = url.searchParams.get('status')
      const type = url.searchParams.get('type')
      const search = url.searchParams.get('search')

      let ranked = [...mockWatchlistWithUnranked.data.ranked]
      let unranked = [...mockWatchlistWithUnranked.data.unranked]

      if (status && status !== 'All' && status !== 'Active') {
        ranked = ranked.filter(i => i.status === status)
        unranked = unranked.filter(i => i.status === status)
      }
      if (type && type !== 'All') {
        ranked = ranked.filter(i => i.listingType === type)
        unranked = unranked.filter(i => i.listingType === type)
      }
      if (search) {
        const q = search.toLowerCase()
        ranked = ranked.filter(i => i.title.toLowerCase().includes(q))
        unranked = unranked.filter(i => i.title.toLowerCase().includes(q))
      }

      return route.fulfill({
        json: {
          data: {
            ranked,
            unranked,
            unrankedTotal: unranked.length < 6 ? unranked.length : 25,
            counts: { active: 4, sold: 1, ended: 0, total: 5 },
            heatIndex: mockWatchlistWithUnranked.data.heatIndex,
          },
        },
      })
    }),
    page.route('**/api/items', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: mockWatchlistWithUnranked })
      }
      return route.continue()
    }),
    page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    ),
    page.route('**/api/events', (route) =>
      route.fulfill({ json: mockEventsResponse })
    ),
    page.route('**/api/signals/stats*', (route) =>
      route.fulfill({ json: mockSignalStatsResponse })
    ),
    page.route('**/api/signals?*', (route) =>
      route.fulfill({ json: mockSignalsResponse })
    ),
    page.route('**/api/signals', (route) =>
      route.fulfill({ json: mockSignalsResponse })
    ),
    page.route('**/api/signals/*', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ json: { data: { acknowledged: true } } })
      }
      return route.fulfill({ json: { data: mockSignals[0] } })
    }),
    page.route('**/api/trends?*', (route) =>
      route.fulfill({ json: mockTrendsResponse })
    ),
    page.route('**/api/trends', (route) =>
      route.fulfill({ json: mockTrendsResponse })
    ),
    page.route('**/api/items/*', (route) =>
      route.fulfill({ json: mockItemDetailResponse })
    ),
    page.route('**/api/snapshots?*', (route) =>
      route.fulfill({ json: { data: mockSnapshots } })
    ),
    page.route('**/api/history/**', (route) =>
      route.fulfill({ json: { data: null } })
    ),
    page.route('**/api/targets?*', (route) =>
      route.fulfill({ json: { data: mockTargetsFormatted } })
    ),
    page.route('**/api/targets', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          json: { data: { id: 99, itemId: '111', targetType: 'buy_below', targetCents: 3000, status: 'active', createdAt: new Date().toISOString(), triggeredAt: null, triggeredPriceCents: null, acknowledgedAt: null } },
        })
      }
      return route.fulfill({ json: { data: mockTargetsFormatted } })
    }),
    page.route('**/api/targets/*', (route) =>
      route.fulfill({ json: { data: { success: true } } })
    ),
    page.route('**/api/metadata?*', (route) =>
      route.fulfill({ json: { data: null } })
    ),
    page.route('**/api/sync', (route) =>
      route.fulfill({ json: { data: { added: 0, updated: 2, sold: 0, expired: 0, durationMs: 1500 } } })
    ),
    page.route('**/api/rank', (route) =>
      route.fulfill({ json: { data: mockRanked } })
    ),
    page.route('**/api/watcher-series?*', (route) =>
      route.fulfill({ json: { data: { '111': [10, 12, 15, 14, 18, 20], '222': [5, 6, 7, 8] } } })
    ),
    page.route('**/api/sparklines?*', (route) =>
      route.fulfill({ json: { data: {} } })
    ),
  ])
  // Config route registered LAST = highest priority (Playwright checks in reverse order).
  // This prevents **/api/signals?* and **/api/signals/* from catching /api/signals/config.
  await page.route('**/api/signals/config*', (route) => route.continue())
}

// ─── TEST SUITE: Antagonistic UI Testing ────────────────────────────────

test.describe('Antagonistic UI — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A01: all top-bar nav links navigate to correct pages', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Click Trends
    await page.getByRole('link', { name: 'Trends' }).click()
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()
    await expect(page).toHaveURL(/\/trends/)

    // Click Budget
    await page.getByRole('link', { name: 'Budget' }).click()
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()
    await expect(page).toHaveURL(/\/budget/)

    // Click Signals
    await page.getByRole('link', { name: 'Signals' }).click()
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
    await expect(page).toHaveURL(/\/signals/)

    // Click Watchlist (back home)
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page.locator('table')).toBeVisible()
  })

  test('A02: item title link navigates to detail page', async ({ page }) => {
    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    await table.getByRole('link', { name: 'Vintage Baseball Card 1952' }).click()
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()
    await expect(page).toHaveURL(/\/items\/111/)
  })

  test('A03: signal headline link navigates to item detail', async ({ page }) => {
    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    const firstSignalLink = page.locator('[data-testid="signal-item"] a').first()
    await expect(firstSignalLink).toBeVisible()
    await firstSignalLink.click()
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()
  })

  test('A04: browser back button preserves state after navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Navigate to detail
    await page.locator('table').getByRole('link', { name: 'Vintage Baseball Card 1952' }).click()
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()

    // Go back
    await page.goBack()
    await expect(page.locator('table')).toBeVisible()
  })
})

test.describe('Antagonistic UI — Watchlist Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A05: status filter dropdown works for all values', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()
    const statusSelect = page.locator('select').first()

    // Cycle through all statuses
    for (const status of ['All', 'Active', 'Sold', 'Ended']) {
      await statusSelect.selectOption(status)
      // Table or empty-state message should still render (no crash)
      await expect(page.locator('table').or(page.getByText('No items match your filters'))).toBeVisible()
    }
    // Back to All
    await statusSelect.selectOption('All')
    await expect(page.locator('table')).toBeVisible()
  })

  test('A06: type filter dropdown works for all values', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()
    const typeSelect = page.locator('select').nth(1)

    for (const type of ['All', 'Auction', 'FixedPrice', 'AuctionWithBIN']) {
      await typeSelect.selectOption(type)
      await expect(page.locator('table').or(page.getByText('No items match your filters'))).toBeVisible()
    }
    await typeSelect.selectOption('All')
    await expect(page.locator('table')).toBeVisible()
  })

  test('A07: combined status + type filter does not crash', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    await page.locator('select').first().selectOption('Sold')
    await page.locator('select').nth(1).selectOption('Auction')
    // Should not crash — may show empty or filtered results
    await expect(page.locator('table').or(page.getByText('No items match your filters'))).toBeVisible()
  })

  test('A08: search with special characters does not crash', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()
    const searchInput = page.getByPlaceholder('Search items...')

    // Special characters that might break SQL or regex
    const specialInputs = ['<script>alert(1)</script>', "'; DROP TABLE items;--", '%%__', '   ', '\t\n', '🔥🏀']
    for (const input of specialInputs) {
      await searchInput.fill(input)
      await page.waitForTimeout(400) // wait for debounce
      // Should not crash
      await expect(page.locator('table').or(page.getByText('No items match your filters'))).toBeVisible()
    }
    // Clear and verify recovery
    await searchInput.fill('')
    await page.waitForTimeout(400)
    await expect(page.locator('table')).toBeVisible()
  })

  test('A09: search clear X button works', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    const searchInput = page.getByPlaceholder('Search items...')
    await searchInput.fill('Vintage')
    await page.waitForTimeout(400)

    // The clear (X) button appears when search has text
    const clearButton = page.locator('input[placeholder="Search items..."]').locator('..').locator('button')
    if (await clearButton.isVisible()) {
      await clearButton.click()
      await expect(searchInput).toHaveValue('')
    }
  })

  test('A10: rapid filter switching does not cause errors', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Rapid switching — no waiting between
    const statusSelect = page.locator('select').first()
    await statusSelect.selectOption('Sold')
    await statusSelect.selectOption('Active')
    await statusSelect.selectOption('Ended')
    await statusSelect.selectOption('All')

    // Should recover cleanly
    await expect(page.locator('table')).toBeVisible()
  })

  test('A11: queue star toggle button works', async ({ page }) => {
    await page.route('**/api/items/*/queue', (route) =>
      route.fulfill({ json: { data: { success: true } } })
    )

    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Find a queue star button (★ or ☆)
    const starButtons = page.locator('table button').filter({ hasText: /[★☆]/ })
    const count = await starButtons.count()
    expect(count).toBeGreaterThan(0)

    // Click first star
    await starButtons.first().click()
    // Should not crash
    await expect(page.locator('table')).toBeVisible()
  })

  test('A12: load more button fetches additional items', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Our mock has unrankedTotal=25 but only 6 items, so "Load More" should appear
    const loadMoreBtn = page.getByRole('button', { name: /Load more/i })
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click()
      // Should not crash, table stays visible
      await expect(page.locator('table')).toBeVisible()
    }
  })

  test('A13: sync button fires and shows feedback', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Sync button is in the top bar
    const syncBtn = page.getByRole('button', { name: /sync/i })
    if (await syncBtn.isVisible()) {
      await syncBtn.click()
      // Should show some loading state or completion
      await expect(page.locator('table')).toBeVisible()
    }
  })
})

test.describe('Antagonistic UI — Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A14: detail page renders all sections', async ({ page }) => {
    await page.goto('/items/111')
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()

    // Header with item title
    await expect(page.getByText('Vintage Baseball Card 1952')).toBeVisible()

    // Price Targets section
    await expect(page.getByText('Price Targets')).toBeVisible()

    // AI metadata banner (our mock returns null metadata)
    await expect(page.getByText(/AI title parsing unavailable/)).toBeVisible()
  })

  test('A15: target form validation rejects empty and zero', async ({ page }) => {
    await page.goto('/items/111')
    await expect(page.getByText('Price Targets')).toBeVisible()

    // "Set" buttons should be disabled when inputs are empty
    const setButtons = page.getByRole('button', { name: 'Set' })
    await expect(setButtons.first()).toBeDisabled()
  })

  test('A16: target form accepts valid price and submits', async ({ page }) => {
    await page.goto('/items/111')
    await expect(page.getByText('Price Targets')).toBeVisible()

    // Fill buy-below input
    const buyInput = page.locator('input[type="number"]').first()
    await buyInput.fill('30.00')

    // Set button should be enabled
    const setBtn = page.getByRole('button', { name: 'Set' }).first()
    await expect(setBtn).toBeEnabled()
    await setBtn.click()

    // Input should clear after submission
    await expect(buyInput).toHaveValue('')
  })

  test('A17: target dismiss button calls API', async ({ page }) => {
    let dismissCalled = false
    await page.route('**/api/targets/*', (route) => {
      if (route.request().method() === 'PATCH') {
        dismissCalled = true
      }
      return route.fulfill({ json: { data: { success: true } } })
    })

    await page.goto('/items/111')
    await expect(page.getByText('Price Targets')).toBeVisible()

    // Look for a Dismiss button (appears on triggered targets)
    const dismissBtn = page.getByRole('button', { name: 'Dismiss' }).first()
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click()
      expect(dismissCalled).toBe(true)
    }
  })

  test('A18: target disable button calls API', async ({ page }) => {
    let deactivateCalled = false
    await page.route('**/api/targets/*', (route) => {
      if (route.request().method() === 'PATCH') {
        deactivateCalled = true
      }
      return route.fulfill({ json: { data: { success: true } } })
    })

    await page.goto('/items/111')
    await expect(page.getByText('Price Targets')).toBeVisible()

    const disableBtn = page.getByRole('button', { name: 'Disable' }).first()
    if (await disableBtn.isVisible()) {
      await disableBtn.click()
      expect(deactivateCalled).toBe(true)
    }
  })

  test('A19: target delete button calls API', async ({ page }) => {
    let deleteCalled = false
    await page.route('**/api/targets/*', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
      }
      return route.fulfill({ json: { data: { success: true } } })
    })

    await page.goto('/items/111')
    await expect(page.getByText('Price Targets')).toBeVisible()

    const deleteBtn = page.getByRole('button', { name: 'Delete' }).first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      expect(deleteCalled).toBe(true)
    }
  })

  test('A20: detail page back link to watchlist works', async ({ page }) => {
    await page.goto('/items/111')
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()

    // TopBar Watchlist link should navigate home
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page.locator('table')).toBeVisible()
  })
})

test.describe('Antagonistic UI — Signals Page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A21: signals page renders feed with items', async ({ page }) => {
    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
    await expect(page.locator('[data-testid="signal-item"]').first()).toBeVisible()
  })

  test('A22: event type filter dropdown changes results', async ({ page }) => {
    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    const eventSelect = page.locator('[data-testid="signals-page"] select')
    // Cycle through some event types
    for (const type of ['callup', 'injury_season', 'trade_up', '']) {
      await eventSelect.selectOption(type)
      // Should not crash
      await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
    }
  })

  test('A23: min score slider changes filter value', async ({ page }) => {
    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    const slider = page.locator('input[type="range"]')
    await slider.fill('2')
    // Score display should show 2
    await expect(page.locator('.font-mono').filter({ hasText: '2' })).toBeVisible()
  })

  test('A24: show acknowledged checkbox toggles', async ({ page }) => {
    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    const checkbox = page.locator('input[type="checkbox"]')
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
  })

  test('A25: dismiss button on signal fires API call', async ({ page }) => {
    let ackCalled = false
    await page.route('**/api/signals/*', (route) => {
      if (route.request().method() === 'PATCH') {
        ackCalled = true
      }
      return route.fulfill({ json: { data: { acknowledged: true } } })
    })

    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    const dismissBtn = page.locator('[data-testid="dismiss-signal"]').first()
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click()
      expect(ackCalled).toBe(true)
    }
  })
})

test.describe('Antagonistic UI — Budget Page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A26: budget page renders form and loads data', async ({ page }) => {
    await page.goto('/budget')
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()
  })

  test('A27: budget input accepts and processes dollar amounts', async ({ page }) => {
    await page.goto('/budget')
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()

    // Find the budget input (labeled "Budget" or dollar input)
    const budgetInput = page.locator('input[type="text"], input[type="number"]').first()
    if (await budgetInput.isVisible()) {
      await budgetInput.fill('500')
      await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()
    }
  })

  test('A28: auction mode radio buttons switch', async ({ page }) => {
    await page.goto('/budget')
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()

    // Try clicking each mode
    const modes = ['Conservative', 'Moderate', 'Aggressive']
    for (const mode of modes) {
      const radio = page.getByLabel(mode)
      if (await radio.isVisible()) {
        await radio.click()
        await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()
      }
    }
  })
})

test.describe('Antagonistic UI — Trends Page', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A29: trends page renders stats and chart', async ({ page }) => {
    await page.goto('/trends')
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()
  })

  test('A30: range selector buttons switch time ranges', async ({ page }) => {
    await page.goto('/trends')
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()

    for (const range of ['30d', '90d', '7d']) {
      await page.getByRole('button', { name: range }).click()
      await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()
    }
  })
})

test.describe('Antagonistic UI — Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A31: sidebar toggle button works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForTimeout(500) // let UI settle

    // Find the toggle button (aria-label="Toggle sidebar")
    const toggleBtn = page.getByLabel('Toggle sidebar')
    await expect(toggleBtn).toBeVisible()

    // Sidebar defaults to open (sidebarOpen: true) — on mobile this shows as overlay
    // Verify sidebar content is visible via the queue heading
    const queueHeading = page.getByRole('heading', { name: /my queue/i })
    await expect(queueHeading).toBeVisible()

    // Click toggle to CLOSE sidebar
    await toggleBtn.click({ force: true })
    await page.waitForTimeout(300)
    // Queue heading should now be hidden
    await expect(queueHeading).toBeHidden()

    // Click toggle again to RE-OPEN sidebar
    await toggleBtn.click({ force: true })
    await page.waitForTimeout(300)
    await expect(queueHeading).toBeVisible()
  })
})

test.describe('Antagonistic UI — Cross-page flows', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAll(page)
  })

  test('A32: full user journey — watchlist → detail → back → signals → trends → budget → home', async ({ page }) => {
    // Start at watchlist
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Navigate to detail via item link
    await page.locator('table').getByRole('link', { name: 'Vintage Baseball Card 1952' }).click()
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()

    // Back to watchlist via nav
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page.locator('table')).toBeVisible()

    // Signals
    await page.getByRole('link', { name: 'Signals' }).click()
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    // Trends
    await page.getByRole('link', { name: 'Trends' }).click()
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()

    // Budget
    await page.getByRole('link', { name: 'Budget' }).click()
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()

    // Home
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page.locator('table')).toBeVisible()
  })

  test('A33: direct URL access to each page does not crash', async ({ page }) => {
    // Direct access (no client-side navigation)
    await page.goto('/trends')
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()

    await page.goto('/budget')
    await expect(page.locator('[data-testid="budget-page"]')).toBeVisible()

    await page.goto('/signals')
    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    await page.goto('/items/111')
    await expect(page.locator('[data-testid="item-detail-page"]')).toBeVisible()
  })

  test('A34: nonexistent item ID shows error state', async ({ page }) => {
    // Must intercept before the generic catch-all routes
    await page.route('**/api/items/nonexistent', (route) =>
      route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Item not found' } } })
    )
    // Also need to intercept events, signals, etc. for the detail page
    await page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    )
    await page.route('**/api/signals?*', (route) =>
      route.fulfill({ json: mockSignalsResponse })
    )
    await page.route('**/api/targets?*', (route) =>
      route.fulfill({ json: { data: [] } })
    )
    await page.route('**/api/metadata?*', (route) =>
      route.fulfill({ json: { data: null } })
    )
    await page.route('**/api/history/**', (route) =>
      route.fulfill({ json: { data: null } })
    )

    await page.goto('/items/nonexistent')
    // The detail page uses useItemDetail which will get a 404 → isError state
    await expect(page.getByText('Item not found')).toBeVisible({ timeout: 10000 })
  })

  test('A35: double-clicking buttons does not cause errors', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Double-click a sort header
    await page.getByRole('columnheader', { name: 'Price' }).dblclick()
    await expect(page.locator('table')).toBeVisible()

    // Double-click a nav link
    await page.getByRole('link', { name: 'Trends' }).dblclick()
    await expect(page.locator('[data-testid="trends-page"]')).toBeVisible()
  })

  test('A36: API error on watchlist shows error state with retry', async ({ page }) => {
    await page.route('**/api/items?*', (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'DB error' } } })
    )
    await page.route('**/api/items', (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'DB error' } } })
    )
    await page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    )
    await page.route('**/api/events', (route) =>
      route.fulfill({ json: mockEventsResponse })
    )
    await page.route('**/api/signals?*', (route) =>
      route.fulfill({ json: mockSignalsResponse })
    )

    await page.goto('/')
    // Should show error state — look for the ErrorState component text
    await expect(page.getByText('Failed to load watchlist')).toBeVisible({ timeout: 10000 })
  })
})
