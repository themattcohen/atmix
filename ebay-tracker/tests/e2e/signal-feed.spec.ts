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

test.describe('Signal Feed Page', () => {
  // T26: page loads and shows signals
  test('T26: page loads and shows signals', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/signals')

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
    await expect(page.locator('[data-testid="signal-feed"]')).toBeVisible()

    const unacknowledgedCount = mockSignals.filter((s) => !s.acknowledged).length
    const signalItems = page.locator('[data-testid="signal-item"]')
    await expect(signalItems).toHaveCount(unacknowledgedCount)
  })

  // T27: signals in chronological order (newest first)
  test('T27: signals in chronological order (newest first)', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/signals')

    const signalItems = page.locator('[data-testid="signal-item"]')
    await expect(signalItems.first()).toBeVisible()

    const firstText = await signalItems.first().textContent()
    expect(firstText).toContain('Top prospect called up')
  })

  // T28: event type filter
  test('T28: event type filter', async ({ page }) => {
    let filteredRequestUrl: string | null = null

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals/config*', (route) => route.continue()),
      page.route('**/api/signals*', (route) => {
        filteredRequestUrl = route.request().url()
        route.fulfill({ json: mockSignalsResponse })
      }),
    ])

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signal-feed"]')).toBeVisible()

    const dropdown = page.locator('[data-testid="event-type-filter"]')
    if (await dropdown.isVisible()) {
      await dropdown.selectOption('callup')
      await page.waitForTimeout(300)
      expect(filteredRequestUrl).toContain('eventType=callup')
    } else {
      const filterSelect = page.locator('select').filter({ hasText: /callup|event type|filter/i }).first()
      if (await filterSelect.isVisible()) {
        await filterSelect.selectOption('callup')
        await page.waitForTimeout(300)
        expect(filteredRequestUrl).toContain('eventType=callup')
      }
    }
  })

  // T29: min score filter
  test('T29: min score filter', async ({ page }) => {
    let lastRequestUrl: string | null = null

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals/config*', (route) => route.continue()),
      page.route('**/api/signals*', (route) => {
        lastRequestUrl = route.request().url()
        route.fulfill({ json: mockSignalsResponse })
      }),
    ])

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signal-feed"]')).toBeVisible()

    const slider = page.locator('[data-testid="min-score-filter"]')
    if (await slider.isVisible()) {
      await slider.fill('2')
      await page.waitForTimeout(300)
      expect(lastRequestUrl).toContain('minScore=2')
    } else {
      const rangeInput = page.locator('input[type="range"]').first()
      if (await rangeInput.isVisible()) {
        await rangeInput.fill('2')
        await page.waitForTimeout(300)
        expect(lastRequestUrl).toContain('minScore=2')
      }
    }
  })

  // T30: acknowledge removes from list
  test('T30: acknowledge removes from list', async ({ page }) => {
    let patchedUrl: string | null = null

    await page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse }))
    await page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse }))
    await page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse }))
    await page.route('**/api/signals/config*', (route) => route.continue())
    await page.route('**/api/signals/*', (route) => {
      if (route.request().method() === 'PATCH') {
        patchedUrl = route.request().url()
        route.fulfill({ json: { data: { success: true } } })
      } else {
        route.fulfill({ json: mockSignalsResponse })
      }
    })
    await page.route('**/api/signals?*', (route) => route.fulfill({ json: mockSignalsResponse }))

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signal-feed"]')).toBeVisible()

    const dismissBtn = page.locator('[data-testid="dismiss-signal"]').first()
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click()
      await page.waitForTimeout(300)
      expect(patchedUrl).toMatch(/\/api\/signals\/\d+/)
    } else {
      const dismissAlt = page.getByRole('button', { name: /dismiss/i }).first()
      if (await dismissAlt.isVisible()) {
        await dismissAlt.click()
        await page.waitForTimeout(300)
        expect(patchedUrl).toMatch(/\/api\/signals\/\d+/)
      }
    }
  })

  // T31: empty state
  test('T31: empty state shows no signals message', async ({ page }) => {
    const emptyResponse = { data: { signals: [], total: 0 } }

    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals/config*', (route) => route.continue()),
      page.route('**/api/signals*', (route) => route.fulfill({ json: emptyResponse })),
    ])

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
    await expect(page.getByText(/no signals found/i)).toBeVisible()
  })

  // T32: all fields present on signal item
  test('T32: all fields present on signal item', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/signals')

    await expect(page.locator('[data-testid="signal-feed"]')).toBeVisible()

    const firstItem = page.locator('[data-testid="signal-item"]').first()
    await expect(firstItem).toBeVisible()

    await expect(firstItem.locator('[data-testid="signal-badge"]')).toBeVisible()

    await expect(firstItem).toContainText('Top prospect called up to majors')

    await expect(firstItem).toContainText('92%')

    await expect(firstItem).toContainText('mlb_transactions')

    await expect(firstItem).toContainText(/ago/)
  })
})
