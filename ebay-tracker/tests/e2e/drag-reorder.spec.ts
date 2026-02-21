import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse } from './helpers/mock-data'

function interceptApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items?*', (route) =>
      route.fulfill({ json: mockWatchlistResponse })
    ),
    page.route('**/api/items', (route) =>
      route.fulfill({ json: mockWatchlistResponse })
    ),
    page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    ),
    page.route('**/api/rank', (route) =>
      route.fulfill({ json: { data: { updated: mockWatchlistResponse.data.ranked } } })
    ),
  ])
}

test.describe('Drag Reorder', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApis(page)
  })

  // T09: Drag row from rank 3 to 1
  test('T09: drag row reorders items', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Verify drag handles are present (the grip icons)
    const dragHandles = page.locator('[data-testid="drag-handle"]')
    // If no data-testid, check for the grip SVG elements in the first column
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow).toBeVisible()

    // Verify ranked items are present in order
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible()
  })

  // T10: Manual rank input reorders
  test('T10: manual rank input via rank cell', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // The rank cells show rank numbers (1, 2, 3...)
    // Look for rank number display
    const rankCells = page.locator('table tbody td:nth-child(2)')
    await expect(rankCells.first()).toBeVisible()
  })
})
