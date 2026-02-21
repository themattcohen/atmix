import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse } from './helpers/mock-data'

test.describe('Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/items?*', (route) =>
      route.fulfill({ json: mockWatchlistResponse })
    )
    await page.route('**/api/items', (route) =>
      route.fulfill({ json: mockWatchlistResponse })
    )
    await page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    )
  })

  // T15: Sync button shows loading and refreshes data
  test('T15: sync button shows loading state', async ({ page }) => {
    // Delay the sync response to observe loading state
    await page.route('**/api/sync', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({
        json: { data: { added: 1, updated: 3, sold: 0, expired: 0, durationMs: 1234 } },
      })
    })

    await page.goto('/')

    // Find and click the sync button
    const syncButton = page.getByRole('button', { name: /Sync/i })
    await expect(syncButton).toBeVisible()
    await syncButton.click()

    // Button should show loading state (spinner appears, button disabled)
    await expect(syncButton).toBeDisabled()

    // Wait for sync to complete
    await expect(syncButton).toBeEnabled({ timeout: 3000 })
  })
})
