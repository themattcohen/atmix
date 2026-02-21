# eBay Watchlist Monitor — Build Doc

Personal tool to track, rank, and analyze eBay watchlist items.

---

## What It Does

1. **Syncs your eBay watchlist** every 10 minutes via Trading API
2. **Ranks items 1–N** with unique sequential priority numbers, no dupes, no gaps
3. **Tracks trends** — price history, watcher velocity, sold comps
4. **Detects events** — item sold, expired, relisted, price dropped
5. **Shows it all** in a sortable, draggable table with trend charts

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Single codebase: UI + API routes + cron |
| Database | **SQLite** via better-sqlite3 | Zero config, perfect for personal tool, fast |
| eBay SDK | **ebay-api** (hendt) | Wraps both REST + Trading API, handles OAuth |
| Table | **TanStack Table v8** | Full control, sorting, filtering, virtualization |
| Drag & drop | **dnd-kit** | Sortable list with rank reordering |
| Charts | **Recharts** | Simple, React-native charting for trend lines |
| Styling | **Tailwind CSS** | Fast to build |
| Notifications | **ntfy.sh** | Free push notifications to phone (optional) |
| Scheduler | **node-cron** | In-process polling schedule |
| Runtime | **Node.js 20+** | LTS |
| Container | **Docker** | Self-contained, single `docker compose up` |
| Hosting | **Hetzner VPS** | Cheap, reliable, EU/US regions |

No login/auth system. Single user. Runs as a containerized app on Hetzner.

---

## App Structure

```
ebay-watchlist-monitor/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (global styles, providers)
│   │   ├── page.tsx                  # Main view — ranked watchlist table
│   │   ├── trends/
│   │   │   └── page.tsx              # Trend analysis dashboard
│   │   └── item/
│   │       └── [itemId]/
│   │           └── page.tsx          # Single item detail + price chart
│   │
│   ├── api/                          # Next.js API routes
│   │   ├── sync/
│   │   │   └── route.ts             # POST — trigger manual watchlist sync
│   │   ├── items/
│   │   │   └── route.ts             # GET — fetch ranked items list
│   │   ├── items/
│   │   │   └── [itemId]/
│   │   │       └── route.ts         # GET single item, PATCH to update notes
│   │   ├── rank/
│   │   │   └── route.ts             # PUT — update item priority (reorder)
│   │   ├── trends/
│   │   │   └── route.ts             # GET — trend data (price history, comps, velocity)
│   │   └── events/
│   │       └── route.ts             # GET — sold/expired/relisted event log
│   │
│   ├── components/
│   │   ├── watchlist-table.tsx       # Main ranked table with drag handles
│   │   ├── rank-cell.tsx             # Editable rank number input
│   │   ├── price-badge.tsx           # Price display with change indicator arrows
│   │   ├── time-left.tsx             # Countdown with color urgency
│   │   ├── watcher-badge.tsx         # Watcher count with velocity indicator
│   │   ├── status-badge.tsx          # Active / Sold / Expired / Relisted
│   │   ├── item-row.tsx              # Table row (draggable)
│   │   ├── trend-chart.tsx           # Recharts line chart (price over time)
│   │   ├── watcher-chart.tsx         # Recharts line chart (watchers over time)
│   │   ├── comps-table.tsx           # Sold comps comparison table
│   │   ├── sync-button.tsx           # Manual sync trigger
│   │   └── event-log.tsx             # Recent events feed
│   │
│   ├── lib/
│   │   ├── db.ts                     # SQLite connection + query helpers
│   │   ├── schema.ts                 # DB schema definitions + migrations
│   │   ├── ebay.ts                   # eBay API client (Trading + Browse)
│   │   ├── sync.ts                   # Watchlist sync logic
│   │   ├── rank.ts                   # Rank assignment + reorder logic
│   │   ├── trends.ts                 # Trend computation (price, watchers, comps)
│   │   ├── events.ts                 # Event detection (sold, expired, relisted)
│   │   ├── notify.ts                 # Push notification dispatch (ntfy.sh)
│   │   └── cron.ts                   # Scheduled sync (node-cron)
│   │
│   └── types/
│       └── index.ts                  # Shared TypeScript types
│
├── db/
│   └── watchlist.db                  # SQLite database file (gitignored)
│
├── .env.local                        # eBay API credentials (gitignored)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Database Schema

### `items` — Current watchlist state + ranking

```sql
CREATE TABLE items (
  item_id        TEXT PRIMARY KEY,          -- eBay listing ID
  rank           INTEGER UNIQUE,            -- 1-based priority, no dupes, NULL = unranked
  title          TEXT NOT NULL,
  current_price  REAL NOT NULL,             -- in USD
  currency       TEXT DEFAULT 'USD',
  buy_it_now     REAL,
  shipping_cost  REAL DEFAULT 0,
  total_price    REAL GENERATED ALWAYS AS (current_price + shipping_cost) STORED,
  listing_type   TEXT,                      -- Auction, FixedPriceItem, etc.
  condition_name TEXT,                      -- Graded, Brand New, etc.
  time_left      TEXT,                      -- ISO 8601 duration
  end_time       TEXT,                      -- ISO 8601 timestamp
  seller_id      TEXT,
  seller_feedback INTEGER,
  seller_positive_pct REAL,
  watcher_count  INTEGER DEFAULT 0,
  bid_count      INTEGER DEFAULT 0,
  image_url      TEXT,
  item_url       TEXT,
  status         TEXT DEFAULT 'active',     -- active, sold, expired, relisted
  notes          TEXT,                      -- personal notes
  first_seen     TEXT DEFAULT (datetime('now')),
  last_synced    TEXT DEFAULT (datetime('now')),
  removed_at     TEXT                       -- when item left watchlist
);

