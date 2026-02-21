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
  ])
}

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApis(page)
  })

  // T14: Event feed displays items
  test('T14: activity feed shows events in sidebar', async ({ page }) => {
    // Desktop viewport so sidebar is visible
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')

    // Activity section should show events — use .first() since sidebar renders in desktop + mobile
    await expect(page.getByRole('heading', { name: 'Activity' }).first()).toBeVisible()

    // Check event types in the activity feed (scoped to first list which is in the visible desktop sidebar)
    const activityList = page.getByRole('list').first()
    await expect(activityList.getByText('Sold')).toBeVisible()
    await expect(activityList.getByText('Price drop')).toBeVisible()
    await expect(activityList.getByText('Watcher spike')).toBeVisible()
  })

  // T20: Sidebar collapses on mobile
  test('T20: sidebar hidden on mobile, toggle reveals it', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // sidebarOpen defaults to true — mobile overlay is visible with Activity heading
    await expect(page.getByRole('heading', { name: 'Activity' }).first()).toBeVisible()

    // Close sidebar by clicking the backdrop overlay on the left side
    // (sidebar panel is 320px from right, leaving ~55px of backdrop on left)
    await page.locator('.bg-black\\/50').click({ position: { x: 20, y: 300 } })

    // After closing, Activity heading should not be visible on mobile
    await expect(page.getByRole('heading', { name: 'Activity' }).first()).toBeHidden()

    // Click toggle button to reopen
    await page.getByLabel('Toggle sidebar').click()

    // Mobile overlay sidebar should reappear with Activity heading
    await expect(page.getByRole('heading', { name: 'Activity' }).first()).toBeVisible()
  })
})
