# eBay Tracker — Systematic App Review Prompt

**Version**: 1.0
**Intended audience**: QA subagent with browser access (chrome-devtools MCP or Playwright MCP)
**Purpose**: Comprehensive, reusable QA checklist for every route and interactive element in the eBay Tracker app

---

## Setup Instructions

### Prerequisites
- The app must be running locally or on Hetzner before starting review
- Local dev: `npm run dev` in `ebay-tracker/` — default port is 3005
- Production: `https://5-78-147-79.sslip.io`

### Base URL
Set `BASE_URL` to the target environment. All route paths in this document are relative to it.

```
Local:      http://localhost:3005
Production: https://5-78-147-79.sslip.io
```

### Authentication
The app has no user login. Access all routes directly.

### Before You Begin
1. Open the app in a browser (or navigate via MCP tool)
2. Confirm the TopBar is visible with the logo "eBay Watchlist" and nav links
3. Note whether the sidebar is open or closed by default
4. Open browser DevTools console and note any errors before testing

---

## Findings Table

Use this table to record findings during the review. Copy it and fill in the Actual and Status columns.

| Page | Element / Behavior | Expected | Actual | Status |
|------|-------------------|----------|--------|--------|
| | | | | |

**Status values**: PASS / FAIL / PARTIAL / SKIP (not applicable)

---

## Section 1 — Global Layout (All Pages)

These checks apply on every route before testing route-specific elements.

### 1.1 TopBar

Navigate to each route in turn and verify:

| # | Element | Expected Behavior |
|---|---------|------------------|
| 1.1.1 | Logo text "eBay Watchlist" | Visible in top-left on all pages |
| 1.1.2 | Nav link: Watchlist | Present; clicking navigates to `/` |
| 1.1.3 | Nav link: Trends | Present; clicking navigates to `/trends` |
| 1.1.4 | Nav link: Budget | Present; clicking navigates to `/budget` |
| 1.1.5 | Nav link: Signals | Present; clicking navigates to `/signals` |
| 1.1.6 | Nav link: News | Present; clicking navigates to `/news` |
| 1.1.7 | Active link highlight | Current page link has accent background; others are muted |
| 1.1.8 | Sync button | Visible in top-right; clicking triggers a data sync (button shows loading state) |
| 1.1.9 | Hamburger/sidebar toggle button | Visible in top-right; toggles sidebar open/closed |
| 1.1.10 | TopBar sticky positioning | TopBar remains visible when scrolling content below |

### 1.2 Sidebar (AppShell pages)

The sidebar appears on pages that use AppShell: `/`, `/budget`, `/signals`, `/news`, `/items/[id]`. It does NOT appear on `/trends`.

| # | Element | Expected Behavior |
|---|---------|------------------|
| 1.2.1 | Sidebar default state | Open by default on desktop (>= 1024px) |
| 1.2.2 | Sidebar width | Approximately 320px wide when open |
| 1.2.3 | Sidebar toggle (hamburger) | Clicking the TopBar hamburger opens/closes sidebar |
| 1.2.4 | QueuePanel section | Visible at top of sidebar; shows starred/queued items |
| 1.2.5 | SignalSummary section | Visible in sidebar; shows count of recent signals |
| 1.2.6 | ActivityFeed section | Visible at bottom of sidebar; shows recent sync events |
| 1.2.7 | Sidebar dividers | Thin borders separate the three sidebar sections |
| 1.2.8 | Sidebar scroll | Sidebar scrolls independently when content overflows |

### 1.3 Mobile Layout (viewport <= 1023px)

Resize browser to 768px wide or use DevTools device emulation.

| # | Element | Expected Behavior |
|---|---------|------------------|
| 1.3.1 | Sidebar on mobile | Sidebar hidden by default; opens as overlay when hamburger clicked |
| 1.3.2 | Overlay backdrop | Dark semi-transparent overlay behind sidebar; clicking it closes sidebar |
| 1.3.3 | TopBar nav links | Still visible and functional at mobile width |
| 1.3.4 | FilterBar wraps | Filter controls wrap to additional lines without overflow at 768px |

