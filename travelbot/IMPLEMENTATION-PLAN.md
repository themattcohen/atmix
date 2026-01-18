# TravelBot MVP Implementation & Testing Plan

## MVP Definition

**Goal:** A working website where users can discover, search, and filter flight deals.

**Success Criteria:**
- [ ] Users can view a feed of flight deals
- [ ] Users can search deals by origin/destination
- [ ] Users can filter by price, dates, airlines, stops
- [ ] Users can sort results (price, deal score, departure date)
- [ ] Users can click through to booking links
- [ ] Deal data can be managed via admin interface
- [ ] Site is responsive (mobile + desktop)
- [ ] Page load < 2 seconds

**Explicitly Out of Scope:**
- User accounts/authentication
- Email notifications
- Price predictions/ML
- Real-time API integrations (using seeded data)
- Mobile apps

---

## Technical Architecture (MVP)

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Deal Feed  │  │   Search    │  │Deal Detail  │     │
│  │    Page     │  │   + Filter  │  │   Modal     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  API ROUTES (Next.js)                    │
│  GET /api/deals         - List deals with filters       │
│  GET /api/deals/[id]    - Single deal details           │
│  GET /api/airports      - Airport autocomplete          │
│  POST /api/admin/deals  - Create deal (admin)           │
│  PUT /api/admin/deals   - Update deal (admin)           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   DATA LAYER                             │
│  Option A: JSON files (simplest, no DB)                 │
│  Option B: SQLite (local, portable)                     │
│  Option C: PostgreSQL (production-ready)                │
└─────────────────────────────────────────────────────────┘
```

**Recommended Stack for MVP:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Data:** JSON files initially → SQLite/Postgres later
- **State:** React Query for server state
- **Forms:** React Hook Form
- **Deployment:** Vercel

---

## Project Structure

```
travelbot/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home (deal feed)
│   │   ├── deals/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Deal detail page
│   │   ├── search/
│   │   │   └── page.tsx            # Search results
│   │   ├── admin/
│   │   │   └── page.tsx            # Admin dashboard
│   │   └── api/
│   │       ├── deals/
│   │       │   ├── route.ts        # GET deals list
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET single deal
│   │       ├── airports/
│   │       │   └── route.ts        # Airport search
│   │       └── admin/
│   │           └── deals/
│   │               └── route.ts    # CRUD for deals
│   ├── components/
│   │   ├── ui/                     # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── deals/
│   │   │   ├── DealCard.tsx        # Individual deal card
│   │   │   ├── DealGrid.tsx        # Grid of deal cards
│   │   │   ├── DealDetail.tsx      # Full deal view
│   │   │   └── DealBadge.tsx       # Deal type badge
│   │   ├── search/
│   │   │   ├── SearchBar.tsx       # Main search input
│   │   │   ├── FilterPanel.tsx     # Filter sidebar
│   │   │   ├── SortDropdown.tsx    # Sort options
│   │   │   └── AirportInput.tsx    # Autocomplete input
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Container.tsx
│   ├── lib/
│   │   ├── data/
│   │   │   ├── deals.ts            # Deal data access
│   │   │   ├── airports.ts         # Airport data
│   │   │   └── seed.ts             # Seed data generator
│   │   ├── types/
│   │   │   ├── deal.ts             # Deal types
│   │   │   ├── airport.ts          # Airport types
│   │   │   └── api.ts              # API response types
│   │   ├── utils/
│   │   │   ├── format.ts           # Price/date formatting
│   │   │   ├── filters.ts          # Filter logic
│   │   │   └── sort.ts             # Sort logic
│   │   └── hooks/
│   │       ├── useDeals.ts         # Deals query hook
│   │       └── useAirports.ts      # Airport search hook
│   └── styles/
│       └── globals.css             # Global styles
├── data/
│   ├── deals.json                  # Deal data
│   └── airports.json               # Airport reference
├── public/
│   ├── favicon.ico
│   └── images/
├── tests/
│   ├── unit/
│   │   ├── utils/
│   │   │   ├── format.test.ts
│   │   │   ├── filters.test.ts
│   │   │   └── sort.test.ts
│   │   └── components/
│   │       ├── DealCard.test.tsx
│   │       └── SearchBar.test.tsx
│   ├── integration/
│   │   ├── api/
│   │   │   └── deals.test.ts
│   │   └── pages/
│   │       └── home.test.tsx
│   └── e2e/
│       ├── search.spec.ts
│       └── filter.spec.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## Data Models

