import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockSignalsResponse, mockSignalStatsResponse, mockSignals } from './helpers/mock-data'

function interceptApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals*', (route) => route.fulfill({ json: mockSignalsResponse })),
  ])
}

test.describe('Signal Badge', () => {
  // T22: badge renders on watchlist row when signal exists
  test('T22: badge renders on watchlist row when signal exists', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalHeader = page.getByRole('columnheader', { name: /signal/i })
    await expect(signalHeader).toBeVisible()

    const badges = page.locator('[data-testid="signal-badge"]')
    await expect(badges.first()).toBeVisible()
    expect(await badges.count()).toBeGreaterThanOrEqual(1)
  })

  // T23: positive score shows green styling
  test('T23: positive score shows green styling', async ({ page }) => {
    const positiveSignals = mockSignals.filter((s) => s.score > 0)
    const customResponse = {
      data: {
        signals: positiveSignals,
        total: positiveSignals.length,
      },
    }

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) => route.fulfill({ json: customResponse })),
    ])

    await page.goto('/')

    const badge = page.locator('[data-testid="signal-badge"]').first()
    await expect(badge).toBeVisible()

    const text = await badge.textContent()
    expect(text).toMatch(/\+[123]/)

    const className = await badge.getAttribute('class')
    expect(className).toContain('text-status-active')
  })

  // T24: negative score shows red styling
  test('T24: negative score shows red styling', async ({ page }) => {
    const negativeSignals = mockSignals.filter((s) => s.score < 0)
    const customResponse = {
      data: {
        signals: negativeSignals,
        total: negativeSignals.length,
      },
    }

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) => route.fulfill({ json: customResponse })),
    ])

    await page.goto('/')

    const badge = page.locator('[data-testid="signal-badge"]').first()
    await expect(badge).toBeVisible()

    const text = await badge.textContent()
    expect(text).toMatch(/-[13]/)

    const className = await badge.getAttribute('class')
    expect(className).toContain('text-status-sold')
  })

  // T25: no badge when no signals for item
  test('T25: no badge when no signals for item', async ({ page }) => {
    const emptySignalsResponse = { data: { signals: [], total: 0 } }

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) => route.fulfill({ json: emptySignalsResponse })),
    ])

    await page.goto('/')

    const badges = page.locator('[data-testid="signal-badge"]')
    expect(await badges.count()).toBe(0)

    const signalCells = page.locator('td[data-col="signal"]')
    const count = await signalCells.count()
    for (let i = 0; i < count; i++) {
      await expect(signalCells.nth(i)).toContainText('—')
    }
  })
})