### 1.4 PageExplainer

Each AppShell page shows a grey explanatory text strip. Verify it:

| # | Check |
|---|-------|
| 1.4.1 | Renders on Watchlist, Budget, Signals, News, Item Detail pages |
| 1.4.2 | Does not render on Trends (no AppShell on Trends) |
| 1.4.3 | Text is readable (not clipped, not overflowing) |

---

## Section 2 — Route: `/` (Watchlist)

### 2.1 FilterBar

Located below the TopBar, above the table.

| # | Element | Expected Behavior |
|---|---------|------------------|
| 2.1.1 | Search input | Visible; typing filters table rows within ~300ms |
| 2.1.2 | Search clear button | Appears when input is non-empty; clicking clears search |
| 2.1.3 | Status dropdown | Values: "All Status", Active, Sold, Ended, Relisted |
| 2.1.4 | Status filter | Selecting "Active" shows only active items |
| 2.1.5 | Type dropdown | Values: "All Types", Auction, "Buy It Now", "Auction + BIN" |
| 2.1.6 | Type filter | Selecting "Auction" shows only auction items |
| 2.1.7 | Column toggle button | Opens dropdown of column checkboxes |
| 2.1.8 | Column toggle — hide column | Unchecking a column removes that column from the table |
| 2.1.9 | Column toggle — restore column | Re-checking a column restores it to the table |
| 2.1.10 | Column toggle — close on outside click | Clicking outside the dropdown closes it |
| 2.1.11 | Filter persistence | Filters survive a page refresh (stored in Zustand persist) |

### 2.2 SuggestionCarousel

Horizontal row of cards above the FilterBar showing time-sensitive items.

| # | Element | Expected Behavior |
|---|---------|------------------|
| 2.2.1 | Carousel renders | Visible above filter bar when there are active items |
| 2.2.2 | Ending soon cards | Shows up to 5 active items sorted by soonest end time |
| 2.2.3 | Price drop / watcher spike cards | Shown when recent events exist |
| 2.2.4 | Card click navigates | Clicking a suggestion card navigates to `/items/[id]` |

### 2.3 Watchlist Table — Headers and Sort