### Deal Type

```typescript
// src/lib/types/deal.ts

export interface Deal {
  id: string;

  // Route
  origin: Airport;
  destination: Airport;

  // Pricing
  price: number;           // in cents
  currency: string;        // "USD"
  normalPrice: number;     // typical price in cents
  savingsPercent: number;  // calculated

  // Deal metadata
  dealScore: number;       // 0-100
  dealType: DealType;
  confidence: 'high' | 'medium' | 'low';

  // Flight details
  airlines: string[];
  cabinClass: CabinClass;
  stops: number;

  // Dates
  outboundDateStart: string;  // ISO date
  outboundDateEnd: string;
  returnDateStart?: string;
  returnDateEnd?: string;
  isOneWay: boolean;

  // Booking
  bookingLinks: BookingLink[];

  // Metadata
  restrictions?: string[];
  expiresAt?: string;       // ISO datetime
  createdAt: string;
  isActive: boolean;
}

export type DealType =
  | 'flash_sale'
  | 'mistake_fare'
  | 'off_peak'
  | 'new_route'
  | 'award_deal'
  | 'holiday_sale';

export type CabinClass =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first';

export interface BookingLink {
  provider: string;
  url: string;
  price: number;
}

export interface Airport {
  code: string;      // "LAX"
  name: string;      // "Los Angeles International"
  city: string;      // "Los Angeles"
  country: string;   // "United States"
  region?: string;   // "North America"
}
```

### Filter/Search Types

```typescript
// src/lib/types/api.ts

export interface DealFilters {
  origin?: string;           // airport code
  destination?: string;      // airport code
  originRegion?: string;     // e.g., "North America"
  destinationRegion?: string;
  maxPrice?: number;
  minSavings?: number;       // percentage
  departureAfter?: string;   // ISO date
  departureBefore?: string;
  airlines?: string[];
  cabinClass?: CabinClass[];
  maxStops?: number;
  dealTypes?: DealType[];
  isOneWay?: boolean;
}

export interface DealSort {
  field: 'price' | 'dealScore' | 'savingsPercent' | 'departureDate' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface DealsResponse {
  deals: Deal[];
  total: number;
  page: number;
  pageSize: number;
  filters: DealFilters;
}
```

---

## Implementation Tasks

### Phase 1: Project Setup

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 1.1 | Initialize Next.js project with TypeScript | Small |
| 1.2 | Configure Tailwind CSS | Small |
| 1.3 | Set up project structure (folders) | Small |
| 1.4 | Create TypeScript types/interfaces | Small |
| 1.5 | Set up ESLint + Prettier | Small |
| 1.6 | Configure testing (Vitest + Playwright) | Medium |

**Deliverable:** Empty project that builds and runs

---

### Phase 2: Data Layer

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 2.1 | Create airports.json with 200+ airports | Medium |
| 2.2 | Create deal seed data generator | Medium |
| 2.3 | Generate 50+ sample deals | Small |
| 2.4 | Build deal data access functions | Medium |
| 2.5 | Build airport search function | Small |
| 2.6 | Write unit tests for data layer | Medium |

**Data Access API:**

```typescript
// src/lib/data/deals.ts

export async function getDeals(
  filters: DealFilters,
  sort: DealSort,
  page: number,
  pageSize: number
): Promise<DealsResponse>;

export async function getDealById(id: string): Promise<Deal | null>;

export async function createDeal(deal: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal>;

export async function updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>;

export async function deleteDeal(id: string): Promise<void>;
```

**Deliverable:** Working data layer with seed data

---

