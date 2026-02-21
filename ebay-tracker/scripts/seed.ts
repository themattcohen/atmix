import { getDb } from '../src/lib/db/client'
import { runMigrations } from '../src/lib/db/migrate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return ISO 8601 datetime string offset from now by `ms` milliseconds. */
function fromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

/** Return ISO 8601 datetime string `ms` milliseconds in the past. */
function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

const HOUR = 3_600_000
const DAY = 86_400_000
const MIN = 60_000

/** Dollars to integer cents. */
function cents(dollars: number): number {
  return Math.round(dollars * 100)
}

// ---------------------------------------------------------------------------
// Item seed data
// ---------------------------------------------------------------------------

interface SeedItem {
  item_id: string
  rank: number | null
  title: string
  current_price: number       // integer cents
  buy_it_now_price: number | null
  shipping_cost: number
  listing_type: string
  condition_name: string | null
  end_time: string | null
  time_left: string | null
  seller_id: string
  seller_feedback: number
  watcher_count: number
  bid_count: number
  image_url: string
  listing_url: string
  status: string
  is_in_queue: number
  notes: string | null
  first_seen_at: string
  last_synced_at: string
}

const IMG = 'https://i.ebayimg.com/images/g/placeholder/s-l225.jpg'
const now = new Date()
const syncedAt = ago(5 * MIN)

