import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockSignalsResponse, mockSignalStatsResponse, mockSignals } from './helpers/mock-data'

function interceptApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals/config*', (route) => route.continue()),
    page.route('**/api/signals*', (route) => route.fulfill({ json: mockSignalsResponse })),
  ])
}

test.describe('Signal Sidebar', () => {
  // T36: summary section visible in sidebar
  test('T36: summary section visible in sidebar', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalSummary = page.locator('[data-testid="signal-summary"]')
    await expect(signalSummary).toBeVisible()
  })

  // T37: unacknowledged count badge shows correct number
  test('T37: unacknowledged count badge shows correct number', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalSummary = page.locator('[data-testid="signal-summary"]')
    await expect(signalSummary).toBeVisible()

    // The count badge has bg-accent class (per spec)
    const countBadge = signalSummary.locator('span.bg-accent, [data-testid="unacknowledged-count"]')
    await expect(countBadge.first()).toBeVisible()
    await expect(countBadge.first()).toContainText('4')
  })

  // T38: preview items and "View all" link
  test('T38: preview items and "View all" link', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalSummary = page.locator('[data-testid="signal-summary"]')
    await expect(signalSummary).toBeVisible()

    // Up to 3 signal headline previews should be visible in the summary
    const previewItems = signalSummary.locator('[data-testid="signal-preview-item"]')
    await expect(previewItems.first()).toBeVisible()
    const count = await previewItems.count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)

    // "View all" link should be visible and point to /signals
    const viewAllLink = signalSummary.getByRole('link', { name: /view all/i })
    await expect(viewAllLink).toBeVisible()

    const href = await viewAllLink.getAttribute('href')
    expect(href).toBe('/signals')
  })
})