### Phase 3: API Routes

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 3.1 | GET /api/deals - list with filters | Medium |
| 3.2 | GET /api/deals/[id] - single deal | Small |
| 3.3 | GET /api/airports - search/autocomplete | Small |
| 3.4 | POST /api/admin/deals - create deal | Small |
| 3.5 | PUT /api/admin/deals/[id] - update deal | Small |
| 3.6 | DELETE /api/admin/deals/[id] - delete deal | Small |
| 3.7 | Write integration tests for all endpoints | Medium |

**API Route Example:**

```typescript
// src/app/api/deals/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDeals } from '@/lib/data/deals';
import { DealFilters, DealSort } from '@/lib/types/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters: DealFilters = {
    origin: searchParams.get('origin') || undefined,
    destination: searchParams.get('destination') || undefined,
    maxPrice: searchParams.get('maxPrice')
      ? parseInt(searchParams.get('maxPrice')!)
      : undefined,
    maxStops: searchParams.get('maxStops')
      ? parseInt(searchParams.get('maxStops')!)
      : undefined,
    // ... parse other filters
  };

  const sort: DealSort = {
    field: (searchParams.get('sortBy') as DealSort['field']) || 'dealScore',
    direction: (searchParams.get('sortDir') as DealSort['direction']) || 'desc',
  };

  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const result = await getDeals(filters, sort, page, pageSize);

  return NextResponse.json(result);
}
```

**Deliverable:** All API endpoints working and tested

---

### Phase 4: UI Components

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 4.1 | Base UI components (Button, Input, Card, etc.) | Medium |
| 4.2 | Header and Footer layout | Small |
| 4.3 | DealCard component | Medium |
| 4.4 | DealGrid component | Small |
| 4.5 | DealDetail modal/page | Medium |
| 4.6 | SearchBar component | Medium |
| 4.7 | AirportInput with autocomplete | Medium |
| 4.8 | FilterPanel component | Medium |
| 4.9 | SortDropdown component | Small |
| 4.10 | Loading skeletons | Small |
| 4.11 | Empty states | Small |
| 4.12 | Write component unit tests | Medium |

**DealCard Component Spec:**

```typescript
// src/components/deals/DealCard.tsx

interface DealCardProps {
  deal: Deal;
  onClick?: (deal: Deal) => void;
  variant?: 'default' | 'compact';
}

// Displays:
// - Route (LAX → NRT)
// - Price with savings badge ($387 / 65% off)
// - Deal type badge (Flash Sale, Mistake Fare)
// - Date range
// - Airline(s)
// - Stops indicator
// - Deal score indicator
// - CTA button
```

**Deliverable:** All components built and visually tested

---

### Phase 5: Pages & Integration

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 5.1 | Home page (deal feed) | Medium |
| 5.2 | Search results page | Medium |
| 5.3 | Deal detail page/modal | Medium |
| 5.4 | Admin dashboard (list + CRUD) | Medium |
| 5.5 | 404 and error pages | Small |
| 5.6 | React Query setup and hooks | Medium |
| 5.7 | URL state for filters/search | Medium |
| 5.8 | Responsive testing | Medium |

**Home Page Behavior:**

```typescript
// src/app/page.tsx

// 1. Load featured/recent deals on mount
// 2. Display SearchBar at top
// 3. Show FilterPanel in sidebar (desktop) or modal (mobile)
// 4. DealGrid shows results
// 5. Infinite scroll or pagination
// 6. Clicking deal opens detail modal
// 7. URL updates with current filters (shareable)
```

**Deliverable:** Fully functional website

---

### Phase 6: Polish & Deploy

| Task | Description | Est. Effort |
|------|-------------|-------------|
| 6.1 | SEO meta tags | Small |
| 6.2 | Open Graph images | Small |
| 6.3 | Favicon and app icons | Small |
| 6.4 | Performance optimization | Medium |
| 6.5 | Accessibility audit (a11y) | Medium |
| 6.6 | Cross-browser testing | Medium |
| 6.7 | Vercel deployment setup | Small |
| 6.8 | Domain configuration | Small |

**Deliverable:** Production-ready deployed site

---

## Testing Strategy

### Testing Pyramid

