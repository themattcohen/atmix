import { test, expect } from '@playwright/test'
import { mockTrendsResponse, mockEventsResponse } from './helpers/mock-data'

test.describe('Trends Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/trends?*', (route) =>
      route.fulfill({ json: mockTrendsResponse })
    ),
    await page.route('**/api/events?*', (route) =>
      route.fulfill({ json: mockEventsResponse })
    )
  })

  // T13: Trends page renders stats and charts
  test('T13: trends page renders stats cards and portfolio chart', async ({ page }) => {
    await page.goto('/trends')

    await expect(page.getByTestId('trends-page')).toBeVisible()

    // Stat cards should be visible
    await expect(page.getByTestId('portfolio-stats')).toBeVisible()
    const statCards = page.getByTestId('stats-card')
    await expect(statCards.first()).toBeVisible()
    expect(await statCards.count()).toBeGreaterThanOrEqual(6)

    // Portfolio chart should be visible
    await expect(page.getByTestId('portfolio-chart')).toBeVisible()

    // Movers table should be visible
    await expect(page.getByTestId('movers-table')).toBeVisible()

    // Range selector buttons
    await expect(page.getByText('7d')).toBeVisible()
    await expect(page.getByText('30d')).toBeVisible()
    await expect(page.getByText('90d')).toBeVisible()
  })
})