CREATE INDEX idx_items_rank ON items(rank);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_end_time ON items(end_time);
```

### `price_history` — Price snapshots for trend charts

```sql
CREATE TABLE price_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(item_id),
  price       REAL NOT NULL,
  shipping    REAL DEFAULT 0,
  bid_count   INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_price_history_item ON price_history(item_id, recorded_at);
```

### `watcher_history` — Watcher count snapshots for velocity tracking

```sql
CREATE TABLE watcher_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(item_id),
  count       INTEGER NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_watcher_history_item ON watcher_history(item_id, recorded_at);
```

### `events` — Sold, expired, relisted, price drop log

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES items(item_id),
  event_type  TEXT NOT NULL,               -- sold, expired, relisted, price_drop, price_increase
  old_value   TEXT,                         -- previous price, status, etc.
  new_value   TEXT,                         -- new price, status, relistd item ID, etc.
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_item ON events(item_id, created_at);
CREATE INDEX idx_events_type ON events(event_type, created_at);
```

### `sold_comps` — Completed sales for market comparison

```sql
CREATE TABLE sold_comps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       TEXT,                       -- linked watchlist item (if matched)
  comp_item_id  TEXT NOT NULL,              -- eBay item ID of the sold listing
  title         TEXT NOT NULL,
  sold_price    REAL NOT NULL,
  shipping      REAL DEFAULT 0,
  sold_date     TEXT,
  condition_name TEXT,
  seller_id     TEXT,
  search_query  TEXT,                       -- query used to find this comp
  fetched_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_comps_item ON sold_comps(item_id);
CREATE INDEX idx_comps_query ON sold_comps(search_query);
```

---

## Ranking System

### Rules

1. Every item gets a unique integer rank: `1, 2, 3, ... N`
2. No duplicates, no gaps in the active set
3. New items from sync arrive as **unranked** (`rank = NULL`) — shown in a separate "Unranked" section below the ranked table
4. User assigns rank by:
   - **Typing a number** in the rank cell → item moves to that position, everything else shifts
   - **Dragging** the row → rank updates to new position, neighbors shift
5. When a ranked item is sold/expired → its rank is freed, all ranks above it shift down to fill the gap
6. Unranked items sort by `end_time` (soonest ending first)

### Reorder Algorithm

```
SET RANK(item, newRank):
  oldRank = item.currentRank

  if oldRank == NULL:
    -- Inserting unranked item
    -- Shift everything at newRank and below down by 1
    UPDATE items SET rank = rank + 1 WHERE rank >= newRank AND rank IS NOT NULL
    UPDATE items SET rank = newRank WHERE item_id = item.id

  else if newRank < oldRank:
    -- Moving up (e.g., 5 → 2)
    -- Shift items in [newRank, oldRank-1] down by 1
    UPDATE items SET rank = rank + 1 WHERE rank >= newRank AND rank < oldRank
    UPDATE items SET rank = newRank WHERE item_id = item.id

  else if newRank > oldRank:
    -- Moving down (e.g., 2 → 5)
    -- Shift items in [oldRank+1, newRank] up by 1
    UPDATE items SET rank = rank - 1 WHERE rank > oldRank AND rank <= newRank
    UPDATE items SET rank = newRank WHERE item_id = item.id
```

All rank operations run inside a single SQLite transaction for atomicity.

---

## Sync Logic

### Every 10 minutes (via node-cron):