```
         /\
        /  \
       / E2E \        5 tests - Critical user journeys
      /--------\
     /Integration\    15 tests - API + page behavior
    /--------------\
   /   Unit Tests   \ 30+ tests - Utils, components
  /------------------\
```

### Unit Tests

**Location:** `tests/unit/`
**Tool:** Vitest + React Testing Library
**Coverage Target:** 80%

| Test Suite | What to Test |
|------------|--------------|
| `format.test.ts` | Price formatting, date formatting, savings calculation |
| `filters.test.ts` | Filter matching logic, edge cases |
| `sort.test.ts` | Sort comparators for all fields |
| `DealCard.test.tsx` | Renders correctly, click handlers, variants |
| `SearchBar.test.tsx` | Input handling, submit behavior |
| `FilterPanel.test.tsx` | Filter state, reset functionality |

**Example Unit Test:**

```typescript
// tests/unit/utils/format.test.ts

import { describe, it, expect } from 'vitest';
import { formatPrice, formatSavings, formatDateRange } from '@/lib/utils/format';

describe('formatPrice', () => {
  it('formats cents to dollars with currency symbol', () => {
    expect(formatPrice(38700, 'USD')).toBe('$387');
    expect(formatPrice(38750, 'USD')).toBe('$388'); // rounds
    expect(formatPrice(100000, 'EUR')).toBe('€1,000');
  });

  it('handles zero and negative values', () => {
    expect(formatPrice(0, 'USD')).toBe('$0');
    expect(formatPrice(-100, 'USD')).toBe('$0'); // clamps
  });
});

describe('formatSavings', () => {
  it('calculates percentage correctly', () => {
    expect(formatSavings(112000, 38700)).toBe(65);
    expect(formatSavings(100, 100)).toBe(0);
    expect(formatSavings(100, 50)).toBe(50);
  });
});

describe('formatDateRange', () => {
  it('formats date ranges readably', () => {
    expect(formatDateRange('2025-03-01', '2025-04-30')).toBe('Mar 1 - Apr 30');
    expect(formatDateRange('2025-03-01', '2025-03-15')).toBe('Mar 1 - 15');
  });
});
```

### Integration Tests

**Location:** `tests/integration/`
**Tool:** Vitest + MSW (Mock Service Worker)
**Coverage:** All API endpoints, key page behaviors

| Test Suite | What to Test |
|------------|--------------|
| `api/deals.test.ts` | All /api/deals endpoints, filter combinations |
| `api/airports.test.ts` | Airport search, edge cases |
| `pages/home.test.tsx` | Page loads, data fetches, filter applies |
| `pages/search.test.tsx` | Search params work, results display |

**Example Integration Test:**

```typescript
// tests/integration/api/deals.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@/tests/helpers/server';

describe('GET /api/deals', () => {
  let server: ReturnType<typeof createServer>;

  beforeAll(() => {
    server = createServer();
  });

  afterAll(() => {
    server.close();
  });

  it('returns deals with default pagination', async () => {
    const response = await fetch(`${server.url}/api/deals`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deals).toBeInstanceOf(Array);
    expect(data.deals.length).toBeLessThanOrEqual(20);
    expect(data.page).toBe(1);
    expect(data.total).toBeGreaterThan(0);
  });

  it('filters by origin airport', async () => {
    const response = await fetch(`${server.url}/api/deals?origin=LAX`);
    const data = await response.json();

    expect(response.status).toBe(200);
    data.deals.forEach((deal: Deal) => {
      expect(deal.origin.code).toBe('LAX');
    });
  });

  it('filters by max price', async () => {
    const maxPrice = 50000; // $500
    const response = await fetch(`${server.url}/api/deals?maxPrice=${maxPrice}`);
    const data = await response.json();

    data.deals.forEach((deal: Deal) => {
      expect(deal.price).toBeLessThanOrEqual(maxPrice);
    });
  });

  it('sorts by price ascending', async () => {
    const response = await fetch(`${server.url}/api/deals?sortBy=price&sortDir=asc`);
    const data = await response.json();

    for (let i = 1; i < data.deals.length; i++) {
      expect(data.deals[i].price).toBeGreaterThanOrEqual(data.deals[i - 1].price);
    }
  });

  it('combines multiple filters', async () => {
    const response = await fetch(
      `${server.url}/api/deals?origin=LAX&maxPrice=50000&maxStops=1`
    );
    const data = await response.json();

    data.deals.forEach((deal: Deal) => {
      expect(deal.origin.code).toBe('LAX');
      expect(deal.price).toBeLessThanOrEqual(50000);
      expect(deal.stops).toBeLessThanOrEqual(1);
    });
  });

  it('returns empty array for no matches', async () => {
    const response = await fetch(`${server.url}/api/deals?maxPrice=1`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deals).toEqual([]);
    expect(data.total).toBe(0);
  });
});
```

