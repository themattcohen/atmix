import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockSignalsResponse, mockSignalStatsResponse } from './helpers/mock-data'

function interceptApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals/config*', (route) => route.continue()),
    page.route('**/api/signals*', (route) => route.fulfill({ json: mockSignalsResponse })),
  ])
}

test.describe('Signal Navigation', () => {
  // T39: Signals link visible in top bar
  test('T39: Signals link visible in top bar', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalsNavLink = page.getByRole('link', { name: /signals/i })
    await expect(signalsNavLink).toBeVisible()
  })

  // T40: clicking Signals nav link navigates to /signals
  test('T40: clicking Signals nav link navigates to /signals', async ({ page }) => {
    await interceptApis(page)
    await page.goto('/')

    const signalsNavLink = page.getByRole('link', { name: /signals/i })
    await expect(signalsNavLink).toBeVisible()

    await signalsNavLink.click()

    await expect(page).toHaveURL(/\/signals$/)

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()
  })
})