const items: SeedItem[] = [
  // --- Ranked items 1-12 ---
  {
    item_id: 'v1|225678901234|0',
    rank: 1,
    title: '2023 Topps Chrome Elly De La Cruz RC Auto /25 PSA 10',
    current_price: cents(1250),
    buy_it_now_price: null,
    shipping_cost: cents(14.99),
    listing_type: 'Auction',
    condition_name: 'Ungraded',
    end_time: fromNow(2 * HOUR),
    time_left: 'PT2H',
    seller_id: 'waxbreaks_elite',
    seller_feedback: 4823,
    watcher_count: 47,
    bid_count: 15,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/225678901234',
    status: 'Active',
    is_in_queue: 1,
    notes: 'Hot card — ending very soon',
    first_seen_at: ago(10 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|334512098765|0',
    rank: 2,
    title: '1986 Fleer Michael Jordan Rookie #57 BGS 9.5',
    current_price: cents(28500),
    buy_it_now_price: null,
    shipping_cost: cents(29.99),
    listing_type: 'Auction',
    condition_name: 'Graded',
    end_time: fromNow(8 * HOUR),
    time_left: 'PT8H',
    seller_id: 'vintage_hoops_inc',
    seller_feedback: 12450,
    watcher_count: 156,
    bid_count: 23,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/334512098765',
    status: 'Active',
    is_in_queue: 1,
    notes: 'Grail card — set max bid',
    first_seen_at: ago(7 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|276543210987|0',
    rank: 3,
    title: '2024 Bowman Chrome Ethan Salas 1st Auto Gold /50',
    current_price: cents(875),
    buy_it_now_price: cents(1200),
    shipping_cost: cents(9.99),
    listing_type: 'AuctionWithBIN',
    condition_name: 'Ungraded',
    end_time: fromNow(1 * DAY),
    time_left: 'P1D',
    seller_id: 'prospect_kings',
    seller_feedback: 2341,
    watcher_count: 34,
    bid_count: 8,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/276543210987',
    status: 'Active',
    is_in_queue: 1,
    notes: null,
    first_seen_at: ago(5 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|185432167890|0',
    rank: 4,
    title: 'PSA 10 2001 SP Authentic Tiger Woods RC /900',
    current_price: cents(4500),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'FixedPrice',
    condition_name: 'Graded',
    end_time: fromNow(28 * DAY),
    time_left: 'P28D',
    seller_id: 'golfcard_vault',
    seller_feedback: 8765,
    watcher_count: 89,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/185432167890',
    status: 'Active',
    is_in_queue: 1,
    notes: 'Free shipping — good deal',
    first_seen_at: ago(12 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|404876543210|0',
    rank: 5,
    title: '1993 SP Derek Jeter Foil Rookie #279 PSA 9',
    current_price: cents(3200),
    buy_it_now_price: null,
    shipping_cost: cents(19.99),
    listing_type: 'Auction',
    condition_name: 'Graded',
    end_time: fromNow(3 * DAY),
    time_left: 'P3D',
    seller_id: 'nyyanks_collector',
    seller_feedback: 5609,
    watcher_count: 67,
    bid_count: 19,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/404876543210',
    status: 'Active',
    is_in_queue: 1,
    notes: null,
    first_seen_at: ago(8 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|156789012345|0',
    rank: 6,
    title: '2024 Panini Prizm Caitlin Clark Silver RC',
    current_price: cents(425),
    buy_it_now_price: null,
    shipping_cost: cents(5.49),
    listing_type: 'FixedPrice',
    condition_name: 'Ungraded',
    end_time: fromNow(25 * DAY),
    time_left: 'P25D',
    seller_id: 'hoopscards_daily',
    seller_feedback: 15234,
    watcher_count: 203,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/156789012345',
    status: 'Active',
    is_in_queue: 0,
    notes: 'Massive watcher count — price may rise',
    first_seen_at: ago(4 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|512345678901|0',
    rank: 7,
    title: 'Vintage 1952 Topps Mickey Mantle #311 SGC 3',
    current_price: cents(45000),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'Auction',
    condition_name: 'Graded',
    end_time: fromNow(5 * DAY),
    time_left: 'P5D',
    seller_id: 'heritage_cards_usa',
    seller_feedback: 34521,
    watcher_count: 312,
    bid_count: 31,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/512345678901',
    status: 'Active',
    is_in_queue: 0,
    notes: 'The holy grail — even SGC 3 is insane',
    first_seen_at: ago(14 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|298765432109|0',
    rank: 8,
    title: '2023 Topps Chrome Jasson Dominguez RC Refractor Auto',
    current_price: cents(340),
    buy_it_now_price: null,
    shipping_cost: cents(7.99),
    listing_type: 'Auction',
    condition_name: 'Ungraded',
    end_time: fromNow(6 * HOUR),
    time_left: 'PT6H',
    seller_id: 'bronxbomber_cards',
    seller_feedback: 1892,
    watcher_count: 28,
    bid_count: 12,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/298765432109',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(6 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|367890123456|0',
    rank: 9,
    title: '1997 PMG Kobe Bryant Green /10 BGS 8.5',
    current_price: cents(18750),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'FixedPrice',
    condition_name: 'Graded',
    end_time: fromNow(30 * DAY),
    time_left: 'P30D',
    seller_id: 'mamba_vault',
    seller_feedback: 6744,
    watcher_count: 45,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/367890123456',
    status: 'Active',
    is_in_queue: 0,
    notes: 'Pop 3 — extremely rare',
    first_seen_at: ago(11 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|445678901234|0',
    rank: 10,
    title: '2024 Topps Series 1 Paul Skenes RC SP #US300',
    current_price: cents(89.99),
    buy_it_now_price: null,
    shipping_cost: cents(4.49),
    listing_type: 'FixedPrice',
    condition_name: 'Ungraded',
    end_time: fromNow(20 * DAY),
    time_left: 'P20D',
    seller_id: 'steelcity_cards',
    seller_feedback: 9823,
    watcher_count: 156,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/445678901234',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(3 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|523456789012|0',
    rank: 11,
    title: 'Sealed 2003-04 Upper Deck Exquisite Collection Box',
    current_price: cents(125000),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'Auction',
    condition_name: 'Factory Sealed',
    end_time: fromNow(4 * DAY),
    time_left: 'P4D',
    seller_id: 'ultra_rare_wax',
    seller_feedback: 2103,
    watcher_count: 78,
    bid_count: 5,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/523456789012',
    status: 'Active',
    is_in_queue: 0,
    notes: 'LeBron RC autos possible — insane box',
    first_seen_at: ago(9 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|601234567890|0',
    rank: 12,
    title: '2020 Panini National Treasures Justin Herbert RPA /99',
    current_price: cents(2100),
    buy_it_now_price: null,
    shipping_cost: cents(14.99),
    listing_type: 'Auction',
    condition_name: 'Ungraded',
    end_time: fromNow(12 * HOUR),
    time_left: 'PT12H',
    seller_id: 'gridiron_gems',
    seller_feedback: 7812,
    watcher_count: 41,
    bid_count: 16,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/601234567890',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(6 * DAY),
    last_synced_at: syncedAt,
  },

  // --- Unranked items ---
  {
    item_id: 'v1|712345678901|0',
    rank: null,
    title: '2024 Topps Chrome Update Shohei Ohtani Refractor',
    current_price: cents(45),
    buy_it_now_price: null,
    shipping_cost: cents(3.99),
    listing_type: 'FixedPrice',
    condition_name: 'Ungraded',
    end_time: fromNow(18 * DAY),
    time_left: 'P18D',
    seller_id: 'ohtani_fanshop',
    seller_feedback: 3456,
    watcher_count: 89,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/712345678901',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(2 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|823456789012|0',
    rank: null,
    title: 'Lot of 50 Vintage Baseball Cards 1960s-1970s',
    current_price: cents(125),
    buy_it_now_price: null,
    shipping_cost: cents(8.99),
    listing_type: 'Auction',
    condition_name: 'Used',
    end_time: fromNow(2 * DAY),
    time_left: 'P2D',
    seller_id: 'grandpas_attic_cards',
    seller_feedback: 876,
    watcher_count: 12,
    bid_count: 4,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/823456789012',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(5 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|934567890123|0',
    rank: null,
    title: 'BGS 9 2018 Prizm Luka Doncic Silver RC',
    current_price: cents(1850),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'FixedPrice',
    condition_name: 'Graded',
    end_time: fromNow(22 * DAY),
    time_left: 'P22D',
    seller_id: 'dallas_card_co',
    seller_feedback: 4567,
    watcher_count: 67,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/934567890123',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(8 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|145678901234|0',
    rank: null,
    title: '1989 Upper Deck Ken Griffey Jr Rookie PSA 10',
    current_price: cents(550),
    buy_it_now_price: null,
    shipping_cost: cents(9.99),
    listing_type: 'Auction',
    condition_name: 'Graded',
    end_time: fromNow(18 * HOUR),
    time_left: 'PT18H',
    seller_id: 'seattle_card_king',
    seller_feedback: 3210,
    watcher_count: 34,
    bid_count: 9,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/145678901234',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(4 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|256789012345|0',
    rank: null,
    title: 'Complete 1987 Topps Baseball Set in Binder',
    current_price: cents(175),
    buy_it_now_price: null,
    shipping_cost: cents(12.99),
    listing_type: 'FixedPrice',
    condition_name: 'Used',
    end_time: fromNow(15 * DAY),
    time_left: 'P15D',
    seller_id: 'retrobase_cards',
    seller_feedback: 2109,
    watcher_count: 23,
    bid_count: 0,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/256789012345',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(6 * DAY),
    last_synced_at: syncedAt,
  },
  {
    item_id: 'v1|367801234567|0',
    rank: null,
    title: '2024 Panini Select Trevor Lawrence Gold /10',
    current_price: cents(780),
    buy_it_now_price: null,
    shipping_cost: cents(6.99),
    listing_type: 'Auction',
    condition_name: 'Ungraded',
    end_time: fromNow(3 * DAY),
    time_left: 'P3D',
    seller_id: 'jaxville_sports',
    seller_feedback: 1567,
    watcher_count: 19,
    bid_count: 7,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/367801234567',
    status: 'Active',
    is_in_queue: 0,
    notes: null,
    first_seen_at: ago(3 * DAY),
    last_synced_at: syncedAt,
  },

  // --- Sold items ---
  {
    item_id: 'v1|478901234567|0',
    rank: null,
    title: '2023 Bowman Chrome Victor Wembanyama 1st RC Auto',
    current_price: cents(3400),
    buy_it_now_price: null,
    shipping_cost: cents(19.99),
    listing_type: 'Auction',
    condition_name: 'Ungraded',
    end_time: ago(1 * DAY),
    time_left: null,
    seller_id: 'spurs_card_shop',
    seller_feedback: 8901,
    watcher_count: 245,
    bid_count: 37,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/478901234567',
    status: 'Sold',
    is_in_queue: 0,
    notes: 'Sold above expected — market is hot',
    first_seen_at: ago(10 * DAY),
    last_synced_at: ago(1 * DAY),
  },
  {
    item_id: 'v1|589012345678|0',
    rank: null,
    title: '1986-87 Fleer Basketball Complete Set PSA Graded',
    current_price: cents(52000),
    buy_it_now_price: null,
    shipping_cost: 0,
    listing_type: 'Auction',
    condition_name: 'Graded',
    end_time: ago(2 * DAY),
    time_left: null,
    seller_id: 'hall_of_fame_cards',
    seller_feedback: 22456,
    watcher_count: 167,
    bid_count: 42,
    image_url: IMG,
    listing_url: 'https://www.ebay.com/itm/589012345678',
    status: 'Sold',
    is_in_queue: 0,
    notes: 'Includes the Jordan RC — monster set',
    first_seen_at: ago(12 * DAY),
    last_synced_at: ago(2 * DAY),
  },
]

// ---------------------------------------------------------------------------
// Price snapshot generation
// ---------------------------------------------------------------------------

interface SnapshotRow {
  item_id: string
  price_cents: number
  shipping: number
  watcher_count: number | null
  bid_count: number
  recorded_at: string
}

function generateSnapshots(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const finalPrice = item.current_price
  const isAuction = item.listing_type === 'Auction' || item.listing_type === 'AuctionWithBIN'
  const isFixed = item.listing_type === 'FixedPrice'

  for (let i = 0; i < count; i++) {
    const hoursAgo = (count - i) * (168 / count) // spread across ~7 days (168 hours)
    const recordedAt = ago(hoursAgo * HOUR)

    let price: number
    let bids: number
    let watchers: number

    if (isAuction) {
      // Auctions: start low, gradually increase to current price
      const progress = i / (count - 1)
      // Start at 15-40% of final, curve up to 100%
      const startFraction = 0.15 + Math.random() * 0.25
      const priceFraction = startFraction + (1 - startFraction) * Math.pow(progress, 1.3)
      price = Math.round(finalPrice * priceFraction)

      // Bids increase over time
      bids = Math.round(item.bid_count * progress)
      // Watchers climb with some noise
      watchers = Math.round((item.watcher_count || 0) * (0.3 + 0.7 * progress) + (Math.random() * 5 - 2))
    } else {
      // Fixed price: mostly stable, occasional changes
      price = finalPrice
      // Introduce a 20% chance of a higher historical price (simulating a price drop)
      if (i < count - 2 && Math.random() < 0.2) {
        price = Math.round(finalPrice * (1.05 + Math.random() * 0.15))
      }
      bids = 0
      watchers = Math.round((item.watcher_count || 0) * (0.4 + 0.6 * (i / (count - 1))) + (Math.random() * 3 - 1))
    }

    if (watchers < 0) watchers = 0

    snapshots.push({
      item_id: item.item_id,
      price_cents: price,
      shipping: item.shipping_cost,
      watcher_count: watchers,
      bid_count: bids,
      recorded_at: recordedAt,
    })
  }

  return snapshots
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

interface EventRow {
  item_id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  detected_at: string
}

function buildEvents(): EventRow[] {
  const events: EventRow[] = []

  // 2 "sold" events for items 19-20
  events.push({
    item_id: 'v1|478901234567|0',
    event_type: 'sold',
    old_value: String(cents(2800)),
    new_value: String(cents(3400)),
    detected_at: ago(1 * DAY),
  })
  events.push({
    item_id: 'v1|589012345678|0',
    event_type: 'sold',
    old_value: String(cents(47000)),
    new_value: String(cents(52000)),
    detected_at: ago(2 * DAY),
  })

  // 4 "price_drop" events
  events.push({
    item_id: 'v1|156789012345|0', // Caitlin Clark
    event_type: 'price_drop',
    old_value: String(cents(475)),
    new_value: String(cents(425)),
    detected_at: ago(2 * DAY),
  })
  events.push({
    item_id: 'v1|934567890123|0', // Luka Doncic
    event_type: 'price_drop',
    old_value: String(cents(2100)),
    new_value: String(cents(1850)),
    detected_at: ago(3 * DAY),
  })
  events.push({
    item_id: 'v1|445678901234|0', // Paul Skenes
    event_type: 'price_drop',
    old_value: String(cents(99.99)),
    new_value: String(cents(89.99)),
    detected_at: ago(1 * DAY),
  })
  events.push({
    item_id: 'v1|256789012345|0', // 1987 Topps Set
    event_type: 'price_drop',
    old_value: String(cents(199)),
    new_value: String(cents(175)),
    detected_at: ago(4 * DAY),
  })

  // 3 "price_increase" events (auctions heating up)
  events.push({
    item_id: 'v1|334512098765|0', // Jordan RC
    event_type: 'price_increase',
    old_value: String(cents(24000)),
    new_value: String(cents(28500)),
    detected_at: ago(6 * HOUR),
  })
  events.push({
    item_id: 'v1|512345678901|0', // Mantle
    event_type: 'price_increase',
    old_value: String(cents(38000)),
    new_value: String(cents(45000)),
    detected_at: ago(12 * HOUR),
  })
  events.push({
    item_id: 'v1|225678901234|0', // Elly De La Cruz
    event_type: 'price_increase',
    old_value: String(cents(980)),
    new_value: String(cents(1250)),
    detected_at: ago(3 * HOUR),
  })

  // 3 "watcher_spike" events
  events.push({
    item_id: 'v1|156789012345|0', // Caitlin Clark — 203 watchers
    event_type: 'watcher_spike',
    old_value: '145',
    new_value: '203',
    detected_at: ago(8 * HOUR),
  })
  events.push({
    item_id: 'v1|512345678901|0', // Mantle — 312 watchers
    event_type: 'watcher_spike',
    old_value: '210',
    new_value: '312',
    detected_at: ago(1 * DAY),
  })
  events.push({
    item_id: 'v1|478901234567|0', // Wembanyama (before sold)
    event_type: 'watcher_spike',
    old_value: '160',
    new_value: '245',
    detected_at: ago(2 * DAY + 6 * HOUR),
  })

  // 1 "expired" event (simulate an old listing that expired and relisted)
  events.push({
    item_id: 'v1|367890123456|0', // Kobe PMG
    event_type: 'expired',
    old_value: null,
    new_value: null,
    detected_at: ago(5 * DAY),
  })

  return events
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

function seed() {
  console.log('Running migrations...')
  runMigrations()

  const db = getDb()

  console.log('Clearing existing data...')
  db.exec('DELETE FROM events')
  db.exec('DELETE FROM price_snapshots')
  db.exec('DELETE FROM items')

  // Insert items
  const insertItem = db.prepare(`
    INSERT INTO items (
      item_id, rank, title, current_price, buy_it_now_price, shipping_cost,
      listing_type, condition_name, end_time, time_left, seller_id, seller_feedback,
      watcher_count, bid_count, image_url, listing_url, status, is_in_queue,
      notes, first_seen_at, last_synced_at
    ) VALUES (
      @item_id, @rank, @title, @current_price, @buy_it_now_price, @shipping_cost,
      @listing_type, @condition_name, @end_time, @time_left, @seller_id, @seller_feedback,
      @watcher_count, @bid_count, @image_url, @listing_url, @status, @is_in_queue,
      @notes, @first_seen_at, @last_synced_at
    )
  `)

  const insertItems = db.transaction(() => {
    for (const item of items) {
      insertItem.run(item)
    }
  })
  insertItems()
  console.log(`Inserted ${items.length} items`)

  // Generate and insert snapshots
  const insertSnapshot = db.prepare(`
    INSERT INTO price_snapshots (item_id, price_cents, shipping, watcher_count, bid_count, recorded_at)
    VALUES (@item_id, @price_cents, @shipping, @watcher_count, @bid_count, @recorded_at)
  `)

  let snapshotCount = 0
  const insertSnapshots = db.transaction(() => {
    for (const item of items) {
      const count = 10 + Math.floor(Math.random() * 6) // 10-15 snapshots per item
      const snapshots = generateSnapshots(item, count)
      for (const snap of snapshots) {
        insertSnapshot.run(snap)
        snapshotCount++
      }
    }
  })
  insertSnapshots()
  console.log(`Inserted ${snapshotCount} price snapshots`)

  // Insert events
  const insertEvent = db.prepare(`
    INSERT INTO events (item_id, event_type, old_value, new_value, detected_at)
    VALUES (@item_id, @event_type, @old_value, @new_value, @detected_at)
  `)

  const eventRows = buildEvents()
  const insertEvents = db.transaction(() => {
    for (const ev of eventRows) {
      insertEvent.run(ev)
    }
  })
  insertEvents()
  console.log(`Inserted ${eventRows.length} events`)

  // Summary
  const rankedCount = items.filter(i => i.rank !== null).length
  const unrankedCount = items.filter(i => i.rank === null && i.status === 'Active').length
  const soldCount = items.filter(i => i.status === 'Sold').length

  console.log(`\nSeeded: ${items.length} items (${rankedCount} ranked, ${unrankedCount} unranked, ${soldCount} sold), ${snapshotCount} snapshots, ${eventRows.length} events`)
}

seed()