### End-to-End Tests

**Location:** `tests/e2e/`
**Tool:** Playwright
**Coverage:** Critical user journeys

| Test | User Journey |
|------|--------------|
| `search.spec.ts` | User searches for flights, sees results |
| `filter.spec.ts` | User applies filters, results update |
| `deal-detail.spec.ts` | User clicks deal, views details, clicks booking |
| `responsive.spec.ts` | Key flows work on mobile viewport |

**Example E2E Test:**

```typescript
// tests/e2e/search.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Flight Deal Search', () => {
  test('user can search for deals by destination', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/');

    // 2. Verify deal feed loads
    await expect(page.getByTestId('deal-grid')).toBeVisible();
    await expect(page.getByTestId('deal-card')).toHaveCount({ minimum: 1 });

    // 3. Enter destination in search
    await page.getByPlaceholder('Where to?').click();
    await page.getByPlaceholder('Where to?').fill('Tokyo');
    await page.getByRole('option', { name: /Tokyo/i }).click();

    // 4. Submit search
    await page.getByRole('button', { name: 'Search' }).click();

    // 5. Verify URL updates
    await expect(page).toHaveURL(/destination=NRT|TYO|HND/);

    // 6. Verify results show Tokyo deals
    const dealCards = page.getByTestId('deal-card');
    await expect(dealCards.first()).toContainText(/Tokyo|NRT|TYO|HND/);
  });

  test('user can filter by price range', async ({ page }) => {
    await page.goto('/');

    // Open filter panel
    await page.getByRole('button', { name: 'Filters' }).click();

    // Set max price to $500
    await page.getByLabel('Max Price').fill('500');
    await page.getByRole('button', { name: 'Apply' }).click();

    // Verify all visible prices are under $500
    const prices = await page.getByTestId('deal-price').allTextContents();
    prices.forEach(priceText => {
      const price = parseInt(priceText.replace(/[^0-9]/g, ''));
      expect(price).toBeLessThanOrEqual(500);
    });
  });

  test('user can click deal and view details', async ({ page }) => {
    await page.goto('/');

    // Click first deal card
    const firstDeal = page.getByTestId('deal-card').first();
    const dealTitle = await firstDeal.getByTestId('deal-route').textContent();
    await firstDeal.click();

    // Verify detail modal/page opens
    await expect(page.getByTestId('deal-detail')).toBeVisible();
    await expect(page.getByTestId('deal-detail')).toContainText(dealTitle!);

    // Verify booking link exists
    await expect(page.getByRole('link', { name: /Book/i })).toBeVisible();
  });

  test('user can sort results', async ({ page }) => {
    await page.goto('/');

    // Change sort to price low-to-high
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('price-asc');

    // Verify first result has lowest price
    const prices = await page.getByTestId('deal-price').allTextContents();
    const numericPrices = prices.map(p => parseInt(p.replace(/[^0-9]/g, '')));

    for (let i = 1; i < numericPrices.length; i++) {
      expect(numericPrices[i]).toBeGreaterThanOrEqual(numericPrices[i - 1]);
    }
  });
});
```

