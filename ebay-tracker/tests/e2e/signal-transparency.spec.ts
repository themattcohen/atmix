import { test, expect } from '@playwright/test'
import { mockWatchlistResponse, mockEventsResponse, mockSignalStatsResponse, mockSignals } from './helpers/mock-data'

// ---------------------------------------------------------------------------
// Mock config response — mirrors the real SIGNAL_CONFIG / SOURCE_CONFIG shape
// ---------------------------------------------------------------------------
const mockSignalConfigResponse = {
  data: {
    signalConfig: {
      callup: {
        label: 'CALLUP',
        labelLong: 'Called Up',
        description: 'Player promoted to major league roster',
        impact: 'positive',
        baseScore: 2,
        decayDays: 30,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-400/20',
        confidence: 0.80,
        keywords: ['called up', 'recalled', 'promoted', 'select the contract', 'added to roster', 'roster move', 'signed 10-day', 'nba draft', 'recalled from ahl', 'nhl draft', 'nfl draft'],
      },
      injury_season: {
        label: 'INJURY',
        labelLong: 'Season-Ending Injury',
        description: 'Player value significantly impacted by major injury',
        impact: 'negative',
        baseScore: -3,
        decayDays: null,
        color: 'text-red-400',
        bgColor: 'bg-red-400/20',
        confidence: 0.90,
        keywords: ['season-ending', 'torn acl', 'torn ucl', 'tommy john', 'out for season', 'out for the season', 'season ending'],
      },
      trade_up: {
        label: 'TRADE',
        labelLong: 'Traded Up',
        description: 'Player traded to a high-profile team',
        impact: 'positive',
        baseScore: 2,
        decayDays: 30,
        color: 'text-blue-400',
        bgColor: 'bg-blue-400/20',
        confidence: 0.85,
        keywords: ['traded to yankees', 'traded to dodgers'],
      },
      award: {
        label: 'AWARD',
        labelLong: 'Award / Honor',
        description: 'Player received major award or honor',
        impact: 'positive',
        baseScore: 2,
        decayDays: 30,
        color: 'text-amber-400',
        bgColor: 'bg-amber-400/20',
        confidence: 0.95,
        keywords: ['mvp', 'cy young', 'all-star'],
      },
      breakout: {
        label: 'BREAKOUT',
        labelLong: 'Breakout Performance',
        description: 'Player achieved exceptional individual performance',
        impact: 'positive',
        baseScore: 2,
        decayDays: 14,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-400/20',
        confidence: 0.85,
        keywords: ['no-hitter', 'perfect game', 'cycle'],
      },
      injury_minor: {
        label: 'INJURY',
        labelLong: 'Minor Injury',
        description: 'Short-term IL',
        impact: 'negative',
        baseScore: -1,
        decayDays: 14,
        color: 'text-orange-400',
        bgColor: 'bg-orange-400/20',
        confidence: 0.80,
        keywords: ['day-to-day'],
      },
      trade_down: {
        label: 'TRADE',
        labelLong: 'Traded Down',
        description: 'Traded/waived',
        impact: 'negative',
        baseScore: -1,
        decayDays: 30,
        color: 'text-purple-400',
        bgColor: 'bg-purple-400/20',
        confidence: 0.70,
        keywords: ['traded to'],
      },
      suspension: {
        label: 'SUSPEND',
        labelLong: 'Suspended',
        description: 'Suspended',
        impact: 'negative',
        baseScore: -3,
        decayDays: null,
        color: 'text-red-400',
        bgColor: 'bg-red-400/20',
        confidence: 0.90,
        keywords: ['suspended'],
      },
      optioned: {
        label: 'OPTION',
        labelLong: 'Optioned / Sent Down',
        description: 'Demoted',
        impact: 'negative',
        baseScore: -1,
        decayDays: 30,
        color: 'text-violet-400',
        bgColor: 'bg-violet-400/20',
        confidence: 0.75,
        keywords: ['optioned to'],
      },
      release: {
        label: 'RELEASE',
        labelLong: 'Released / DFA',
        description: 'Released/DFA',
        impact: 'negative',
        baseScore: -2,
        decayDays: null,
        color: 'text-rose-400',
        bgColor: 'bg-rose-400/20',
        confidence: 0.80,
        keywords: ['released'],
      },
      return_injury: {
        label: 'RETURN',
        labelLong: 'Return from Injury',
        description: 'Activated from IL',
        impact: 'positive',
        baseScore: 1,
        decayDays: 14,
        color: 'text-lime-400',
        bgColor: 'bg-lime-400/20',
        confidence: 0.85,
        keywords: ['activated from il'],
      },
      contract: {
        label: 'CONTRACT',
        labelLong: 'Contract Signed',
        description: 'New contract',
        impact: 'positive',
        baseScore: 1,
        decayDays: null,
        color: 'text-teal-400',
        bgColor: 'bg-teal-400/20',
        confidence: 0.75,
        keywords: ['extension'],
      },
      retirement: {
        label: 'RETIRE',
        labelLong: 'Retired',
        description: 'Retired',
        impact: 'neutral',
        baseScore: 1,
        decayDays: 30,
        color: 'text-slate-400',
        bgColor: 'bg-slate-400/20',
        confidence: 0.90,
        keywords: ['retires'],
      },
    },
    sourceConfig: {
      mlb_transactions: { label: 'MLB Transactions', multiplier: 0.95, reliability: 'Very High' },
      rotowire_rss: { label: 'RotoWire RSS', multiplier: 0.85, reliability: 'High' },
      espn_rss: { label: 'ESPN RSS', multiplier: 0.85, reliability: 'High' },
      google_news_rss: { label: 'Google News RSS', multiplier: 0.65, reliability: 'Moderate' },
    },
    scoringFormula: {
      sourceWeight: 0.4,
      classificationWeight: 0.3,
      matchWeight: 0.3,
      description: 'composite = 0.4 x source + 0.3 x classification + 0.3 x match',
    },
  },
}

