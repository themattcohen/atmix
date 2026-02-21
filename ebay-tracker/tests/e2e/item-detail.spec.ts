import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockItemDetailResponse } from './helpers/mock-data'

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
    page.route('**/api/items/111', (route) =>
      route.fulfill({ json: mockItemDetailResponse })
    ),
  ])
}

test.describe('Item Detail', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApis(page)
  })

  // T11: Click title navigates to detail page
  test('T11: click title navigates to item detail', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Click on item title link in the table — use role to avoid strict mode violation
    await page.locator('table').getByRole('link', { name: 'Vintage Baseball Card 1952' }).click()

    // Should navigate to /items/111
    await expect(page).toHaveURL(/\/items\/111/)
  })

  // T12: Detail page renders charts
  test('T12: detail page renders price and watcher charts', async ({ page }) => {
    await page.goto('/items/111')

    // Wait for the detail page to load
    await expect(page.getByTestId('item-detail-page')).toBeVisible()

    // Verify charts are rendered
    await expect(page.getByTestId('price-chart')).toBeVisible()
    await expect(page.getByTestId('watcher-chart')).toBeVisible()

    // Verify header section — on detail page there's only one instance
    await expect(page.getByTestId('item-detail-page').getByText('Vintage Baseball Card 1952')).toBeVisible()
  })
})
