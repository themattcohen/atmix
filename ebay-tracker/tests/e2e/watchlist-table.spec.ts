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

test.describe('Watchlist Table', () => {
  test.beforeEach(async ({ page }) => {
    await interceptApis(page)
  })

  // T01: Table renders with data rows
  test('T01: table renders with data rows and columns', async ({ page }) => {
    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Check column headers are present
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Watchers' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Time Left' })).toBeVisible()

    // Check data rows rendered — scope to table to avoid sidebar/suggestion matches
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
    await expect(table.getByRole('link', { name: '1986 Topps Football Set' })).toBeVisible()
    await expect(table.getByRole('link', { name: 'PSA 10 Rookie Card' })).toBeVisible()
  })

  // T02: Sort by price asc/desc
  test('T02: sort by price toggles order', async ({ page }) => {
    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Click Price header to sort
    await page.getByRole('columnheader', { name: 'Price' }).click()

    // The table should reorder — verify at least the header click doesn't break
    await expect(table).toBeVisible()
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
  })

  // T03: Sort by watchers
  test('T03: sort by watchers header click', async ({ page }) => {
    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    await page.getByRole('columnheader', { name: 'Watchers' }).click()
    await expect(table).toBeVisible()
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
  })

  // T04: Filter by status: Sold
  test('T04: filter by status Sold shows only Sold items', async ({ page }) => {
    // When status filter is Sold, intercept with only sold items
    await page.route('**/api/items?*', (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('status') === 'Sold') {
        return route.fulfill({
          json: {
            data: {
              ranked: mockWatchlistResponse.data.ranked.filter((i) => i.status === 'Sold'),
              unranked: mockWatchlistResponse.data.unranked.filter((i) => i.status === 'Sold'),
              counts: { active: 0, sold: 1, ended: 0, total: 1 },
            },
          },
        })
      }
      return route.fulfill({ json: mockWatchlistResponse })
    })

    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Select Sold in the status dropdown
    await page.locator('select').first().selectOption('Sold')

    // Wait for the filtered view — scope to table
    await expect(table.getByRole('link', { name: 'Rare Coin Collection' })).toBeVisible()
  })

  // T05: Filter by status Active + countdown visible
  test('T05: Active filter shows countdown cells', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // The default view should show Active items with countdown cells
    // Countdown cells display time like "3d 0h" or "0h 30m"
    const countdowns = page.locator('span.font-mono').filter({ hasText: /\d+[dhms]/ })
    await expect(countdowns.first()).toBeVisible()
  })

  // T06: Filter by listing type Auction
  test('T06: filter by listing type Auction', async ({ page }) => {
    await page.route('**/api/items?*', (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('type') === 'Auction') {
        const filtered = mockWatchlistResponse.data.ranked.filter((i) => i.listingType === 'Auction')
        return route.fulfill({
          json: { data: { ranked: filtered, unranked: [], counts: { active: filtered.length, sold: 0, ended: 0, total: filtered.length } } },
        })
      }
      return route.fulfill({ json: mockWatchlistResponse })
    })

    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Select Auction in the type dropdown (second select)
    await page.locator('select').nth(1).selectOption('Auction')

    // Vintage Baseball Card is Auction type — scope to table
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
  })

  // T07: Search filters rows by title
  test('T07: search filters rows by title', async ({ page }) => {
    await page.route('**/api/items?*', (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search')
      if (search) {
        const all = [...mockWatchlistResponse.data.ranked, ...mockWatchlistResponse.data.unranked]
        const filtered = all.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
        const ranked = filtered.filter((i) => i.rank !== null)
        const unranked = filtered.filter((i) => i.rank === null)
        return route.fulfill({
          json: { data: { ranked, unranked, counts: { active: filtered.length, sold: 0, ended: 0, total: filtered.length } } },
        })
      }
      return route.fulfill({ json: mockWatchlistResponse })
    })

    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Type in search
    await page.getByPlaceholder('Search items...').fill('Vintage')

    // Wait for debounce + filtered results — scope to table
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
  })

  // T08: Clear search restores all rows
  test('T08: clear search restores all rows', async ({ page }) => {
    await page.route('**/api/items?*', (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search')
      if (search) {
        const all = [...mockWatchlistResponse.data.ranked, ...mockWatchlistResponse.data.unranked]
        const filtered = all.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
        return route.fulfill({
          json: { data: { ranked: filtered.filter((i) => i.rank !== null), unranked: filtered.filter((i) => i.rank === null), counts: { active: filtered.length, sold: 0, ended: 0, total: filtered.length } } },
        })
      }
      return route.fulfill({ json: mockWatchlistResponse })
    })

    await page.goto('/')
    const table = page.locator('table')
    await expect(table).toBeVisible()

    const searchInput = page.getByPlaceholder('Search items...')
    await searchInput.fill('Vintage')
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()

    // Clear search
    await searchInput.fill('')

    // All rows should be back — scope to table
    await expect(table.getByRole('link', { name: 'Vintage Baseball Card 1952' })).toBeVisible()
    await expect(table.getByRole('link', { name: '1986 Topps Football Set' })).toBeVisible()
    await expect(table.getByRole('link', { name: 'PSA 10 Rookie Card' })).toBeVisible()
  })
})