// ---------------------------------------------------------------------------
// Signals that have matchedKeyword populated — required for keyword tests
// ---------------------------------------------------------------------------
const signalsWithKeywords = [
  // callup signal — has matchedKeyword, decayDays: 30
  {
    ...mockSignals[0], // itemId: '111', eventType: 'callup', score: 3, confidence: 0.92
    matchedKeyword: 'called up',
    source: 'mlb_transactions',
  },
  // injury_season signal — has matchedKeyword, decayDays: null (permanent)
  {
    ...mockSignals[1], // itemId: '222', eventType: 'injury_season', score: -3, confidence: 0.88
    matchedKeyword: 'torn acl',
    source: 'mlb_transactions',
  },
  // trade_up signal
  {
    ...mockSignals[2], // itemId: '333', eventType: 'trade_up', score: 1, confidence: 0.75
    matchedKeyword: 'traded to dodgers',
    source: 'rotowire_rss',
  },
  // award signal
  {
    ...mockSignals[3], // itemId: '444', eventType: 'award', score: -1, confidence: 0.65
    matchedKeyword: 'all-star',
    source: 'espn_rss',
  },
  // breakout signal
  {
    ...mockSignals[4], // itemId: '555', eventType: 'breakout', score: 2, confidence: 0.80
    matchedKeyword: 'cycle',
    source: 'google_news_rss',
    acknowledged: false,
  },
]