```typescript
// tests/e2e/responsive.spec.ts

import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['iPhone 13'] });

  test('mobile user can search and filter', async ({ page }) => {
    await page.goto('/');

    // Deal grid should be single column on mobile
    await expect(page.getByTestId('deal-grid')).toHaveCSS('grid-template-columns', /^[^,]+$/);

    // Filter should be in a modal/drawer
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByTestId('filter-drawer')).toBeVisible();

    // Search should work
    await page.getByPlaceholder('Where to?').fill('Paris');
    await page.getByRole('option', { name: /Paris/i }).click();
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByTestId('deal-card')).toHaveCount({ minimum: 1 });
  });
});
```

### Test Commands

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --dir tests/unit",
    "test:integration": "vitest run --dir tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "vitest run --coverage",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

---

## Sample Seed Data

```typescript
// src/lib/data/seed.ts

export const sampleDeals: Omit<Deal, 'id' | 'createdAt'>[] = [
  {
    origin: { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States' },
    destination: { code: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan' },
    price: 38700,
    currency: 'USD',
    normalPrice: 112000,
    savingsPercent: 65,
    dealScore: 94,
    dealType: 'flash_sale',
    confidence: 'high',
    airlines: ['ANA'],
    cabinClass: 'economy',
    stops: 0,
    outboundDateStart: '2025-03-01',
    outboundDateEnd: '2025-04-30',
    returnDateStart: '2025-03-08',
    returnDateEnd: '2025-05-15',
    isOneWay: false,
    bookingLinks: [
      { provider: 'ANA Direct', url: 'https://www.ana.co.jp', price: 38700 },
      { provider: 'Google Flights', url: 'https://flights.google.com', price: 39200 }
    ],
    restrictions: ['Blackout: Mar 15-22'],
    expiresAt: '2025-01-25T23:59:59Z',
    isActive: true
  },
  {
    origin: { code: 'JFK', name: 'John F Kennedy International', city: 'New York', country: 'United States' },
    destination: { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
    price: 29900,
    currency: 'USD',
    normalPrice: 85000,
    savingsPercent: 65,
    dealScore: 91,
    dealType: 'mistake_fare',
    confidence: 'medium',
    airlines: ['Air France'],
    cabinClass: 'economy',
    stops: 0,
    outboundDateStart: '2025-02-01',
    outboundDateEnd: '2025-03-15',
    returnDateStart: '2025-02-08',
    returnDateEnd: '2025-03-30',
    isOneWay: false,
    bookingLinks: [
      { provider: 'Air France', url: 'https://www.airfrance.com', price: 29900 }
    ],
    restrictions: ['Book within 24 hours', 'May be canceled'],
    expiresAt: '2025-01-19T12:00:00Z',
    isActive: true
  },
  // ... 48 more deals
];
```

---

## Definition of Done Checklist

### For Each Task
- [ ] Code complete and compiles
- [ ] Unit tests passing
- [ ] Integration tests passing (if applicable)
- [ ] Manually tested in browser
- [ ] Responsive on mobile
- [ ] Accessible (keyboard nav, screen reader)
- [ ] Code reviewed
- [ ] Merged to main

### For MVP Launch
- [ ] All Phase 1-6 tasks complete
- [ ] All tests passing (unit, integration, e2e)
- [ ] Lighthouse score > 90 (performance, accessibility)
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] Mobile tested (iOS Safari, Android Chrome)
- [ ] 50+ seed deals in database
- [ ] Admin can add/edit/delete deals
- [ ] Deployed to production URL
- [ ] Basic analytics installed
- [ ] Error monitoring active

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep | High | High | Strict MVP definition, defer nice-to-haves |
| Data quality | Medium | Medium | Thorough seed data, validation |
| Performance | Medium | Medium | Pagination, lazy loading, caching |
| Mobile issues | Medium | High | Mobile-first development, early testing |
| SEO problems | Low | Medium | SSR with Next.js, meta tags |

---

## Next Steps After MVP

1. **User Accounts** - Save preferences, watchlists
2. **Real API Integration** - Connect to Skyscanner/Amadeus
3. **Price Alerts** - Email notifications for price drops
4. **Price History** - Charts showing historical prices
5. **More Deals** - Automated deal discovery pipeline

---

*This implementation plan should be treated as a living document and updated as development progresses.*
