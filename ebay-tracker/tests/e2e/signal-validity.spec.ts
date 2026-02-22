import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockSignalsResponse, mockSignalStatsResponse, mockSignals } from './helpers/mock-data'

function makeCustomSignalsResponse(signals: typeof mockSignals) {
  return { data: { signals, total: signals.length } }
}

function interceptWithSignals(page: import('@playwright/test').Page, signals: typeof mockSignals) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals*', (route) => route.fulfill({ json: makeCustomSignalsResponse(signals) })),
  ])
}

const baseSignal: (typeof mockSignals)[0] = {
  id: 99,
  newsItemId: 1,
  itemId: '111',
  playerId: 1,
  eventType: 'callup',
  score: 0,
  confidence: 0.85,
  headline: 'Test signal headline',
  source: 'mlb_transactions',
  sourceUrl: null,
  acknowledged: false,
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
}

test.describe('Signal Validity', () => {
  // T41: score +3 shows success variant (green class text-status-active)
  test('T41: score +3 shows green text-status-active class', async ({ page }) => {
    const signal: (typeof mockSignals)[0] = { ...baseSignal, score: 3 }
    await interceptWithSignals(page, [signal])
    await page.goto('/')

    const badge = page.locator('[data-testid="signal-badge"]').first()
    await expect(badge).toBeVisible()

    const className = await badge.getAttribute('class')
    expect(className).toContain('text-status-active')
  })

  // T42: score -3 shows danger variant (red class text-status-sold)
  test('T42: score -3 shows red text-status-sold class', async ({ page }) => {
    const signal: (typeof mockSignals)[0] = { ...baseSignal, score: -3 }
    await interceptWithSignals(page, [signal])
    await page.goto('/')

    const badge = page.locator('[data-testid="signal-badge"]').first()
    await expect(badge).toBeVisible()

    const className = await badge.getAttribute('class')
    expect(className).toContain('text-status-sold')
  })

  // T43: score 0 shows default variant (gray class text-text-secondary)
  test('T43: score 0 shows gray text-text-secondary class', async ({ page }) => {
    const signal: (typeof mockSignals)[0] = { ...baseSignal, score: 0 }
    await interceptWithSignals(page, [signal])
    await page.goto('/')

    const badge = page.locator('[data-testid="signal-badge"]').first()
    await expect(badge).toBeVisible()

    const className = await badge.getAttribute('class')
    expect(className).toContain('text-text-secondary')
  })

  // T44: confidence 0.85 displays "85%"
  test('T44: confidence 0.85 displays "85%"', async ({ page }) => {
    const signal: (typeof mockSignals)[0] = { ...baseSignal, confidence: 0.85, score: 2 }
    await interceptWithSignals(page, [signal])

    await Promise.all([
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    ])

    await page.goto('/signals')

    const signalItem = page.locator('[data-testid="signal-item"]').first()
    await expect(signalItem).toBeVisible()
    await expect(signalItem).toContainText('85%')
  })

  // T45: timestamp 2 hours ago displays "2h ago"
  test('T45: timestamp 2 hours ago displays "2h ago"', async ({ page }) => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const signal: (typeof mockSignals)[0] = { ...baseSignal, createdAt: twoHoursAgo, score: 2 }
    await interceptWithSignals(page, [signal])

    await page.goto('/signals')

    const signalItem = page.locator('[data-testid="signal-item"]').first()
    await expect(signalItem).toBeVisible()
    await expect(signalItem).toContainText('2h ago')
  })

  // T46: multiple signals for same item → watchlist row shows only most recent
  test('T46: multiple signals for same item shows only most recent badge', async ({ page }) => {
    const olderSignal: (typeof mockSignals)[0] = {
      ...baseSignal,
      score: 1,
      headline: 'Older signal',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    }
    const newerSignal: (typeof mockSignals)[0] = {
      ...baseSignal,
      score: 3,
      headline: 'Newer signal',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    }

    await interceptWithSignals(page, [olderSignal, newerSignal])
    await page.goto('/')

    // Only 1 badge should appear for item '111' (both signals belong to same item)
    const rowBadges = page.locator(`tr[data-item-id="111"] [data-testid="signal-badge"], [data-testid="watchlist-row"][data-item-id="111"] [data-testid="signal-badge"]`)
    const count = await rowBadges.count()
    expect(count).toBeLessThanOrEqual(1)

    // The badge shown should reflect the most recent signal (score +3)
    if (count === 1) {
      const text = await rowBadges.first().textContent()
      expect(text).toContain('+3')
    }
  })

  // T47: pagination total count displays correctly
  test('T47: pagination total count displays correctly', async ({ page }) => {
    await interceptWithSignals(page, mockSignals)

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    // Expect total count text like "5 total signals" or "Showing X of 5"
    await expect(page.getByText(/5.*signal/i)).toBeVisible()
  })

  // T48: acknowledged signal excluded from unacknowledged count + no dismiss button
  test('T48: acknowledged signal excluded, no dismiss button shown', async ({ page }) => {
    // mockSignals has 1 acknowledged signal (id:5, item:555)
    // Stats show 4 unacknowledged (not 5)
    await interceptWithSignals(page, mockSignals)

    await page.goto('/signals')

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    // By default the feed hides acknowledged signals - only 4 should appear
    const unacknowledgedSignals = mockSignals.filter((s) => !s.acknowledged)
    const signalItems = page.locator('[data-testid="signal-item"]')
    await expect(signalItems).toHaveCount(unacknowledgedSignals.length)

    // Stats badge should show 4, not 5
    const statsBadge = page.locator('[data-testid="signal-summary"] span.bg-accent, [data-testid="unacknowledged-count"]')
    if (await statsBadge.first().isVisible()) {
      await expect(statsBadge.first()).toContainText('4')
    }

    // Verify the acknowledged signal's headline does not appear
    await expect(page.getByText('Player hits for the cycle')).not.toBeVisible()
  })
})