```
1. FETCH watchlist
   Call GetMyeBayBuying with WatchList.Include = true
   Paginate through all pages (200 items/page, max 400 items)

2. DIFF against local DB
   For each item in API response:
     if item_id NOT in DB → INSERT as new (unranked, status=active)
     if item_id IN DB → UPDATE price, watchers, time_left, bid_count, end_time, etc.
       if price changed → INSERT into price_history, CREATE event
       if watcher count changed → INSERT into watcher_history

   For each item in DB (status=active) NOT in API response:
     → Item left watchlist. Determine why:
       Call Browse API getItem to check listing status
       if sold → status=sold, CREATE event, FREE rank, NOTIFY
       if ended unsold → status=expired, CREATE event, FREE rank
       if still active → user manually removed from watchlist, just mark removed

3. ENRICH (optional, batched)
   Call Browse API getItems (batch of 20) for richer data:
     better images, full condition info, item specifics

4. COMPS (periodic, not every sync — once per hour per item)
   For each active ranked item:
     Call Browse API search with Marketplace Insights
     (buy/marketplace_insights/v1_beta/item_sales/search)
     Query: key words from title + same category
     Store top 10 recent sold results in sold_comps table
```

### Relist Detection

When an item is marked expired or sold, run a follow-up search:

```
Search Browse API for:
  seller: same seller_id
  keywords: key terms extracted from title (card name, year, set)
  filter: listed within last 7 days

If match found with >80% title similarity:
  → Link old item to new item
  → CREATE event (type=relisted, new_value=new_item_id)
  → NOTIFY
```

---

## Trend Analysis

### 1. Price History (per item)

- **Chart**: Line chart of `price_history.price` over `recorded_at`
- **Metrics shown**:
  - Current price vs first-seen price (% change)
  - Price high / low over tracking period
  - Days on market
  - Price per day trend (slope)

### 2. Watcher Velocity (per item)

- **Chart**: Line chart of `watcher_history.count` over `recorded_at`
- **Metrics shown**:
  - Current watchers
  - Watchers gained in last 24h / 7d
  - Velocity (watchers/day)
  - Heat score: items gaining watchers fast = "heating up"

### 3. Sold Comps (per item)

- **Table**: Recent sold listings for similar items
- **Metrics shown**:
  - Average sold price (last 30/60/90 days)
  - Median sold price
  - Price range (low – high)
  - Your item's price vs avg sold (over/under %)
  - "Deal score" = how far below market avg your item is priced

### 4. Portfolio Dashboard (aggregate, `/trends` page)

- **Total watchlist value** (sum of all active item prices)
- **Items by status** breakdown (active / sold / expired)
- **Top movers** — biggest price drops in last 24h
- **Heating up** — items with fastest watcher velocity
- **Best deals** — items with lowest price vs sold comps
- **Ending soon** — items ending within 24h, sorted by rank

---

## API Routes

### `GET /api/items`

Returns ranked watchlist items.

```
Query params:
  status    = active | sold | expired | all (default: active)
  sort      = rank | price | watchers | end_time (default: rank)
  dir       = asc | desc (default: asc)

Response: {
  ranked: Item[],       // items with rank, sorted by rank
  unranked: Item[],     // items with rank=null, sorted by end_time
  counts: { active, sold, expired, total }
}
```

### `PUT /api/rank`

Set or change an item's rank.

```
Body: {
  itemId: string,
  newRank: number       // 1-based
}

Response: {
  updated: Item[],      // all items whose rank changed
}
```

### `POST /api/sync`

Trigger immediate watchlist sync (bypass cron schedule).

```
Response: {
  added: number,
  updated: number,
  sold: number,
  expired: number,
  duration_ms: number
}
```

### `GET /api/trends?itemId=xxx`

Get trend data for a specific item.

```
Response: {
  priceHistory:   { date, price, shipping }[],
  watcherHistory: { date, count }[],
  comps:          { title, soldPrice, shipping, soldDate, condition }[],
  metrics: {
    priceChange7d, priceChangePct,
    watcherVelocity, watchersGained24h,
    avgCompPrice, medianCompPrice, dealScore
  }
}
```

### `GET /api/trends/dashboard`

Aggregate trend data for the portfolio view.

```
Response: {
  totalValue: number,
  statusCounts: { active, sold, expired },
  topPriceDrops:    Item[],    // biggest price decreases (last 24h)
  heatingUp:        Item[],    // fastest watcher velocity
  bestDeals:        Item[],    // best deal score vs comps
  endingSoon:       Item[],    // ending < 24h, by rank
}
```

### `GET /api/events`

Event log.

```
Query params:
  type    = sold | expired | relisted | price_drop | all
  limit   = number (default 50)

Response: Event[]
```

### `PATCH /api/items/:itemId`

Update notes on an item.

```
Body: { notes: string }
```

---

## eBay Credentials Setup

```env
# .env (loaded by Docker)
EBAY_APP_ID=your_client_id
EBAY_CERT_ID=your_client_secret
EBAY_DEV_ID=your_dev_id
EBAY_REDIRECT_URI=your_redirect_uri
EBAY_REFRESH_TOKEN=your_refresh_token
EBAY_ENVIRONMENT=production              # or sandbox
EBAY_USERNAME=your_ebay_username
EBAY_PASSWORD=your_ebay_password
```