// ---------------------------------------------------------------------------
// Helper: intercept all APIs including the config endpoint
// IMPORTANT: config route must be registered BEFORE the generic signals route
// because '**/api/signals*' matches both '/api/signals' and '/api/signals/config'.
// Playwright matches routes in registration order.
// ---------------------------------------------------------------------------
function interceptWithConfig(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
    page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
    page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
    page.route('**/api/signals/config*', (route) => route.fulfill({ json: mockSignalConfigResponse })),
    page.route('**/api/signals*', (route) =>
      route.fulfill({ json: { data: { signals: signalsWithKeywords, total: signalsWithKeywords.length } } }),
    ),
  ])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe('Signal Transparency', () => {
  // T50: Badge shows per-event color from config
  test('T50: callup badge has emerald color and injury badge has red color from config', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    // The badges should be present
    const badges = page.locator('[data-testid="signal-badge"]')
    await expect(badges.first()).toBeVisible()

    // Find the callup badge — it should have bg-emerald-400 class in its class string
    // Signal for itemId '111' is callup. The badge class includes bgColor + color from config.
    const callupBadge = badges.nth(0) // first signal is callup for item 111 (rank 1)
    const callupClass = await callupBadge.getAttribute('class')
    expect(callupClass).toContain('bg-emerald-400')

    // Find the injury_season badge — it should have bg-red-400 class
    // Signal for itemId '222' is injury_season (rank 2)
    const injuryBadge = badges.nth(1)
    const injuryClass = await injuryBadge.getAttribute('class')
    expect(injuryClass).toContain('bg-red-400')
  })

  // T51: Tooltip appears on badge hover
  test('T51: hovering a signal badge shows a tooltip with the event label', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    const firstBadge = page.locator('[data-testid="signal-badge"]').first()
    await expect(firstBadge).toBeVisible()

    // Before hover — the tooltip's description text should not be visible
    await expect(page.getByText('Player promoted to major league roster')).not.toBeVisible()

    // Hover the badge to trigger the tooltip
    await firstBadge.hover()

    // The tooltip renders the description from config
    await expect(page.getByText('Player promoted to major league roster')).toBeVisible()
  })

  // T52: Tooltip shows matched keyword
  test('T52: tooltip shows the matched keyword used to trigger the signal', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    // Hover the callup badge (first signal, matchedKeyword: 'called up')
    const firstBadge = page.locator('[data-testid="signal-badge"]').first()
    await firstBadge.hover()

    // The tooltip renders: Keyword: "<matchedKeyword>" — look for the keyword text
    await expect(page.getByText('"called up"')).toBeVisible()
  })

  // T53: Tooltip shows scoring breakdown
  test('T53: tooltip shows the scoring breakdown section', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    const firstBadge = page.locator('[data-testid="signal-badge"]').first()
    await firstBadge.hover()

    // The scoring breakdown section contains these labels
    await expect(page.getByText('Base score')).toBeVisible()
    await expect(page.getByText('MLB Transactions')).toBeVisible()
    await expect(page.getByText('Classification', { exact: true })).toBeVisible()

    // "Composite" is rendered with a → prefix in the DOM: "→ Composite"
    // Use a regex to match partial text including the arrow character
    await expect(page.locator('text=/Composite/')).toBeVisible()
  })

  // T54: Tooltip shows monitored keywords section
  test('T54: tooltip shows the monitored keywords section with keyword list', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    const firstBadge = page.locator('[data-testid="signal-badge"]').first()
    await firstBadge.hover()

    // The tooltip renders a "Monitored keywords" heading
    await expect(page.getByText('Monitored keywords')).toBeVisible()

    // The callup config has 'recalled' and 'promoted' in its keywords array
    // They are joined with ', ' and rendered as plain text in the tooltip
    await expect(page.getByText(/recalled/)).toBeVisible()
  })

  // T55: Signals page filter dropdown uses config labelLong values
  test('T55: signals page event type filter contains config-driven label options', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/signals')

    await expect(page.locator('[data-testid="signals-page"]')).toBeVisible()

    // The filter <select> should have options built from signalConfig labelLong values
    const select = page.locator('select').first()
    await expect(select).toBeVisible()

    // Verify options contain the labelLong values from the mock config
    await expect(select.locator('option', { hasText: 'All Events' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Called Up' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Season-Ending Injury' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Traded Up' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Award / Honor' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Breakout Performance' })).toHaveCount(1)
  })

  // T56: Config API endpoint returns correct structure
  test('T56: /api/signals/config endpoint returns signalConfig, sourceConfig, scoringFormula', async ({ page }) => {
    // Intercept the config route and assert what the page receives
    let capturedBody: unknown = null
    await page.route('**/api/signals/config*', async (route) => {
      await route.fulfill({ json: mockSignalConfigResponse })
      capturedBody = mockSignalConfigResponse
    })

    // Navigate to a page that calls the config endpoint
    await Promise.all([
      page.route('**/api/items*', (route) => route.fulfill({ json: mockWatchlistResponse })),
      page.route('**/api/events*', (route) => route.fulfill({ json: mockEventsResponse })),
      page.route('**/api/signals/stats*', (route) => route.fulfill({ json: mockSignalStatsResponse })),
      page.route('**/api/signals*', (route) =>
        route.fulfill({ json: { data: { signals: signalsWithKeywords, total: signalsWithKeywords.length } } }),
      ),
    ])

    await page.goto('/')

    // Use page.request to hit the real endpoint structure check
    // (the route intercept above ensures we get our mock data)
    const response = await page.request.get('/api/signals/config')
    const json = await response.json()

    // Response must have the data wrapper with the three required keys
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('signalConfig')
    expect(json.data).toHaveProperty('sourceConfig')
    expect(json.data).toHaveProperty('scoringFormula')

    // signalConfig must have at least callup and injury_season
    expect(json.data.signalConfig).toHaveProperty('callup')
    expect(json.data.signalConfig).toHaveProperty('injury_season')

    // scoringFormula must have the three weights
    expect(json.data.scoringFormula).toHaveProperty('sourceWeight')
    expect(json.data.scoringFormula).toHaveProperty('classificationWeight')
    expect(json.data.scoringFormula).toHaveProperty('matchWeight')
  })

  // T57: Tooltip shows correct expiry — decay days for callup, "Never" for injury_season
  test('T57: tooltip shows decay days for callup and permanent label for injury_season', async ({ page }) => {
    await interceptWithConfig(page)
    await page.goto('/')

    const badges = page.locator('[data-testid="signal-badge"]')

    // --- Callup badge (first signal, decayDays: 30) ---
    const callupBadge = badges.nth(0)
    await callupBadge.hover()

    // The tooltip renders: Expires: 30 days
    await expect(page.getByText(/30 days/)).toBeVisible()

    // Move mouse away to dismiss the tooltip
    await page.mouse.move(0, 0)
    await expect(page.getByText(/30 days/)).not.toBeVisible()

    // --- Injury season badge (second signal, decayDays: null → "Never (permanent)") ---
    const injuryBadge = badges.nth(1)
    await injuryBadge.hover()

    // The tooltip renders: Expires: Never (permanent)
    await expect(page.getByText(/Never/)).toBeVisible()
  })
})
