import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockItemDetailResponse, mockSignalsResponse, mockSignalStatsResponse, mockSignals } from './helpers/mock-data'

function interceptBaseApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
  ])
}

function interceptItemDetailApis(page: import('@playwright/test').Page, signals: typeof mockSignals = mockSignals) {
  const itemSignals = signals.filter((s) => s.itemId === '111')
  const itemSignalResponse = { data: { signals: itemSignals, total: itemSignals.length } }

  return Promise.all([
    page.route('**/api/items/111*', (route) => route.fulfill({ json: mockItemDetailResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals*', (route) => route.fulfill({ json: itemSignalResponse })),
  ])
}

test.describe('Signal Chart', () => {
  // T33: reference lines appear on price chart when signals exist
  test('T33: reference lines appear on price chart when signals exist', async ({ page }) => {
    await interceptBaseApis(page)
    await interceptItemDetailApis(page)

    await page.goto('/items/111')

    const priceChart = page.locator('[data-testid="price-chart"]')
    await expect(priceChart).toBeVisible({ timeout: 10000 })

    // ReferenceLine elements render as <line> SVG elements inside the chart
    const svgLines = priceChart.locator('svg line')
    const lineCount = await svgLines.count()
    expect(lineCount).toBeGreaterThan(0)
  })

  // T34: positive signal line is green
  test('T34: positive signal line is green', async ({ page }) => {
    const positiveSignals = mockSignals.filter((s) => s.score > 0)

    await interceptBaseApis(page)
    await Promise.all([
      page.route('**/api/items/111*', (route) => route.fulfill({ json: mockItemDetailResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) => {
        const itemSignals = positiveSignals.filter((s) => s.itemId === '111')
        route.fulfill({ json: { data: { signals: itemSignals, total: itemSignals.length } } })
      }),
    ])

    await page.goto('/items/111')

    const priceChart = page.locator('[data-testid="price-chart"]')
    await expect(priceChart).toBeVisible({ timeout: 10000 })

    // Green reference lines use stroke color #3fb950
    const greenLine = priceChart.locator('svg line[stroke="#3fb950"]')
    await expect(greenLine.first()).toBeAttached()
  })

  // T35: negative signal line is red
  test('T35: negative signal line is red', async ({ page }) => {
    const negativeSignal = {
      ...mockSignals[1],
      itemId: '111',
    }

    await interceptBaseApis(page)
    await Promise.all([
      page.route('**/api/items/111*', (route) => route.fulfill({ json: mockItemDetailResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) => {
        route.fulfill({ json: { data: { signals: [negativeSignal], total: 1 } } })
      }),
    ])

    await page.goto('/items/111')

    const priceChart = page.locator('[data-testid="price-chart"]')
    await expect(priceChart).toBeVisible({ timeout: 10000 })

    // Red reference lines use stroke color #f85149
    const redLine = priceChart.locator('svg line[stroke="#f85149"]')
    await expect(redLine.first()).toBeAttached()
  })
})