| # | Element | Expected Behavior |
|---|---------|------------------|
| 2.3.1 | Column headers visible | Drag handle col, Rank (#), Image, Title, Price, Delta, Watchers, Bids, Time Left, Status, Signal, Queue star |
| 2.3.2 | Price column sort | Clicking "Price" header sorts ascending; clicking again sorts descending; arrow indicator changes |
| 2.3.3 | Watchers sort | Clicking "Watchers" sorts ascending/descending |
| 2.3.4 | Bids sort | Clicking "Bids" sorts ascending/descending |
| 2.3.5 | Time Left sort | Clicking "Time Left" sorts ascending/descending |
| 2.3.6 | Status sort | Clicking "Status" sorts alphabetically |
| 2.3.7 | Sort arrow indicator | Active sort column shows up (↑) or down (↓) arrow; inactive columns show bidirectional (↕) |
| 2.3.8 | Column resize | Dragging the right edge of a resizable column header changes its width |

### 2.4 Watchlist Table — Ranked Rows

| # | Element | Expected Behavior |
|---|---------|------------------|
| 2.4.1 | Ranked section renders | Items with a rank number appear at the top of the table |
| 2.4.2 | Rank numbers visible | Each ranked row shows its rank in the # column |
| 2.4.3 | Item thumbnail image | Image column shows a small thumbnail for each item |
| 2.4.4 | Item title as link | Clicking the title navigates to `/items/[id]` |
| 2.4.5 | Price displayed | Formatted dollar amount (e.g. "$45.00") in Price column |
| 2.4.6 | Delta badge | Shows % price change; green for price drop, red for price increase |
| 2.4.7 | Watcher count | Number shown in Watchers column |
| 2.4.8 | Bid count | Number shown in Bids column (0 for non-auction items) |
| 2.4.9 | Time left countdown | Shows countdown for active listings (e.g. "2h 14m") |
| 2.4.10 | Status badge | Shows "Active", "Sold", "Ended", or "Relisted" with appropriate color |
| 2.4.11 | Signal badge | Shows signal badge (event type label + score) if an unacknowledged signal exists |
| 2.4.12 | Queue star | Star icon in final column; clicking toggles item in/out of buy queue |
| 2.4.13 | Drag handle | Grip icon in leftmost column; visible on ranked rows |
| 2.4.14 | Drag to reorder | Dragging a ranked row by its handle reorders the list; new rank persists after release |
| 2.4.15 | Sparkline in price cell | Mini price chart rendered in Price column for ranked items |

### 2.5 Watchlist Table — Unranked Section

| # | Element | Expected Behavior |
|---|---------|------------------|
| 2.5.1 | Unranked section divider | Grey header row labeled "Unranked (N items)" separates ranked from unranked |
| 2.5.2 | Unranked rows render | Unranked items appear below the divider |
| 2.5.3 | Load more button | Appears when more unranked items exist beyond the current page |
| 2.5.4 | Load more action | Clicking loads additional unranked items and appends them |
| 2.5.5 | Drag unranked to ranked | Dragging an unranked row to the ranked section promotes it (assigned rank at end of ranked list) |
| 2.5.6 | Drag overlay ghost | During drag, a ghost "pill" shows the item's price and title |

### 2.6 Loading, Error, and Empty States

| # | State | Expected |
|---|-------|----------|
| 2.6.1 | Loading state | Skeleton rows shown (8 animated grey bars) while data loads |
| 2.6.2 | Error state | "Failed to load watchlist" message with a retry button |
| 2.6.3 | Empty (no items) | "No items in watchlist" or equivalent empty state message |
| 2.6.4 | Empty (filtered) | Different message indicating no items match the current filters |

---

## Section 3 — Route: `/budget` (Budget Optimizer)

### 3.1 Budget Form

| # | Element | Expected Behavior |
|---|---------|------------------|
| 3.1.1 | Form renders | "Budget Optimizer" heading and form visible on page load |
| 3.1.2 | Budget dollar input | Text input accepts numeric values (e.g. "500", "$500", "1,000") |
| 3.1.3 | Invalid budget error | Non-numeric or zero values show inline error: "Enter a valid dollar amount" or "Budget must be greater than zero" |
| 3.1.4 | Conservative radio | Selectable; label shows "Conservative — 1.5x current price" |
| 3.1.5 | Moderate radio | Selectable; label shows "Moderate — 1.25x current price" |
| 3.1.6 | Aggressive radio | Selectable; label shows "Aggressive — 1.1x current price" |
| 3.1.7 | Radio selected state | Selected option has accent border and text; others are muted |
| 3.1.8 | Auction mode note | Explanatory text below radio group: "Auction mode adjusts estimated final price for Auction-type listings only..." |

### 3.2 Budget Results (after entering a valid budget)

| # | Element | Expected Behavior |
|---|---------|------------------|
| 3.2.1 | Loading skeleton | 4 skeleton cards and a skeleton table shown while results load |
| 3.2.2 | BudgetSummary stats | Summary grid shows totals (e.g. picked items count, total estimated cost, remaining budget) |
| 3.2.3 | BudgetResults table | Table of picked items with rank, title, current price, estimated cost, and score columns |
| 3.2.4 | Excluded items | Items excluded from picks are listed below with exclusion reason |
| 3.2.5 | Item title link | Title in results table links to `/items/[id]` |
| 3.2.6 | ScoreBreakdown | Hovering over a score shows breakdown tooltip (urgency, price, competition factors) |

### 3.3 No Ranked Items State

| # | State | Expected |
|---|-------|----------|
| 3.3.1 | No ranked items | Centered message: "No ranked items to optimize" with description and "Go to Watchlist" link |
| 3.3.2 | Go to Watchlist link | Navigates to `/` |

### 3.4 Error State

| # | State | Expected |
|---|-------|----------|
| 3.4.1 | API error | "Failed to load watchlist data" error state with retry button |

---

## Section 4 — Route: `/signals` (Player Signals)

### 4.1 Page Header

| # | Element | Expected Behavior |
|---|---------|------------------|
| 4.1.1 | "Player Signals" heading | Visible at top of content area |
| 4.1.2 | Stats row | Shows "N today" and "N unread" counts when signal stats are loaded |

### 4.2 Filters

| # | Element | Expected Behavior |
|---|---------|------------------|
| 4.2.1 | Event type dropdown | "All Events" plus one option per known event type (e.g. Trade, Callup, Injury, Award, etc.) |
| 4.2.2 | Event type filter | Selecting an event type shows only signals of that type |
| 4.2.3 | Min score slider | Range 0–3; dragging filters signals with score below threshold |
| 4.2.4 | Min score display | Numeric label to the right of slider shows current value |
| 4.2.5 | Show acknowledged checkbox | Unchecked by default; checking it includes already-dismissed signals |

### 4.3 Signal Feed

| # | Element | Expected Behavior |
|---|---------|------------------|
| 4.3.1 | Signal count | "N total signals" text above the feed |
| 4.3.2 | Signal row renders | Each signal shows: badge, headline text, confidence %, source, time-ago |
| 4.3.3 | Signal badge | Colored label showing event type (e.g. "Trade", "Injury") |
| 4.3.4 | Confidence tooltip | Hovering "conf N%" label shows tooltip: "Signal confidence score — higher means more reliable" |
| 4.3.5 | Source link | Source name is a hyperlink if sourceUrl exists; opens in new tab |
| 4.3.6 | Headline link | Clicking the headline navigates to `/items/[id]` for the matched card |
| 4.3.7 | Dismiss button | "Dismiss" button on unacknowledged signals; clicking sends acknowledgement |
| 4.3.8 | Acknowledged state | Dismissed signals appear at 50% opacity when "Show acknowledged" is checked |
| 4.3.9 | Dismiss loading state | Button is disabled and shows pending state during mutation |

### 4.4 Empty and Error States

| # | State | Expected |
|---|-------|----------|
| 4.4.1 | No signals (no filters) | "No signals yet" with explanation and "View news pipeline →" link |
| 4.4.2 | No signals (filtered) | "No signals match your current filters" with hint to lower score or select All Events |
| 4.4.3 | Error | "Failed to load signals" with retry button |
| 4.4.4 | Loading | "Loading signals..." text |
| 4.4.5 | "View news pipeline" link | Navigates to `/news` |

---

## Section 5 — Route: `/news` (News Pipeline)

### 5.1 Page Header

| # | Element | Expected Behavior |
|---|---------|------------------|
| 5.1.1 | "News Pipeline" heading | Visible at top of content area |
| 5.1.2 | Total items count | "N items" label in top-right |

### 5.2 Filters and Column Toggle

| # | Element | Expected Behavior |
|---|---------|------------------|
| 5.2.1 | Source dropdown | "All Sources" + RotoWire, MLB Transactions, Google News, ESPN, CBS Sports, RotoBaller |
| 5.2.2 | Source filter | Selecting a source filters table to that source only |
| 5.2.3 | Status dropdown | "All Statuses" + Matched, AI Fallback, No Match, Pending |
| 5.2.4 | Status filter | Selecting a status filters to that processing status |
| 5.2.5 | Player search input | Typing filters rows by player name (300ms debounce) |
| 5.2.6 | Columns button | Opens dropdown of column visibility toggles |
| 5.2.7 | Column toggle — all columns | Toggle each of: Time, Source, Headline, Status, Method, Players, Conf%, Event, Score, Keyword, Decay, Sig# |
| 5.2.8 | Column persistence | Column visibility choices persist across page reloads |
| 5.2.9 | Columns close on outside click | Clicking outside dropdown closes it |

### 5.3 News Table

| # | Element | Expected Behavior |
|---|---------|------------------|
| 5.3.1 | Table renders | Tabular layout with column headers |
| 5.3.2 | Time column | Relative time string (e.g. "2h ago"); hovering shows exact timestamp tooltip |
| 5.3.3 | Source badge | Colored pill (e.g. green "RotoWire", blue "MLB", red "ESPN") |
| 5.3.4 | Headline text | Truncated to one line; links to external article URL when available (new tab) |
| 5.3.5 | Status badge | Shows "Matched", "AI Fallback", "No Match", or "Pending" with color coding |
| 5.3.6 | Method column | Shows extraction method (e.g. "keyword", "ai") or dash |
| 5.3.7 | Players column | Player names with confidence percentage; dash when no match |
| 5.3.8 | Conf% column | Green >= 80%, amber >= 65%, red < 65%; dash when no match |
| 5.3.9 | Event column | Colored event type badge (e.g. "Trade", "Injury") when a signal was generated |
| 5.3.10 | Score column | +/- numeric score; green for positive, red for negative; dash when none |
| 5.3.11 | Keyword column | Matched keyword text; dash when none |
| 5.3.12 | Decay column | "14d", "30d", or "perm"; dash when no signal; "Decay" header has tooltip explaining meaning |
| 5.3.13 | Sig# column | Count of signals generated by this headline; shown in amber when > 0 |
| 5.3.14 | Column resize | Dragging right edge of any column header resizes it |

### 5.4 Sortable Columns

| # | Column | Expected Sort Behavior |
|---|--------|----------------------|
| 5.4.1 | Time | Clicking toggles asc/desc; arrow indicator appears on active column |
| 5.4.2 | Source | Clicking sorts alphabetically by source |
| 5.4.3 | Status | Clicking sorts alphabetically by status |
| 5.4.4 | Players | Clicking sorts by mention count |
| 5.4.5 | Sig# | Clicking sorts by signal count |

### 5.5 Pagination

| # | Element | Expected Behavior |
|---|---------|------------------|
| 5.5.1 | Pagination visible | Shown when total > 50 items |
| 5.5.2 | Previous button | Disabled on first page; enabled after advancing; navigates back one page |
| 5.5.3 | Next button | Enabled when more pages exist; disabled on last page |
| 5.5.4 | Page range label | Shows "1–50 of N" style counter between buttons |
| 5.5.5 | Filter resets offset | Changing any filter resets to page 1 |

### 5.6 Empty and Error States

| # | State | Expected |
|---|-------|----------|
| 5.6.1 | No headlines (no filters) | "No headlines yet" with description of the news pipeline |
| 5.6.2 | No headlines (filtered) | "No headlines match your filters" with suggestion to clear filters |
| 5.6.3 | Error | "Failed to load news" with retry button |
| 5.6.4 | Loading | 8 pulsing skeleton rows |

---

## Section 6 — Route: `/trends` (Market Trends)

Note: `/trends` does NOT use AppShell and has no sidebar.

### 6.1 Range Selector

| # | Element | Expected Behavior |
|---|---------|------------------|
| 6.1.1 | Range selector visible | Three buttons: "7d", "30d", "90d" |
| 6.1.2 | Default range | "7d" selected by default |
| 6.1.3 | Range switching | Clicking a different range re-fetches data and updates all charts/stats |
| 6.1.4 | Active range highlight | Selected range button has accent background; others are muted |

### 6.2 Portfolio Stats

| # | Element | Expected Behavior |
|---|---------|------------------|
| 6.2.1 | Stats grid renders | Grid of stat cards (active listings, total value, avg price, etc.) |
| 6.2.2 | Stat values populated | Numbers shown, not empty or "NaN" |
| 6.2.3 | Responsive grid | 2 cols on mobile, 3 on tablet, 6 on desktop |

### 6.3 Portfolio Chart

| # | Element | Expected Behavior |
|---|---------|------------------|
| 6.3.1 | Chart renders | Line chart showing total tracked value over time |
| 6.3.2 | Chart updates on range change | Data series changes when a different range is selected |
| 6.3.3 | Empty chart state | If insufficient syncs, chart shows graceful empty state (not an error) |

### 6.4 Movers Table

| # | Element | Expected Behavior |
|---|---------|------------------|
| 6.4.1 | Price drops table | Lists items with biggest price drops in selected range |
| 6.4.2 | Watcher gains table | Lists items with biggest watcher count increases |
| 6.4.3 | Item title link | Clicking a mover row title navigates to `/items/[id]` |

### 6.5 Loading and Error States

| # | State | Expected |
|---|-------|----------|
| 6.5.1 | Loading | 6 skeleton cards + 2 skeleton chart blocks |
| 6.5.2 | Error | "Failed to load trends" with retry button |

---

## Section 7 — Route: `/items/[id]` (Item Detail)

To test this route, click any item title from the watchlist.

### 7.1 Item Header

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.1.1 | Item header renders | Shows item title, current price, status badge, and "View on eBay" link |
| 7.1.2 | "View on eBay" link | Opens eBay listing in a new tab |
| 7.1.3 | Status badge | Shows current status (Active, Sold, etc.) |

### 7.2 Target Form

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.2.1 | Target form renders | "Buy Below" and "Sell Above" inputs visible |
| 7.2.2 | Buy below input | Accepts dollar value; auto-saves on blur |
| 7.2.3 | Sell above input | Accepts dollar value; auto-saves on blur |
| 7.2.4 | Target save feedback | Input saves without requiring a submit button; no error on valid input |

### 7.3 Stats Grid

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.3.1 | Stats grid renders | Grid of 10 stat cards (price, watchers, bids, time left, etc.) |
| 7.3.2 | Values populated | No empty or "undefined" cells for available data |

### 7.4 Price Chart

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.4.1 | Price chart renders | Line chart showing price history over snapshots |
| 7.4.2 | Signal overlays | Signal events appear as vertical markers on the chart when signals exist |
| 7.4.3 | Chart empty state | Graceful handling when only one snapshot exists |

### 7.5 Watcher Chart

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.5.1 | Watcher chart renders | Line chart showing watcher count over time |
| 7.5.2 | Chart updates with price chart | Same snapshot timeline as price chart |

### 7.6 OHLC Chart

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.6.1 | OHLC chart renders | Candlestick/OHLC chart for historical price data |
| 7.6.2 | Empty state | If no nightly rollup data yet, shows a graceful empty state message |

### 7.7 Historical Summary (all-time stats)

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.7.1 | Summary grid renders | 4 cards: All-Time High, All-Time Low, Avg Price, Snapshots |
| 7.7.2 | Trend label | "Snapshots" card includes a "Trend: up/down/flat" label |
| 7.7.3 | Renders only when data available | Cards absent when `historySummary` is null |

### 7.8 AI Metadata

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.8.1 | Metadata unavailable notice | If `ANTHROPIC_API_KEY` not set, a notice appears: "AI title parsing unavailable" |
| 7.8.2 | Metadata present | If available, card metadata from AI is shown (player, sport, card type, etc.) |

### 7.9 Item Events

| # | Element | Expected Behavior |
|---|---------|------------------|
| 7.9.1 | Events list renders | List of timeline events (price drops, watcher spikes, status changes) |
| 7.9.2 | Event types labeled | Each event has an appropriate label and timestamp |
| 7.9.3 | Empty state | Graceful "No events" message when no events exist |

### 7.10 Loading, Error, and Not Found States

| # | State | Expected |
|---|-------|----------|
| 7.10.1 | Loading | Multiple skeleton blocks covering header, form, stats, charts |
| 7.10.2 | Item not found | Warning icon, "Item not found" message, and "Back to watchlist" link |
| 7.10.3 | Back to watchlist link | Navigates to `/` |

---

## Section 8 — Cross-Page Navigation Tests

Run these as end-to-end flows to verify routing and data connections between pages.

| # | Flow | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Watchlist → Item Detail | On `/`, click any item title | Navigates to `/items/[id]`; item data matches the clicked card |
| 8.2 | Item Detail → Back | On `/items/[id]`, click browser back | Returns to `/` with filters preserved |
| 8.3 | Suggestion card → Item Detail | Click a card in the SuggestionCarousel | Navigates to the correct item detail page |
| 8.4 | Signal headline → Item Detail | On `/signals`, click any signal headline | Navigates to `/items/[id]` for the matched card |
| 8.5 | Budget → Watchlist | On `/budget` with no ranked items, click "Go to Watchlist" | Navigates to `/` |
| 8.6 | Budget results → Item Detail | On `/budget` with results, click an item title in the results table | Navigates to `/items/[id]` |
| 8.7 | Signals empty → News | On `/signals` with no signals, click "View news pipeline →" | Navigates to `/news` |
| 8.8 | Trends movers → Item Detail | On `/trends`, click an item in the movers table | Navigates to `/items/[id]` |
| 8.9 | Nav link active state | Click each TopBar nav link in sequence | Active link shows accent highlight; previous link returns to inactive style |
| 8.10 | Sidebar does not appear on `/trends` | Navigate to `/trends` | No sidebar, no hamburger toggle effect; full-width layout |

---

## Section 9 — Regression Checks After Code Changes

Run these targeted checks after any of the following types of code changes.

### 9.1 After changes to `top-bar.tsx` or `app-shell.tsx`

- [ ] Hamburger toggle opens and closes sidebar on all AppShell pages
- [ ] TopBar nav links still navigate correctly
- [ ] Active link highlight updates correctly on navigation
- [ ] Sidebar content (QueuePanel, SignalSummary, ActivityFeed) still renders
- [ ] Mobile overlay behavior still works at 768px

### 9.2 After changes to `filter-bar.tsx` or `watchlist-store.ts`

- [ ] Search input still debounces and filters correctly
- [ ] Status and type dropdowns still have correct options
- [ ] Column toggle still shows/hides columns correctly
- [ ] Filters persist across page reload
- [ ] "Load more" still works after filter changes

### 9.3 After changes to `watchlist-table.tsx` or `watchlist-row.tsx`

- [ ] Sort headers toggle asc/desc correctly
- [ ] Sort arrow indicators update correctly
- [ ] Drag-to-reorder still works for ranked rows
- [ ] Unranked row drag-to-promote still works
- [ ] Drag overlay ghost still appears during drag
- [ ] Sparklines still render in ranked price cells
- [ ] Signal badge still appears on cards with signals
- [ ] Queue star still toggles correctly

### 9.4 After changes to `budget-form.tsx` or `use-budget.ts`

- [ ] Budget input accepts numbers with $, commas, spaces
- [ ] Invalid input shows correct inline error
- [ ] All three auction mode radio buttons selectable
- [ ] Results appear after entering a valid budget
- [ ] "No ranked items" empty state still works

### 9.5 After changes to `signals/page.tsx` or signal hooks

- [ ] Event type dropdown populated dynamically from signalConfig
- [ ] Min score slider filters correctly
- [ ] "Show acknowledged" toggle works
- [ ] Dismiss button still sends mutation and updates UI
- [ ] Headline still links to correct item detail page
- [ ] Source link opens in new tab

### 9.6 After changes to `news/page.tsx` or news store

- [ ] Source filter dropdown has all 6 sources
- [ ] Status filter has all 4 statuses
- [ ] Player search debounces and filters correctly
- [ ] Column toggle covers all 12 columns
- [ ] Column visibility persists across reload
- [ ] Sortable columns (Time, Source, Status, Players, Sig#) sort correctly
- [ ] Pagination works: Previous/Next buttons, page range label
- [ ] Column resize handles work

### 9.7 After changes to `items/[itemId]/page.tsx` or item detail components

- [ ] Item header shows correct data for the navigated item
- [ ] "View on eBay" link opens in new tab
- [ ] Buy below / sell above inputs save on blur
- [ ] Price chart renders with signal overlays
- [ ] Watcher chart renders
- [ ] OHLC chart renders or shows graceful empty state
- [ ] Historical summary cards render when data is available
- [ ] Item not found state works for invalid IDs (e.g. navigate to `/items/invalid-id`)

### 9.8 After changes to the news pipeline or signal generation

- [ ] New signals appear on `/signals` within the next cron cycle
- [ ] New news headlines appear on `/news` with correct status badges
- [ ] Signal badges appear on watchlist cards with matched signals
- [ ] Signal count in sidebar SignalSummary updates

### 9.9 After any API route changes (`/api/*`)

- [ ] Watchlist loads without console errors
- [ ] Budget results load without console errors
- [ ] Signals load and dismiss correctly
- [ ] News loads and paginates correctly
- [ ] Trends data loads for all three range options
- [ ] Item detail loads for a known item ID
- [ ] Sync button triggers a sync and watchlist data refreshes

---

## Section 10 — Console and Network Health

At the end of each review pass, check:

| # | Check | Expected |
|---|-------|----------|
| 10.1 | Browser console errors | No uncaught errors or unhandled promise rejections |
| 10.2 | Console warnings | No React key warnings, prop type warnings, or hydration errors |
| 10.3 | Network 4xx/5xx responses | No failed API calls (filter DevTools Network to XHR/Fetch) |
| 10.4 | Slow requests | No requests taking longer than 5 seconds on a local dev environment |
| 10.5 | Missing images | No broken image icons in the watchlist thumbnail column |

---

## Appendix A — Data Attributes for Test Targeting

These `data-testid` attributes are available for Playwright or chrome-devtools selectors:

| data-testid | Location | Description |
|-------------|----------|-------------|
| `loading-skeleton` | Watchlist | Container shown during initial watchlist load |
| `budget-page` | Budget | Outer wrapper of budget page content |
| `signals-page` | Signals | Outer wrapper of signals page content |
| `signal-feed` | Signals | Container for signal list |
| `signal-item` | Signals | Individual signal row |
| `dismiss-signal` | Signals | Dismiss button on each unacknowledged signal |
| `news-page` | News | Outer wrapper of news page content |
| `news-feed` | News | Container for news table |
| `trends-page` | Trends | Outer wrapper of trends page content |
| `item-detail-page` | Item Detail | Outer wrapper of item detail page content |

---

## Appendix B — Known Acceptable States

These are expected states that should NOT be filed as bugs:

- OHLC chart showing "No data yet" on items with fewer than 2 nightly rollup snapshots
- HistorySummary grid not shown on items with no historical archive
- AI metadata notice ("ANTHROPIC_API_KEY not set") on environments without the key
- Sparklines not shown on unranked items (sparklines load only for ranked items)
- Signal badge absent on items with no recent unacknowledged signals
- Budget results showing 0 picks when budget is less than the cheapest ranked item's estimated cost
- `/trends` Portfolio chart empty when fewer than 2 syncs have occurred

---

## Appendix C — Quick Smoke Test Sequence

For a rapid 5-minute smoke test after a deployment:

1. Navigate to `BASE_URL/` — verify watchlist table loads
2. Type in search box — verify rows filter
3. Click any item title — verify item detail page loads
4. Navigate to `/budget` — enter "500" — verify results appear
5. Navigate to `/signals` — verify page loads without error
6. Navigate to `/news` — verify table rows appear
7. Navigate to `/trends` — verify stats and chart load
8. Click the hamburger button — verify sidebar opens and closes
9. Click the Sync button — verify sync triggers (button shows loading state)
10. Check browser console — verify no errors