### One-Time OAuth Setup

1. Register at https://developer.ebay.com/join (free)
2. Create a production keyset
3. Set a RuName (redirect URI) — can be `http://localhost:3000/auth/callback`
4. Run the consent flow once in a browser to get the authorization code
5. Exchange for refresh token (~18 month lifetime)
6. Store refresh token in `.env`
7. App auto-refreshes access tokens (2h lifetime) from there

> **Note:** Username and password are stored for automated re-auth if the
> refresh token ever expires (~18 months). Since this is a personal tool
> running on your own Hetzner box, this is acceptable. The `.env` file
> is volume-mounted, never baked into the image.

---

## Notification Events (Optional)

When enabled, sends push notifications via ntfy.sh for:

| Event | Message |
|---|---|
| Item sold | "🔴 SOLD: [title] went for $X" |
| Price drop | "💰 PRICE DROP: [title] now $X (was $Y)" |
| Ending soon (ranked item) | "⏰ ENDING: #[rank] [title] ends in [time]" |
| Relisted | "🔄 RELISTED: [title] back up by [seller]" |

---

## Build Order

Phase 1 — Foundation
1. Next.js project scaffold + Tailwind + TypeScript
2. SQLite schema + migrations (`lib/schema.ts`)
3. eBay client setup (`lib/ebay.ts`)
4. Sync engine (`lib/sync.ts`) — fetch watchlist, diff, upsert
5. Manual sync API route + button

Phase 2 — Core Table
6. Watchlist table component with TanStack Table
7. Rank system (`lib/rank.ts`) + rank cell (editable input)
8. Drag-and-drop reorder with dnd-kit
9. Status badges, time countdown, price display

Phase 3 — Trend Analysis
10. Price history recording + chart
11. Watcher history recording + velocity chart
12. Sold comps fetching + comps table
13. Deal score computation
14. Trends dashboard page

Phase 4 — Events & Polish
15. Event detection (sold, expired, relisted)
16. Event log UI
17. Push notifications (ntfy.sh)
18. Scheduled sync (node-cron, every 10 min)
19. Item detail page with full trend charts
20. Error handling, loading states, empty states

Phase 5 — Docker & Deploy
21. Dockerfile (multi-stage build)
22. docker-compose.yml (app + volumes)
23. Deploy to Hetzner VPS

---

## Docker Setup

### Project files added to root

```
ebay-watchlist-monitor/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── ...
```

### Dockerfile

```dockerfile
# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# SQLite needs native bindings
RUN apk add --no-cache sqlite

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/src/lib/schema.ts ./src/lib/schema.ts

# DB volume mount point
RUN mkdir -p /app/db

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    container_name: ebay-watchlist
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - watchlist-data:/app/db    # SQLite persistence
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/items"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  watchlist-data:
    driver: local
```

### .dockerignore

```
node_modules
.next
db/*.db
.env
.git
```

---

## Hetzner Deployment

### 1. Provision VPS

- **Type**: CX22 (2 vCPU, 4 GB RAM, 40 GB disk) — ~€4/month
- **OS**: Ubuntu 24.04
- **Location**: Choose closest region

### 2. Initial Server Setup

```bash
# SSH in
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Create app directory
mkdir -p /opt/ebay-watchlist
cd /opt/ebay-watchlist
```

### 3. Deploy

```bash
# Clone or copy your code to /opt/ebay-watchlist
git clone <your-repo> .

# Create .env with your credentials
cat > .env << 'EOF'
EBAY_APP_ID=xxx
EBAY_CERT_ID=xxx
EBAY_DEV_ID=xxx
EBAY_REDIRECT_URI=xxx
EBAY_REFRESH_TOKEN=xxx
EBAY_USERNAME=xxx
EBAY_PASSWORD=xxx
EOF

# Build and launch
docker compose up -d --build

# Check logs
docker compose logs -f
```

### 4. Updates

```bash
cd /opt/ebay-watchlist
git pull
docker compose up -d --build
```

### 5. Optional: Reverse Proxy with HTTPS

If you want to access it via a domain with SSL:

```bash
# Install Caddy (automatic HTTPS)
apt install caddy

# /etc/caddy/Caddyfile
watchlist.yourdomain.com {
    reverse_proxy localhost:3000
}

systemctl restart caddy
```

### 6. Backup

SQLite DB lives in a Docker volume. Back it up with:

```bash
# One-liner backup to your local machine
docker cp ebay-watchlist:/app/db/watchlist.db ./backup-$(date +%F).db
```

Or set up a cron job on the host:

```bash
# /etc/cron.d/watchlist-backup
0 4 * * * root docker cp ebay-watchlist:/app/db/watchlist.db /opt/backups/watchlist-$(date +\%F).db
```
