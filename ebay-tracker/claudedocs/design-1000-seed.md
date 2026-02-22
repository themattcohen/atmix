# Design Document: 1000-Item Seed Redesign

**Feature**: Large-scale seed data + pagination for eBay Watchlist Monitor
**Author**: Design session 2026-02-21
**Status**: Ready for implementation
**Effort estimate**: ~4 hours

---

## 1. Overview

### Why 1000 Items

The current seed generates 20 items. That is sufficient to verify functional correctness but fails to surface three classes of real-world problems:

1. **Pagination performance**: SQLite returning 1,000 rows to a Next.js API route in one query, serializing 1,000 JSON objects, and React rendering them in a single pass is a workload the UI has never faced. Any performance cliff will show up immediately.
2. **dnd-kit at scale**: Calling `useSortable` on every row in the watchlist table is fine at 20 rows. At 200 ranked items the hook count is still manageable. At 800 unranked items it becomes a guaranteed performance problem. The redesign validates the split-component strategy.
3. **Distribution realism**: A single page of 20 cards cannot test that the status filter, listing-type filter, and price range display behave correctly across realistic proportions. 1,000 items with enforced distributions make these paths exercisable.

### What Changes

| Layer | Change |
|-------|--------|
| `scripts/seed.ts` | Full rewrite: generators, distributions, mandatory items, 16,450 rows |
| `src/lib/db/items.ts` | Add `getUnrankedPage()` function for paginated unranked fetch |
| `src/app/api/items/route.ts` | Accept `?offset=` and `?limit=` for unranked section; response shape adds `unrankedTotal` |
| `src/components/watchlist/watchlist-table.tsx` | Render ranked via `SortableWatchlistRow`, unranked via `StaticWatchlistRow` with Load More |
| `src/components/watchlist/watchlist-row.tsx` | Renamed to `sortable-watchlist-row.tsx`, no other logic changes |
| `src/components/watchlist/static-watchlist-row.tsx` | New file: identical layout, no `useSortable` hook |
| `tests/e2e/seed-integrity.spec.ts` | New file: seed data integrity checks |
| `tests/e2e/pagination.spec.ts` | New file: Load More pagination tests |

---

## 2. Seed Generator Architecture

### 2.1 Top-Level Execution Plan

```
seed()
  ├─ runMigrations()
  ├─ clearTables()
  ├─ buildItemPool()          → ItemDef[1000]
  │    ├─ buildMandatoryItems()    → ItemDef[20]  (exact titles and prices)
  │    └─ buildGeneratedItems()    → ItemDef[980] (distribution-controlled)
  ├─ insertItems()            → 1,000 rows into items table
  ├─ insertSnapshots()        → ~12,000 rows into price_snapshots
  └─ insertEvents()           → ~3,000 rows into events
```

All three bulk inserts use `db.transaction()` for atomicity and performance. A single transaction for 1,000 items is approximately 10x faster than 1,000 individual commits in better-sqlite3.

### 2.2 Shared Constants and Utilities

```typescript
// scripts/seed.ts — top of file, replaces current constants

const HOUR = 3_600_000
const DAY  = 86_400_000
const MIN  = 60_000

function fromNow(ms: number): string { return new Date(Date.now() + ms).toISOString() }
function ago(ms: number): string      { return new Date(Date.now() - ms).toISOString() }
function cents(dollars: number): number { return Math.round(dollars * 100) }

/** Deterministic pseudo-random using a seeded LCG so the DB is reproducible. */
class SeededRng {
  private state: number
  constructor(seed = 42) { this.state = seed }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff
    return (this.state >>> 0) / 0x100000000
  }
  between(lo: number, hi: number): number { return lo + this.next() * (hi - lo) }
  int(lo: number, hi: number): number { return Math.floor(this.between(lo, hi + 1)) }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

const rng = new SeededRng(42)
```

Using a seeded RNG makes the seed output deterministic across runs. The same 1,000 items are produced every time `npx tsx scripts/seed.ts` runs, which is critical for E2E tests that assert specific item properties.

### 2.3 Player Pool Data Structures

```typescript
interface Player {
  name: string
  sport: Sport
  position: string
  team: string
  peakYears: [number, number]   // year range for "1st year" cards
  tier: 'superstar' | 'star' | 'prospect' | 'legend'
}

type Sport = 'baseball' | 'football' | 'basketball' | 'hockey' | 'nonsport'

const PLAYERS: Player[] = [
  // Baseball (28 players)
  { name: 'Mike Trout',          sport: 'baseball',    position: 'CF',  team: 'Angels',    peakYears: [2011, 2012], tier: 'superstar' },
  { name: 'Shohei Ohtani',       sport: 'baseball',    position: 'P/DH',team: 'Dodgers',   peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Ronald Acuña Jr',     sport: 'baseball',    position: 'RF',  team: 'Braves',    peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Juan Soto',           sport: 'baseball',    position: 'RF',  team: 'Mets',      peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Fernando Tatis Jr',   sport: 'baseball',    position: 'SS',  team: 'Padres',    peakYears: [2019, 2019], tier: 'superstar' },
  { name: 'Wander Franco',       sport: 'baseball',    position: 'SS',  team: 'Rays',      peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Gunnar Henderson',    sport: 'baseball',    position: 'SS',  team: 'Orioles',   peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Jackson Holliday',    sport: 'baseball',    position: '2B',  team: 'Orioles',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Paul Skenes',         sport: 'baseball',    position: 'SP',  team: 'Pirates',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Elly De La Cruz',     sport: 'baseball',    position: 'SS',  team: 'Reds',      peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Julio Rodriguez',     sport: 'baseball',    position: 'CF',  team: 'Mariners',  peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Jasson Dominguez',    sport: 'baseball',    position: 'CF',  team: 'Yankees',   peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Ethan Salas',         sport: 'baseball',    position: 'C',   team: 'Padres',    peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Derek Jeter',         sport: 'baseball',    position: 'SS',  team: 'Yankees',   peakYears: [1993, 1993], tier: 'legend'    },
  { name: 'Mickey Mantle',       sport: 'baseball',    position: 'CF',  team: 'Yankees',   peakYears: [1952, 1955], tier: 'legend'    },
  { name: 'Ken Griffey Jr',      sport: 'baseball',    position: 'CF',  team: 'Mariners',  peakYears: [1989, 1989], tier: 'legend'    },
  { name: 'Nolan Ryan',          sport: 'baseball',    position: 'SP',  team: 'Rangers',   peakYears: [1973, 1973], tier: 'legend'    },
  { name: 'Hank Aaron',          sport: 'baseball',    position: 'RF',  team: 'Braves',    peakYears: [1954, 1954], tier: 'legend'    },
  { name: 'Pete Alonso',         sport: 'baseball',    position: '1B',  team: 'Mets',      peakYears: [2019, 2019], tier: 'star'      },
  { name: 'Yordan Alvarez',      sport: 'baseball',    position: 'DH',  team: 'Astros',    peakYears: [2019, 2019], tier: 'star'      },
  { name: 'Adley Rutschman',     sport: 'baseball',    position: 'C',   team: 'Orioles',   peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Bobby Witt Jr',       sport: 'baseball',    position: 'SS',  team: 'Royals',    peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Corbin Carroll',      sport: 'baseball',    position: 'CF',  team: 'Dbacks',    peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Spencer Jones',       sport: 'baseball',    position: 'OF',  team: 'Yankees',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Kyle Harrison',       sport: 'baseball',    position: 'SP',  team: 'Giants',    peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'James Wood',          sport: 'baseball',    position: 'OF',  team: 'Nationals', peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jackson Chourio',     sport: 'baseball',    position: 'OF',  team: 'Brewers',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Wyatt Langford',      sport: 'baseball',    position: 'OF',  team: 'Rangers',   peakYears: [2024, 2024], tier: 'prospect'  },

  // Football (20 players)
  { name: 'Patrick Mahomes',     sport: 'football',   position: 'QB',  team: 'Chiefs',    peakYears: [2017, 2017], tier: 'superstar' },
  { name: 'Caleb Williams',      sport: 'football',   position: 'QB',  team: 'Bears',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'C.J. Stroud',         sport: 'football',   position: 'QB',  team: 'Texans',    peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Justin Herbert',      sport: 'football',   position: 'QB',  team: 'Chargers',  peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Joe Burrow',          sport: 'football',   position: 'QB',  team: 'Bengals',   peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Trevor Lawrence',     sport: 'football',   position: 'QB',  team: 'Jaguars',   peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Brock Purdy',         sport: 'football',   position: 'QB',  team: '49ers',     peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Drake Maye',          sport: 'football',   position: 'QB',  team: 'Patriots',  peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Marvin Harrison Jr',  sport: 'football',   position: 'WR',  team: 'Cardinals', peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Puka Nacua',          sport: 'football',   position: 'WR',  team: 'Rams',      peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Tyreek Hill',         sport: 'football',   position: 'WR',  team: 'Dolphins',  peakYears: [2016, 2016], tier: 'superstar' },
  { name: 'Justin Jefferson',    sport: 'football',   position: 'WR',  team: 'Vikings',   peakYears: [2020, 2020], tier: 'superstar' },
  { name: 'Ja Morant',           sport: 'football',   position: 'RB',  team: 'Titans',    peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Brian Thomas Jr',     sport: 'football',   position: 'WR',  team: 'Jaguars',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jahmyr Gibbs',        sport: 'football',   position: 'RB',  team: 'Lions',     peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Lamar Jackson',       sport: 'football',   position: 'QB',  team: 'Ravens',    peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Josh Allen',          sport: 'football',   position: 'QB',  team: 'Bills',     peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Bo Nix',              sport: 'football',   position: 'QB',  team: 'Broncos',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jayden Daniels',      sport: 'football',   position: 'QB',  team: 'Commanders',peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Rome Odunze',         sport: 'football',   position: 'WR',  team: 'Bears',     peakYears: [2024, 2024], tier: 'prospect'  },

  // Basketball (19 players)
  { name: 'Victor Wembanyama',   sport: 'basketball', position: 'C',   team: 'Spurs',     peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Luka Doncic',         sport: 'basketball', position: 'PG',  team: 'Lakers',    peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Giannis Antetokounmpo',sport:'basketball', position: 'PF',  team: 'Bucks',     peakYears: [2013, 2013], tier: 'superstar' },
  { name: 'Stephen Curry',       sport: 'basketball', position: 'PG',  team: 'Warriors',  peakYears: [2009, 2009], tier: 'superstar' },
  { name: 'Anthony Edwards',     sport: 'basketball', position: 'SG',  team: 'Timberwolves',peakYears:[2020,2020], tier: 'star'      },
  { name: 'Nikola Jokic',        sport: 'basketball', position: 'C',   team: 'Nuggets',   peakYears: [2015, 2015], tier: 'superstar' },
  { name: 'LeBron James',        sport: 'basketball', position: 'SF',  team: 'Lakers',    peakYears: [2003, 2003], tier: 'legend'    },
  { name: 'Michael Jordan',      sport: 'basketball', position: 'SG',  team: 'Bulls',     peakYears: [1984, 1986], tier: 'legend'    },
  { name: 'Kobe Bryant',         sport: 'basketball', position: 'SG',  team: 'Lakers',    peakYears: [1996, 1996], tier: 'legend'    },
  { name: 'Caitlin Clark',       sport: 'basketball', position: 'PG',  team: 'Fever',     peakYears: [2024, 2024], tier: 'star'      },
  { name: 'Zaccharie Risacher',  sport: 'basketball', position: 'SF',  team: 'Hawks',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Alexandre Sarr',      sport: 'basketball', position: 'C',   team: 'Wizards',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Stephon Castle',      sport: 'basketball', position: 'SG',  team: 'Spurs',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jaylen Wells',        sport: 'basketball', position: 'SG',  team: 'Grizzlies', peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Donovan Mitchell',    sport: 'basketball', position: 'SG',  team: 'Cavaliers', peakYears: [2017, 2017], tier: 'star'      },
  { name: 'Tyrese Haliburton',   sport: 'basketball', position: 'PG',  team: 'Pacers',    peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Evan Mobley',         sport: 'basketball', position: 'C',   team: 'Cavaliers', peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Paolo Banchero',      sport: 'basketball', position: 'PF',  team: 'Magic',     peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Scottie Barnes',      sport: 'basketball', position: 'SF',  team: 'Raptors',   peakYears: [2021, 2021], tier: 'star'      },

  // Hockey (8 players)
  { name: 'Connor McDavid',      sport: 'hockey',     position: 'C',   team: 'Oilers',    peakYears: [2015, 2015], tier: 'superstar' },
  { name: 'Connor Bedard',       sport: 'hockey',     position: 'C',   team: 'Blackhawks',peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Cale Makar',          sport: 'hockey',     position: 'D',   team: 'Avalanche', peakYears: [2019, 2019], tier: 'superstar' },
  { name: 'Auston Matthews',     sport: 'hockey',     position: 'C',   team: 'Maple Leafs',peakYears:[2016,2016],  tier: 'superstar' },
  { name: 'Nathan MacKinnon',    sport: 'hockey',     position: 'C',   team: 'Avalanche', peakYears: [2013, 2013], tier: 'superstar' },
  { name: 'Leon Draisaitl',      sport: 'hockey',     position: 'C',   team: 'Oilers',    peakYears: [2014, 2014], tier: 'star'      },
  { name: 'David Pastrnak',      sport: 'hockey',     position: 'RW',  team: 'Bruins',    peakYears: [2014, 2014], tier: 'star'      },
  { name: 'Jack Hughes',         sport: 'hockey',     position: 'C',   team: 'Devils',    peakYears: [2019, 2019], tier: 'star'      },

  // Non-sport (10 entries)
  { name: 'Charizard Holo 1st Ed',sport:'nonsport',   position: '',    team: 'Pokemon',   peakYears: [1999, 1999], tier: 'legend'    },
  { name: 'Pikachu Illustrator',  sport:'nonsport',   position: '',    team: 'Pokemon',   peakYears: [1998, 1998], tier: 'legend'    },
  { name: 'Blastoise Base Set',   sport:'nonsport',   position: '',    team: 'Pokemon',   peakYears: [1999, 1999], tier: 'star'      },
  { name: 'Black Lotus Alpha',    sport:'nonsport',   position: '',    team: 'Magic',     peakYears: [1993, 1993], tier: 'legend'    },
  { name: 'Mox Sapphire',         sport:'nonsport',   position: '',    team: 'Magic',     peakYears: [1993, 1993], tier: 'legend'    },
  { name: 'Blue-Eyes White Dragon',sport:'nonsport',  position: '',    team: 'Yu-Gi-Oh',  peakYears: [2002, 2002], tier: 'star'      },
  { name: 'Luke Skywalker',        sport:'nonsport',  position: '',    team: 'Star Wars', peakYears: [1977, 1977], tier: 'star'      },
  { name: 'Spider-Man',            sport:'nonsport',  position: '',    team: 'Marvel',    peakYears: [1990, 1990], tier: 'star'      },
  { name: 'Darth Vader',           sport:'nonsport',  position: '',    team: 'Star Wars', peakYears: [1977, 1977], tier: 'star'      },
  { name: 'Iron Man',              sport:'nonsport',  position: '',    team: 'Marvel',    peakYears: [1990, 1990], tier: 'star'      },
]
```

### 2.4 Brand/Set Pools Per Sport

```typescript
interface CardSet {
  brand: string
  setName: string
  yearRange: [number, number]
  hasAutos: boolean
  hasPrizm: boolean
  hasRefractor: boolean
  parallel: string[]    // named parallels available
}

const SETS: Record<Sport, CardSet[]> = {
  baseball: [
    { brand: 'Topps',    setName: 'Topps Series 1',     yearRange: [2000, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold', 'Black', 'Independence Day'] },
    { brand: 'Topps',    setName: 'Topps Chrome',        yearRange: [1996, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor', 'Orange Refractor', 'Red Refractor', 'SuperFractor'] },
    { brand: 'Topps',    setName: 'Bowman Chrome',       yearRange: [2000, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Green Refractor', 'Blue Refractor', 'Gold /50', 'Orange /25', 'Red /5'] },
    { brand: 'Topps',    setName: 'Topps Heritage',      yearRange: [2001, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Chrome', 'Real One Auto'] },
    { brand: 'Topps',    setName: 'Stadium Club',        yearRange: [1991, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Chrome', 'Black Foil'] },
    { brand: 'Topps',    setName: 'Finest',              yearRange: [1993, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor /25'] },
    { brand: 'Panini',   setName: 'Immaculate Collection',yearRange:[2012,2024],  hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Onyx', 'Platinum'] },
    { brand: 'Upper Deck',setName:'Upper Deck Series 1', yearRange: [1989, 2010], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold Hologram'] },
    { brand: 'Topps',    setName: 'Topps Update',        yearRange: [2005, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold', 'Rainbow Foil'] },
    { brand: 'Topps',    setName: 'Topps Tribute',       yearRange: [2010, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /25', 'Red /10'] },
  ],
  football: [
    { brand: 'Panini',   setName: 'Prizm',               yearRange: [2012, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Green', 'Red/White/Blue', 'Gold /10', 'Black /1'] },
    { brand: 'Panini',   setName: 'Select',              yearRange: [2011, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Gold /10', 'Premier Level Tri-Color'] },
    { brand: 'Panini',   setName: 'National Treasures',  yearRange: [2010, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['RPA /99', 'Gold /25', 'Platinum /1'] },
    { brand: 'Panini',   setName: 'Flawless',            yearRange: [2014, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Ruby /15', 'Emerald /5', 'Sapphire /3'] },
    { brand: 'Donruss',  setName: 'Optic',               yearRange: [2016, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Holo', 'Gold', 'Blue Velocity'] },
    { brand: 'Topps',    setName: 'Chrome',              yearRange: [1996, 2015], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor /25'] },
    { brand: 'Panini',   setName: 'Contenders',          yearRange: [1994, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Championship Ticket', 'Cracked Ice'] },
    { brand: 'Panini',   setName: 'Plates & Patches',   yearRange: [2014, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /49', 'Platinum /1'] },
  ],
  basketball: [
    { brand: 'Panini',   setName: 'Prizm',               yearRange: [2012, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Green', 'Neon Green Pulsar', 'Gold /10', 'Black /1'] },
    { brand: 'Topps',    setName: 'Finest',              yearRange: [1993, 2003], hasAutos: false, hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor'] },
    { brand: 'Fleer',    setName: 'Fleer Basketball',    yearRange: [1986, 2005], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Sticker', 'Game Time'] },
    { brand: 'Upper Deck',setName:'Exquisite Collection', yearRange:[2003, 2012], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /25', 'Platinum /1'] },
    { brand: 'Panini',   setName: 'National Treasures',  yearRange: [2009, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Logoman /1', 'Gold /10'] },
    { brand: 'Bowman',   setName: 'Bowman Best',         yearRange: [2023, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Green /99', 'Gold /50'] },
    { brand: 'Panini',   setName: 'Select',              yearRange: [2014, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Gold /10', 'Tri-Color'] },
  ],
  hockey: [
    { brand: 'Upper Deck',setName:'Young Guns',          yearRange: [1990, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Canvas', 'High Gloss'] },
    { brand: 'Upper Deck',setName:'The Cup',             yearRange: [2005, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Autographed /25', 'Platinum /1'] },
    { brand: 'Upper Deck',setName:'SPx',                 yearRange: [2000, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /100', 'Jersey Auto'] },
    { brand: 'O-Pee-Chee',setName:'O-Pee-Chee Platinum',yearRange: [2015, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Blue Rainbow', 'Gold /35'] },
    { brand: 'Topps',     setName:'Stadium Club Chrome', yearRange: [2021, 2024], hasAutos: false, hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold /50'] },
  ],
  nonsport: [
    { brand: 'Pokemon',  setName: 'Base Set',            yearRange: [1999, 2000], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition', 'Shadowless', 'Unlimited'] },
    { brand: 'Pokemon',  setName: 'Neo Genesis',         yearRange: [2000, 2001], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition'] },
    { brand: 'Magic',    setName: 'Alpha',               yearRange: [1993, 1993], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: [] },
    { brand: 'Magic',    setName: 'Beta',                yearRange: [1993, 1993], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: [] },
    { brand: 'Yu-Gi-Oh', setName: 'Legend of Blue Eyes', yearRange: [2002, 2002], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition', 'Unlimited'] },
    { brand: 'Topps',    setName: 'Star Wars Galaxy',    yearRange: [1993, 2015], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Foil', 'Chrome'] },
    { brand: 'Upper Deck',setName:'Marvel Masterpieces', yearRange: [1992, 2008], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Canvas', 'Foil'] },
  ],
}
```

### 2.5 Title Generator Function

Title format: `{year} {brand} {setName} {playerName} {variation} {grade}`

Variation is conditionally included based on card set capabilities:

```typescript
function generateTitle(player: Player, set: CardSet, grade: string): string {
  const year = rng.int(set.yearRange[0], set.yearRange[1])
  const parts: string[] = [String(year), set.brand, set.setName, player.name]

  // Add variation based on set type
  if (set.hasRefractor && rng.next() < 0.4) {
    parts.push(rng.pick(['Refractor', 'Gold Refractor', 'Orange Refractor /25', 'Red Refractor /5']))
  } else if (set.hasPrizm && rng.next() < 0.4) {
    parts.push(rng.pick(['Silver', 'Green', 'Neon Green Pulsar', 'Purple', 'Gold /10']))
  } else if (set.parallel.length > 0 && rng.next() < 0.3) {
    parts.push(rng.pick(set.parallel))
  }

  // Add "RC" for rookies (first year cards)
  const isRookieYear = year === player.peakYears[0]
  if (isRookieYear && rng.next() < 0.7) parts.push('RC')

  // Add "Auto" for autograph sets
  if (set.hasAutos && rng.next() < 0.35) parts.push('Auto')

  // Append grade
  if (grade !== 'Raw') parts.push(grade)

  // Truncate to ~80 chars (eBay title limit is 80)
  const title = parts.join(' ')
  return title.length > 80 ? title.slice(0, 77) + '...' : title
}
```

Example outputs:
- `2023 Topps Chrome Gunnar Henderson Refractor RC Auto PSA 10`
- `2024 Panini Prizm Caleb Williams Silver RC`
- `1999 Pokemon Base Set Charizard Holo 1st Ed BGS 9.5`
- `1993 Fleer Fleer Basketball Michael Jordan`

### 2.6 Grade Distribution

```typescript
interface Grade {
  label: string    // display string appended to title
  weight: number   // relative probability
  gradeMultiplier: number  // price multiplier vs raw
}

const GRADES: Grade[] = [
  { label: 'PSA 10',  weight: 15, gradeMultiplier: 4.0  },
  { label: 'PSA 9',   weight: 20, gradeMultiplier: 1.8  },
  { label: 'BGS 9.5', weight: 10, gradeMultiplier: 3.0  },
  { label: 'BGS 9',   weight: 10, gradeMultiplier: 1.5  },
  { label: 'SGC 10',  weight:  5, gradeMultiplier: 3.5  },
  { label: 'SGC 8',   weight:  5, gradeMultiplier: 1.2  },
  { label: 'Raw',     weight: 35, gradeMultiplier: 1.0  },
]

// Weighted random grade picker
function pickGrade(): Grade {
  const total = GRADES.reduce((s, g) => s + g.weight, 0)
  let r = rng.next() * total
  for (const g of GRADES) {
    r -= g.weight
    if (r <= 0) return g
  }
  return GRADES[GRADES.length - 1]
}
```

Condition name mapping for the `condition_name` DB column:

```typescript
function gradeToCondition(grade: Grade): string {
  if (grade.label === 'Raw') return 'Ungraded'
  if (grade.label.startsWith('PSA') || grade.label.startsWith('BGS') || grade.label.startsWith('SGC')) return 'Graded'
  return 'Used'
}
```

### 2.7 Price Generator

Price is generated in two steps: first assign the bucket, then sample uniformly within it.

```typescript
interface PriceBucket {
  minDollars: number
  maxDollars: number
  count: number        // target number of items in this bucket
}

const PRICE_BUCKETS: PriceBucket[] = [
  { minDollars:    1, maxDollars:   25, count: 400 },
  { minDollars:   25, maxDollars:  100, count: 300 },
  { minDollars:  100, maxDollars:  500, count: 200 },
  { minDollars:  500, maxDollars: 2000, count:  70 },
  { minDollars: 2000, maxDollars: 9999, count:  30 },
]

// Pre-build a shuffled bucket assignment array of length 1000
function buildBucketAssignments(): PriceBucket[] {
  const assignments: PriceBucket[] = []
  for (const bucket of PRICE_BUCKETS) {
    for (let i = 0; i < bucket.count; i++) {
      assignments.push(bucket)
    }
  }
  return rng.shuffle(assignments)  // 1000-element shuffled array
}
```

The bucket assignment array is pre-shuffled so each item at index `i` gets deterministically assigned to a bucket while respecting exact counts. The price within the bucket is then sampled with an exponential bias toward the lower end (more cheap cards than expensive within the bucket):

```typescript
function priceFromBucket(bucket: PriceBucket): number {
  // Log-uniform sample: bias toward lower end of range
  const logLo  = Math.log(bucket.minDollars)
  const logHi  = Math.log(bucket.maxDollars)
  const logVal = logLo + rng.next() * (logHi - logLo)
  const dollars = Math.exp(logVal)
  // Apply grade multiplier separately — done in caller
  return cents(Math.round(dollars * 100) / 100)
}
```

Grade multiplier is applied after sampling to keep bucket assignments accurate:

```typescript
function generatePrice(bucket: PriceBucket, grade: Grade): number {
  const base = priceFromBucket(bucket)
  // Clamp within bucket even after grade multiplier
  const multiplied = Math.round(base * grade.gradeMultiplier)
  return Math.min(multiplied, cents(bucket.maxDollars * 2))
}
```

### 2.8 Snapshot Pattern Generators

Each item gets 10-15 snapshots spread over 30 days before now. Pattern is selected based on listing type and status.

```typescript
type SnapshotPattern = 'auction_rising' | 'fixed_stable' | 'fixed_dropped' | 'sold_completed' | 'ended_flat'

function selectPattern(item: SeedItem): SnapshotPattern {
  if (item.status === 'Sold') return 'sold_completed'
  if (item.status === 'Ended') return 'ended_flat'
  if (item.listing_type === 'FixedPrice') {
    return rng.next() < 0.3 ? 'fixed_dropped' : 'fixed_stable'
  }
  if (item.listing_type === 'AuctionWithBIN') {
    return rng.next() < 0.2 ? 'fixed_dropped' : 'auction_rising'
  }
  return 'auction_rising'
}
```

**Pattern: `auction_rising`**

Simulates a standard eBay auction. Price and bid count escalate monotonically with some jitter. Watcher count climbs and then spikes in final hours.

```typescript
function snapshotsAuctionRising(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const finalPrice = item.current_price
  const finalBids  = item.bid_count
  const finalWatch = item.watcher_count ?? 0
  const spreadDays = rng.between(3, 14)

  for (let i = 0; i < count; i++) {
    const progress  = i / (count - 1)                              // 0..1
    const hoursAgo  = (1 - progress) * spreadDays * 24
    const recordedAt = ago(hoursAgo * HOUR)

    // Exponential-ish price growth curve (slow start, fast end)
    const priceFrac  = 0.15 + 0.85 * Math.pow(progress, 1.5)
    const jitter     = 1 + (rng.next() - 0.5) * 0.04             // ±2%
    const priceCents = Math.max(1, Math.round(finalPrice * priceFrac * jitter))

    const bids      = Math.round(finalBids * Math.pow(progress, 1.2))
    // Watcher spike in last 20% of listing
    const watchFrac = progress < 0.8 ? 0.3 + 0.6 * progress : 0.85 + 0.15 * ((progress - 0.8) / 0.2)
    const watchers  = Math.max(0, Math.round(finalWatch * watchFrac + (rng.next() - 0.5) * 3))

    snapshots.push({ item_id: item.item_id, price_cents: priceCents, shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: recordedAt })
  }
  return snapshots
}
```

**Pattern: `fixed_stable`**

BIN listing with constant price and slowly growing watcher interest.

```typescript
function snapshotsFixedStable(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const spreadDays = rng.between(7, 30)

  for (let i = 0; i < count; i++) {
    const progress   = i / (count - 1)
    const hoursAgo   = (1 - progress) * spreadDays * 24
    const watchers   = Math.max(0, Math.round((item.watcher_count ?? 0) * (0.2 + 0.8 * progress) + (rng.next() - 0.5) * 2))
    snapshots.push({ item_id: item.item_id, price_cents: item.current_price, shipping: item.shipping_cost, watcher_count: watchers, bid_count: 0, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}
```

**Pattern: `fixed_dropped`**

Fixed-price listing with 1-2 price reduction events. Watchers spike briefly after each drop.

```typescript
function snapshotsFixedDropped(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const spreadDays = rng.between(7, 21)
  // Original price was 10-25% higher
  const originalPrice = Math.round(item.current_price * (1.10 + rng.next() * 0.15))
  // Drop happens at a random snapshot between 30-70% through the history
  const dropAt = Math.floor(rng.between(0.3, 0.7) * count)

  for (let i = 0; i < count; i++) {
    const progress  = i / (count - 1)
    const hoursAgo  = (1 - progress) * spreadDays * 24
    const price     = i < dropAt ? originalPrice : item.current_price
    // Watcher spike for 2 snapshots after drop
    const inSpike   = i >= dropAt && i < dropAt + 2
    const baseWatch = item.watcher_count ?? 0
    const watchers  = inSpike
      ? Math.round(baseWatch * 1.4 + rng.next() * 5)
      : Math.max(0, Math.round(baseWatch * (0.5 + 0.5 * progress)))
    snapshots.push({ item_id: item.item_id, price_cents: price, shipping: item.shipping_cost, watcher_count: watchers, bid_count: 0, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}
```

**Pattern: `sold_completed`**

Auction that completed. Final snapshot shows sold price; post-sale snapshots show 0 watchers and 0 bids.

```typescript
function snapshotsSoldCompleted(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const soldDaysAgo = rng.between(1, 10)
  const auctionDays = rng.between(3, 7)
  const preSaleCount = Math.floor(count * 0.75)

  for (let i = 0; i < count; i++) {
    if (i < preSaleCount) {
      // Pre-sale: rising auction
      const progress  = i / (preSaleCount - 1)
      const hoursAgo  = soldDaysAgo * 24 + (1 - progress) * auctionDays * 24
      const priceFrac = 0.15 + 0.85 * Math.pow(progress, 1.5)
      const bids      = Math.round(item.bid_count * Math.pow(progress, 1.2))
      const watchers  = Math.round((item.watcher_count ?? 0) * (0.3 + 0.7 * progress))
      snapshots.push({ item_id: item.item_id, price_cents: Math.round(item.current_price * priceFrac), shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: ago(hoursAgo * HOUR) })
    } else {
      // Post-sale: zero activity
      const hoursAgo = (soldDaysAgo - ((i - preSaleCount) * 0.5)) * 24
      snapshots.push({ item_id: item.item_id, price_cents: item.current_price, shipping: item.shipping_cost, watcher_count: 0, bid_count: 0, recorded_at: ago(Math.max(1, hoursAgo) * HOUR) })
    }
  }
  return snapshots
}
```

**Pattern: `ended_flat`**

Auction that expired with zero or one bid. Price barely moves.

```typescript
function snapshotsEndedFlat(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const endedDaysAgo = rng.between(1, 14)
  const auctionDays  = rng.between(3, 7)
  const startPrice   = Math.round(item.current_price * rng.between(0.8, 1.0))

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1)
    const hoursAgo = endedDaysAgo * 24 + (1 - progress) * auctionDays * 24
    // Price barely moves; 0 or 1 bids throughout
    const bids     = rng.next() < 0.2 ? 1 : 0
    const watchers = Math.max(0, Math.round(5 * (1 - progress) + (rng.next() - 0.5) * 2))
    snapshots.push({ item_id: item.item_id, price_cents: startPrice, shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}
```

### 2.9 Event Generator

Events are derived from snapshots after they are built. For each item, the event generator inspects the snapshot history and emits events where notable changes occurred.

```typescript
function generateEventsForItem(item: SeedItem, snapshots: SnapshotRow[]): EventRow[] {
  const events: EventRow[] = []
  if (snapshots.length < 2) return events

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]

    // Price drop: fixed-price listings only, >5% decrease
    if (item.listing_type === 'FixedPrice' && curr.price_cents < prev.price_cents) {
      const pct = (prev.price_cents - curr.price_cents) / prev.price_cents
      if (pct > 0.05) {
        events.push({ item_id: item.item_id, event_type: 'price_drop', old_value: String(prev.price_cents), new_value: String(curr.price_cents), created_at: curr.recorded_at })
      }
    }

    // Price increase: auction bid, >10% increase
    if ((item.listing_type === 'Auction' || item.listing_type === 'AuctionWithBIN') && curr.price_cents > prev.price_cents) {
      const pct = (curr.price_cents - prev.price_cents) / prev.price_cents
      if (pct > 0.10) {
        events.push({ item_id: item.item_id, event_type: 'price_increase', old_value: String(prev.price_cents), new_value: String(curr.price_cents), created_at: curr.recorded_at })
      }
    }

    // Watcher spike: >25% jump in watchers in one snapshot interval
    const prevW = prev.watcher_count ?? 0
    const currW = curr.watcher_count ?? 0
    if (prevW > 5 && currW > prevW * 1.25) {
      events.push({ item_id: item.item_id, event_type: 'watcher_spike', old_value: String(prevW), new_value: String(currW), created_at: curr.recorded_at })
    }
  }

  // Sold event for Sold items
  if (item.status === 'Sold') {
    const lastSnap = snapshots[snapshots.length - 1]
    events.push({ item_id: item.item_id, event_type: 'sold', old_value: String(snapshots[0].price_cents), new_value: String(item.current_price), created_at: lastSnap.recorded_at })
  }

  // Expired event for Ended items
  if (item.status === 'Ended') {
    events.push({ item_id: item.item_id, event_type: 'expired', old_value: null, new_value: null, created_at: snapshots[snapshots.length - 1].recorded_at })
  }

  return events
}
```

Events table note: the existing `events` table uses `detected_at` as the column name in the existing `buildEvents()` function in the current seed, but the schema definition uses `created_at`. The implementation should inspect the actual migration SQL to confirm the column name before writing. Based on reading the existing seed code, the insert uses `@detected_at` but the schema migration may differ. Resolve this during implementation and use whichever the schema defines.

---

## 3. Distribution Enforcement

The 1,000 items must hit exact counts. Use a pre-allocation strategy rather than random sampling, to avoid overshoot or undershoot.

### 3.1 Sport Distribution (exact counts)

```typescript
const SPORT_COUNTS: Record<Sport, number> = {
  baseball:   400,   // 40%
  football:   250,   // 25%
  basketball: 200,   // 20%
  hockey:     100,   // 10%
  nonsport:    50,   //  5%
}
```

Build a `sportPool` array of 1,000 sport labels by repeating each sport exactly `count` times, then shuffle with the seeded RNG:

```typescript
function buildSportPool(): Sport[] {
  const pool: Sport[] = []
  for (const [sport, count] of Object.entries(SPORT_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(sport as Sport)
  }
  return rng.shuffle(pool)
}
```

### 3.2 Status Distribution (exact counts)

```typescript
const STATUS_COUNTS = { Active: 600, Sold: 250, Ended: 150 }
```

Same approach: build a 1,000-element array and shuffle.

### 3.3 Listing Type Distribution (exact counts)

```typescript
const LISTING_TYPE_COUNTS = { Auction: 400, FixedPrice: 450, AuctionWithBIN: 150 }
```

Constraint: `Sold` items should be `Auction` or `AuctionWithBIN` only (BIN items rarely sell through eBay's sold mechanism). Enforce this by overriding listing type for `Sold` items that were assigned `FixedPrice` to `Auction`.

### 3.4 Rank Distribution (200 ranked, 800 unranked)

Assign rank to the first 200 items in the final shuffled pool. Ranks are assigned 1..200 in order. This is deterministic given the seeded shuffle.

### 3.5 Price Bucket Distribution (exact counts)

Pre-built from `buildBucketAssignments()` as described in section 2.7. The mandatory 20 items are inserted first and their prices override bucket assignments for those slots.

### 3.6 Combining Distributions

```typescript
function buildGeneratedItems(): SeedItem[] {
  const sportPool       = buildSportPool()           // 1000
  const statusPool      = buildStatusPool()          // 1000
  const listingTypePool = buildListingTypePool()     // 1000
  const bucketPool      = buildBucketAssignments()   // 1000

  const items: SeedItem[] = []

  for (let i = 0; i < 980; i++) {   // 980 generated + 20 mandatory = 1000
    const sport       = sportPool[i]
    const status      = statusPool[i]
    let   listingType = listingTypePool[i]

    // Enforce: Sold items must have Auction or AuctionWithBIN
    if (status === 'Sold' && listingType === 'FixedPrice') listingType = 'Auction'

    const player   = rng.pick(PLAYERS.filter(p => p.sport === sport))
    const set      = rng.pick(SETS[sport])
    const grade    = pickGrade()
    const bucket   = bucketPool[i]
    const price    = generatePrice(bucket, grade)
    const rank     = i < 180 ? i + 21 : null   // slots 0-179 become ranks 21-200 (20 mandatory take 1-20)

    const item = buildSeedItem({ i, sport, status, listingType, player, set, grade, price, rank })
    items.push(item)
  }

  return items
}
```

---

## 4. The 20 Mandatory Items

These items always appear with exact titles and realistic market prices. They occupy ranks 1-20 (all ranked) and their item IDs reuse the existing seed's IDs to avoid breaking any saved test fixtures.

| Rank | item_id (reused from current seed) | Title | Price | Status | Type |
|------|-------------------------------------|-------|-------|--------|------|
| 1 | `v1|225678901234|0` | 2023 Topps Chrome Elly De La Cruz RC Auto /25 PSA 10 | $1,250 | Active | Auction |
| 2 | `v1|334512098765|0` | 1986 Fleer Michael Jordan Rookie #57 BGS 9.5 | $28,500 | Active | Auction |
| 3 | `v1|276543210987|0` | 2024 Bowman Chrome Ethan Salas 1st Auto Gold /50 | $875 (BIN $1,200) | Active | AuctionWithBIN |
| 4 | `v1|185432167890|0` | PSA 10 2001 SP Authentic Tiger Woods RC /900 | $4,500 | Active | FixedPrice |
| 5 | `v1|404876543210|0` | 1993 SP Derek Jeter Foil Rookie #279 PSA 9 | $3,200 | Active | Auction |
| 6 | `v1|156789012345|0` | 2024 Panini Prizm Caitlin Clark Silver RC | $425 | Active | FixedPrice |
| 7 | `v1|512345678901|0` | Vintage 1952 Topps Mickey Mantle #311 SGC 3 | $45,000 | Active | Auction |
| 8 | `v1|298765432109|0` | 2023 Topps Chrome Jasson Dominguez RC Refractor Auto | $340 | Active | Auction |
| 9 | `v1|367890123456|0` | 1997 PMG Kobe Bryant Green /10 BGS 8.5 | $18,750 | Active | FixedPrice |
| 10 | `v1|445678901234|0` | 2024 Topps Series 1 Paul Skenes RC SP #US300 | $89.99 | Active | FixedPrice |
| 11 | `v1|523456789012|0` | Sealed 2003-04 Upper Deck Exquisite Collection Box | $125,000 | Active | Auction |
| 12 | `v1|601234567890|0` | 2020 Panini National Treasures Justin Herbert RPA /99 | $2,100 | Active | Auction |
| 13 | `v1|678901234567|0` | 1989 Upper Deck Ken Griffey Jr Rookie #1 PSA 10 | $2,800 | Active | FixedPrice |
| 14 | `v1|756789012345|0` | 2023 Topps Bowman Chrome Victor Wembanyama RC Auto | $4,200 | Active | Auction |
| 15 | `v1|834567890123|0` | 2022 Panini Prizm Patrick Mahomes Silver PSA 10 | $1,800 | Active | FixedPrice |
| 16 | `v1|912345678901|0` | 1999 Pokemon Base Set Charizard Holo 1st Ed BGS 9 | $8,500 | Active | FixedPrice |
| 17 | `v1|190123456789|0` | 2023 Bowman Draft Connor Bedard RC Auto Red /5 | $3,600 | Active | Auction |
| 18 | `v1|268901234567|0` | 2024 Panini Prizm Caleb Williams Silver RC | $280 | Active | FixedPrice |
| 19 | `v1|478901234567|0` | 2023 Bowman Chrome Victor Wembanyama 1st RC Auto | $3,400 | Sold | Auction |
| 20 | `v1|589012345678|0` | 1986-87 Fleer Basketball Complete Set PSA Graded | $52,000 | Sold | Auction |

Items 19-20 (Sold) have no rank (`rank = null` in DB).

**Implementation note**: mandatory items have hardcoded `SeedItem` objects identical in structure to the current seed. They are prepended to the full item list before the generated items. The `buildMandatoryItems()` function returns the exact same data as lines 59-525 of the current seed (with ranks 1-18 for active items, null for 19-20) with no changes except that item_ids 13-18 are new IDs added here.

---

## 5. Seller Pool

50 seller IDs with varied feedback scores, clustered by sport specialty:

```typescript
const SELLERS: Array<{ id: string; feedback: number; specialty: Sport | 'multi' }> = [
  // High-volume power sellers
  { id: 'heritage_cards_usa',    feedback: 34521, specialty: 'multi'      },
  { id: 'pwcc_marketplace',      feedback: 89234, specialty: 'multi'      },
  { id: 'goldin_auctions',       feedback: 45678, specialty: 'multi'      },
  { id: 'sage_collectibles',     feedback: 23456, specialty: 'multi'      },
  { id: 'hall_of_fame_cards',    feedback: 22456, specialty: 'basketball' },
  // Baseball specialists
  { id: 'waxbreaks_elite',       feedback:  4823, specialty: 'baseball'   },
  { id: 'prospect_kings',        feedback:  2341, specialty: 'baseball'   },
  { id: 'steelcity_cards',       feedback:  9823, specialty: 'baseball'   },
  { id: 'bronxbomber_cards',     feedback:  1892, specialty: 'baseball'   },
  { id: 'nyyanks_collector',     feedback:  5609, specialty: 'baseball'   },
  { id: 'retrobase_cards',       feedback:  2109, specialty: 'baseball'   },
  { id: 'grandpas_attic_cards',  feedback:   876, specialty: 'baseball'   },
  { id: 'seattle_card_king',     feedback:  3210, specialty: 'baseball'   },
  { id: 'ohtani_fanshop',        feedback:  3456, specialty: 'baseball'   },
  { id: 'golfcard_vault',        feedback:  8765, specialty: 'baseball'   },
  { id: 'ultra_rare_wax',        feedback:  2103, specialty: 'baseball'   },
  { id: 'midwest_box_breaks',    feedback:  6712, specialty: 'baseball'   },
  { id: 'diamond_cut_cards',     feedback:  4190, specialty: 'baseball'   },
  // Basketball specialists
  { id: 'vintage_hoops_inc',     feedback: 12450, specialty: 'basketball' },
  { id: 'mamba_vault',           feedback:  6744, specialty: 'basketball' },
  { id: 'hoopscards_daily',      feedback: 15234, specialty: 'basketball' },
  { id: 'dallas_card_co',        feedback:  4567, specialty: 'basketball' },
  { id: 'spurs_card_shop',       feedback:  8901, specialty: 'basketball' },
  { id: 'laker_nation_cards',    feedback:  3782, specialty: 'basketball' },
  { id: 'slam_dunk_collectibles',feedback:  7312, specialty: 'basketball' },
  // Football specialists
  { id: 'gridiron_gems',         feedback:  7812, specialty: 'football'   },
  { id: 'jaxville_sports',       feedback:  1567, specialty: 'football'   },
  { id: 'pigskin_palace',        feedback:  5023, specialty: 'football'   },
  { id: 'nfl_card_vault',        feedback:  8934, specialty: 'football'   },
  { id: 'chiefs_kingdom_cards',  feedback:  2890, specialty: 'football'   },
  { id: 'gridiron_grail_hunter', feedback:  4123, specialty: 'football'   },
  // Hockey specialists
  { id: 'puck_collectibles',     feedback:  6234, specialty: 'hockey'     },
  { id: 'icebreaker_cards',      feedback:  3891, specialty: 'hockey'     },
  { id: 'oilers_card_shop',      feedback:  2145, specialty: 'hockey'     },
  { id: 'maple_leaf_memorabilia',feedback:  7834, specialty: 'hockey'     },
  { id: 'bedard_break_city',     feedback:   923, specialty: 'hockey'     },
  // Non-sport/gaming specialists
  { id: 'pokemon_vault_pro',     feedback: 18923, specialty: 'nonsport'   },
  { id: 'trading_card_haven',    feedback: 11234, specialty: 'nonsport'   },
  { id: 'mtg_power_9_seller',    feedback:  9123, specialty: 'nonsport'   },
  { id: 'yugioh_king',           feedback:  6789, specialty: 'nonsport'   },
  { id: 'galaxy_toy_collectibles',feedback: 3456, specialty: 'nonsport'   },
  // Mid-tier generalists
  { id: 'cardboard_dreams_shop', feedback:  4512, specialty: 'multi'      },
  { id: 'the_card_cellar',       feedback:  3901, specialty: 'multi'      },
  { id: 'collectible_kingdom',   feedback:  8234, specialty: 'multi'      },
  { id: 'vintage_sports_emporium',feedback: 5678, specialty: 'multi'      },
  // Smaller / newer sellers
  { id: 'hometown_breaks_llc',   feedback:   412, specialty: 'multi'      },
  { id: 'flip_or_flop_cards',    feedback:   289, specialty: 'multi'      },
  { id: 'sunday_flea_market',    feedback:   156, specialty: 'multi'      },
  { id: 'side_hustle_cards',     feedback:    67, specialty: 'multi'      },
  { id: 'new_collector_2024',    feedback:    12, specialty: 'multi'      },
]
```

Seller selection: prefer sport-matched sellers with 70% probability, pick any seller otherwise:

```typescript
function pickSeller(sport: Sport): typeof SELLERS[0] {
  const matched = SELLERS.filter(s => s.specialty === sport || s.specialty === 'multi')
  const exact   = SELLERS.filter(s => s.specialty === sport)
  if (exact.length > 0 && rng.next() < 0.7) return rng.pick(exact)
  return rng.pick(matched)
}
```

---

## 6. Image URL Strategy

Real eBay image URLs require valid authentication and item IDs. For seed data, use sport-specific Unsplash source images or a consistent placeholder CDN URL pattern.

**Strategy**: Use a set of 10-15 real sports card image URLs from Wikimedia Commons or a public CDN (images that will not disappear). The current seed uses a single placeholder eBay image. The redesigned seed maintains this approach but maps sport to a sport-specific placeholder color/icon.

```typescript
const IMAGE_BY_SPORT: Record<Sport, string> = {
  baseball:   'https://placehold.co/225x225/1e3a5f/ffffff?text=Baseball',
  football:   'https://placehold.co/225x225/2d4a1e/ffffff?text=Football',
  basketball: 'https://placehold.co/225x225/8b2500/ffffff?text=Basketball',
  hockey:     'https://placehold.co/225x225/003366/ffffff?text=Hockey',
  nonsport:   'https://placehold.co/225x225/4a1e8b/ffffff?text=TCG',
}
```

`placehold.co` is a stable, free image placeholder service that returns simple colored PNG squares with text. These work reliably offline and never break. The URL encodes the sport directly making it visually distinguishable in the UI.

---

## 7. Pagination API Changes

### 7.1 New DB Query: `getUnrankedPage`

Add to `src/lib/db/items.ts`:

```typescript
export interface UnrankedPage {
  items: WatchlistItem[]
  total: number
}

export function getUnrankedPage(opts: {
  offset: number
  limit: number
  status?: ListingStatus
  search?: string
}): UnrankedPage {
  const db = getDb()
  const conditions = ['rank IS NULL']
  const params: any[] = []

  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }
  if (opts.search) {
    conditions.push('title LIKE ?')
    params.push(`%${opts.search}%`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  try {
    const total = (db.prepare(`SELECT COUNT(*) as n FROM items ${where}`).get(...params) as any).n
    const rows  = db.prepare(`SELECT * FROM items ${where} ORDER BY end_time ASC LIMIT ? OFFSET ?`)
                    .all(...params, opts.limit, opts.offset)
    return { items: rows.map(rowToItem), total }
  } catch (err: any) {
    throw new DatabaseError(`Failed to get unranked page: ${err.message}`)
  }
}
```

### 7.2 Updated API Route

`src/app/api/items/route.ts` — modified GET handler:

```typescript
export async function GET(request: NextRequest) {
  try {
    const params  = request.nextUrl.searchParams
    const status  = params.get('status') ?? 'Active'
    const sort    = params.get('sort')   ?? 'rank'
    const dir     = params.get('dir')    ?? 'asc'
    const search  = params.get('search') ?? undefined
    const offset  = parseInt(params.get('offset') ?? '0', 10)
    const limit   = parseInt(params.get('limit')  ?? '50', 10)

    const filters = status === 'All' ? { search } : { status: status as ListingStatus, search }

    // Ranked: always return all (needed for dnd-kit DOM requirement)
    const allItems = getAll(filters)
    const ranked   = allItems
      .filter((i): i is WatchlistItem & { rank: number } => i.rank !== null)
      .sort((a, b) => sort === 'rank' && dir === 'asc' ? a.rank - b.rank : sortBy(a, b, sort, dir))

    // Unranked: paginated
    const { items: unranked, total: unrankedTotal } = getUnrankedPage({
      offset,
      limit: Math.min(limit, 100),   // hard cap at 100 per page
      status: status === 'All' ? undefined : status as ListingStatus,
      search,
    })

    // Status counts from full unfiltered set
    const allForCounts = status === 'All' ? allItems : getAll()
    const counts = {
      active:  allForCounts.filter((i) => i.status === 'Active').length,
      sold:    allForCounts.filter((i) => i.status === 'Sold').length,
      ended:   allForCounts.filter((i) => i.status === 'Ended').length,
      total:   allForCounts.length,
    }

    return routeOk({ ranked, unranked, unrankedTotal, counts })
  } catch (err) {
    return routeError(err)
  }
}
```

**Response shape change** (backward compatible addition):

```typescript
// Before
{ data: { ranked: WatchlistItem[], unranked: WatchlistItem[], counts: {...} } }

// After
{ data: { ranked: WatchlistItem[], unranked: WatchlistItem[], unrankedTotal: number, counts: {...} } }
```

`unrankedTotal` is new. Existing callers that ignore it remain unbroken. The `unranked` array now contains only the current page (up to 50 items). All callers that assumed `unranked` was the full set must be updated to use Load More.

---

## 8. Component Split

### 8.1 Rationale for the Split

dnd-kit's `useSortable` hook registers each row as a draggable in the `DndContext`. With 800 unranked rows each calling `useSortable({ id })`, there are 800 additional ResizeObserver subscriptions, 800 transform state subscriptions, and 800 event listener registrations — all for rows that will never be dragged. The split eliminates these.

Unranked rows also do not need the drag-handle column, reducing DOM complexity per row.

### 8.2 File: `src/components/watchlist/sortable-watchlist-row.tsx`

Rename current `watchlist-row.tsx` to `sortable-watchlist-row.tsx`. Export name becomes `SortableWatchlistRow`. No logic changes beyond the rename.

```typescript
// src/components/watchlist/sortable-watchlist-row.tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
// ... rest identical to current watchlist-row.tsx
export function SortableWatchlistRow({ item }: WatchlistRowProps) { /* ... */ }
```

### 8.3 File: `src/components/watchlist/static-watchlist-row.tsx` (new)

```typescript
'use client'
import Link from 'next/link'
import type { WatchlistItem } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { CountdownCell } from './countdown-cell'
import { PriceCell } from './price-cell'
import { StatusBadge } from './status-badge'
import { WatcherCell } from './watcher-cell'

interface StaticWatchlistRowProps { item: WatchlistItem }

export function StaticWatchlistRow({ item }: StaticWatchlistRowProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)

  return (
    <tr className="border-b border-border hover:bg-raised transition-colors">
      {/* No drag handle td — static rows cannot be dragged */}
      <td className="w-8" />

      {/* Rank — unranked rows show "—" */}
      {visibleColumns.rank && (
        <td className="w-10 px-1 py-1.5 text-center">
          <span className="text-xs text-text-secondary font-mono">—</span>
        </td>
      )}

      {/* Image */}
      {visibleColumns.image && (
        <td className="w-10 px-1 py-1.5">
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded object-cover bg-raised" loading="lazy" />
            : <div className="w-8 h-8 rounded bg-raised" />}
        </td>
      )}

      {/* Title */}
      {visibleColumns.title && (
        <td className="px-2 py-1.5 max-w-[200px] lg:max-w-[300px]">
          <Link href={`/items/${item.id}`} className="text-xs text-text-primary hover:text-accent truncate block" title={item.title}>
            {item.title}
          </Link>
          {item.listingType !== 'FixedPrice' && item.bidCount > 0 && (
            <span className="text-[10px] text-text-secondary">{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>
          )}
        </td>
      )}

      {visibleColumns.price   && <td className="px-2 py-1.5"><PriceCell priceCents={item.currentPrice} /></td>}
      {visibleColumns.delta   && <td className="px-2 py-1.5"><span className="text-xs text-text-secondary">—</span></td>}
      {visibleColumns.watchers && <td className="px-2 py-1.5"><WatcherCell count={item.watcherCount} /></td>}
      {visibleColumns.bidCount && <td className="w-12 px-2 py-1.5 text-center"><span className="text-xs font-mono text-text-primary">{item.bidCount}</span></td>}
      {visibleColumns.timeLeft && <td className="px-2 py-1.5"><CountdownCell endTime={item.endTime} /></td>}
      {visibleColumns.status   && <td className="px-2 py-1.5"><StatusBadge status={item.status} /></td>}
      {visibleColumns.queue    && <td className="w-8 px-1 py-1.5 text-center"><button className="text-sm text-text-secondary hover:text-urgency-caution transition-colors">{item.isInQueue ? '\u2605' : '\u2606'}</button></td>}
    </tr>
  )
}
```

### 8.4 Updated Watchlist Table

`src/components/watchlist/watchlist-table.tsx`:

```typescript
'use client'
import { useState, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { WatchlistItem } from '@/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { useDragRank } from '@/hooks/use-drag-rank'
import { SortableWatchlistRow } from './sortable-watchlist-row'
import { StaticWatchlistRow } from './static-watchlist-row'

interface WatchlistTableProps {
  ranked:        WatchlistItem[]
  unranked:      WatchlistItem[]   // current page only
  unrankedTotal: number            // total unranked matching current filters
  onLoadMore:    () => void
  isLoadingMore: boolean
}

export function WatchlistTable({ ranked, unranked, unrankedTotal, onLoadMore, isLoadingMore }: WatchlistTableProps) {
  const visibleColumns = useWatchlistStore((s) => s.visibleColumns)
  const rankMutation   = useDragRank()
  const colCount       = Object.values(visibleColumns).filter(Boolean).length + 1  // +1 for drag handle col

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const rankedIds = ranked.map((item) => item.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ranked.findIndex((i) => i.id === active.id)
    const newIndex = ranked.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    rankMutation.mutate({ itemId: String(active.id), newRank: newIndex + 1 })
  }

  const headerClass = 'text-[10px] uppercase tracking-wider text-text-secondary font-semibold px-2 py-2 text-left whitespace-nowrap'
  const hasMore = unranked.length < unrankedTotal

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-surface z-10 border-b border-border">
          <tr>
            <th className="w-8" />
            {visibleColumns.rank     && <th className={`w-10 ${headerClass} text-center`}>#</th>}
            {visibleColumns.image    && <th className={`w-10 ${headerClass}`} />}
            {visibleColumns.title    && <th className={headerClass}>Title</th>}
            {visibleColumns.price    && <th className={headerClass}>Price</th>}
            {visibleColumns.delta    && <th className={headerClass}>Delta</th>}
            {visibleColumns.watchers && <th className={headerClass}>Watchers</th>}
            {visibleColumns.bidCount && <th className={`w-12 ${headerClass} text-center`}>Bids</th>}
            {visibleColumns.timeLeft && <th className={headerClass}>Time Left</th>}
            {visibleColumns.status   && <th className={headerClass}>Status</th>}
            {visibleColumns.queue    && <th className="w-8" />}
          </tr>
        </thead>

        {/* Ranked section — dnd-kit, all items in DOM */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={rankedIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {ranked.map((item) => <SortableWatchlistRow key={item.id} item={item} />)}
            </tbody>
          </SortableContext>
        </DndContext>

        {/* Unranked section divider */}
        {(unranked.length > 0 || unrankedTotal > 0) && (
          <tbody>
            <tr>
              <td colSpan={colCount} className="px-4 py-2 text-[10px] uppercase tracking-wider text-text-secondary font-semibold bg-background border-y border-border">
                Unranked ({unrankedTotal.toLocaleString()} items)
              </td>
            </tr>
          </tbody>
        )}

        {/* Unranked rows — static, no DnD hooks */}
        <tbody>
          {unranked.map((item) => <StaticWatchlistRow key={item.id} item={item} />)}
        </tbody>

        {/* Load More row */}
        {hasMore && (
          <tbody>
            <tr>
              <td colSpan={colCount} className="px-4 py-3 text-center border-t border-border">
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="text-xs text-accent hover:text-accent/80 disabled:text-text-secondary transition-colors"
                >
                  {isLoadingMore
                    ? 'Loading...'
                    : `Load more (${unrankedTotal - unranked.length} remaining)`}
                </button>
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  )
}
```

---

## 9. Infinite Scroll / Load More

The design uses **Load More** (button-triggered) rather than infinite scroll (intersection-observer). Rationale:

1. Infinite scroll requires IntersectionObserver and ref-tracking which adds complexity with no significant UX benefit in a collector tool (users scan the list deliberately, not scroll endlessly).
2. Load More is fully keyboard-accessible without additional ARIA work.
3. The current React Query setup can append pages by merging arrays client-side without changing the query key.

### 9.1 State Management

In the parent page component (`src/app/page.tsx` or the watchlist hook):

```typescript
const [unrankedOffset, setUnrankedOffset] = useState(0)
const LIMIT = 50

// Accumulate unranked items across pages
const [accumulatedUnranked, setAccumulatedUnranked] = useState<WatchlistItem[]>([])

const { data, isFetching } = useQuery({
  queryKey: ['watchlist', { status, sort, dir, search, offset: unrankedOffset }],
  queryFn: () => fetchWatchlist({ status, sort, dir, search, offset: unrankedOffset, limit: LIMIT }),
  keepPreviousData: true,
})

// When new page arrives, append to accumulated list
useEffect(() => {
  if (!data) return
  if (unrankedOffset === 0) {
    setAccumulatedUnranked(data.unranked)
  } else {
    setAccumulatedUnranked(prev => [...prev, ...data.unranked])
  }
}, [data, unrankedOffset])

// Reset on filter change
useEffect(() => {
  setUnrankedOffset(0)
  setAccumulatedUnranked([])
}, [status, sort, dir, search])

const handleLoadMore = () => setUnrankedOffset(prev => prev + LIMIT)
```

### 9.2 Query Key Strategy

The query key includes `offset` so React Query caches each page independently. `keepPreviousData: true` prevents the table from flickering while the next page loads.

When filters change (status, sort, dir, search), `unrankedOffset` resets to 0 which produces a new query key and triggers a fresh fetch.

---

## 10. Performance Considerations

### 10.1 SQLite Query Performance with 1,000 Items

Expected row counts after seeding:

| Table | Rows |
|-------|------|
| items | 1,000 |
| price_snapshots | ~12,500 (avg 12.5/item) |
| events | ~3,200 (estimated from snapshot-derived events) |
| **Total** | **~16,700** |

For a SQLite file at this size (typically 5-15 MB), all queries should complete in under 5ms on any modern machine. SQLite is fully embedded and the DB file will be hot in OS page cache after the first request.

**Indexes needed** (verify in migration SQL that these exist):

```sql
-- Already exists via UNIQUE constraint:
CREATE UNIQUE INDEX idx_items_rank ON items(rank) WHERE rank IS NOT NULL;

-- Add if not present:
CREATE INDEX idx_items_status    ON items(status);
CREATE INDEX idx_items_end_time  ON items(end_time);
CREATE INDEX idx_items_rank_null ON items(rank, end_time) WHERE rank IS NULL;
```

The `getUnrankedPage` query uses `WHERE rank IS NULL AND status = ? ORDER BY end_time LIMIT 50 OFFSET ?`. The partial index `idx_items_rank_null` makes this O(log n) on the rank-null subset.

**OFFSET pagination** at page 16 (offset 800) requires SQLite to scan 800 rows before returning 50. For 800 total unranked items this is negligible. If the unranked set grows beyond 5,000 items, consider cursor-based pagination (keyset pagination on `end_time`). Not needed for this feature.

### 10.2 Initial Load Time

The ranked section (200 items) is always fully loaded. Expected serialization time: ~2ms for 200 WatchlistItem objects. The unranked section fetches 50 items. First-page load: ranked(200) + unranked(50) = 250 items total — roughly 12x the current 20-item load. This should remain under 100ms total API response time.

### 10.3 React Rendering at 200 Ranked Rows

dnd-kit's `SortableContext` maintains an array of item IDs. At 200 items, the `useSortable` hook calls per row are 200 (down from a hypothetical 1,000 if unranked rows were also sortable). Each hook has O(1) setup cost. React renders 200 `tr` elements, which is well within React's performant range.

### 10.4 Seeding Time

The seed script inserts ~16,700 rows. With a single outer `db.transaction()` wrapping all inserts, better-sqlite3 achieves roughly 100,000 inserts/second. Total seed time: ~0.2 seconds. The script should complete in under 2 seconds including migrations.

To achieve this, the three bulk inserts (items, snapshots, events) should be structured as:

```typescript
// Prepare once, run many times inside one transaction
const stmtItem     = db.prepare(INSERT_ITEM_SQL)
const stmtSnapshot = db.prepare(INSERT_SNAPSHOT_SQL)
const stmtEvent    = db.prepare(INSERT_EVENT_SQL)

db.transaction(() => {
  for (const item of allItems)     stmtItem.run(item)
  for (const snap of allSnapshots) stmtSnapshot.run(snap)
  for (const ev of allEvents)      stmtEvent.run(ev)
})()
```

### 10.5 Memory Usage During Seeding

Holding 16,700 JavaScript objects in memory simultaneously before inserting is approximately:
- 1,000 SeedItem objects: ~0.5 MB
- 12,500 SnapshotRow objects: ~2 MB
- 3,200 EventRow objects: ~0.5 MB

Total: ~3 MB peak. Not a concern.

---

## 11. File Inventory

### Modified Files

| File | Change |
|------|--------|
| `scripts/seed.ts` | Full rewrite (~600 lines). All existing content replaced. |
| `src/lib/db/items.ts` | Add `getUnrankedPage()` export (~20 lines). Add index SQL comments. |
| `src/app/api/items/route.ts` | Accept `offset`/`limit` params. Call `getUnrankedPage`. Add `unrankedTotal` to response. |
| `src/components/watchlist/watchlist-table.tsx` | Accept `unrankedTotal`, `onLoadMore`, `isLoadingMore` props. Render `SortableWatchlistRow` for ranked, `StaticWatchlistRow` for unranked. Add Load More row. |
| `src/components/watchlist/watchlist-row.tsx` | Rename to `sortable-watchlist-row.tsx`. Export name becomes `SortableWatchlistRow`. |

### New Files

| File | Purpose |
|------|---------|
| `src/components/watchlist/static-watchlist-row.tsx` | Static row without dnd-kit hooks for unranked items. |
| `tests/e2e/seed-integrity.spec.ts` | Validates seeded data counts and distributions. |
| `tests/e2e/pagination.spec.ts` | Tests Load More and filter reset behavior. |

### Files Requiring Caller Updates

Any component importing `WatchlistRow` from `watchlist-row.tsx` must be updated to import `SortableWatchlistRow` from `sortable-watchlist-row.tsx`. Check with:

```bash
grep -r "from.*watchlist-row" src/
```

Currently the only known caller is `watchlist-table.tsx`.

Any component that reads `data.unranked` from the watchlist query and expects it to be the full unranked list must be updated to use `accumulatedUnranked` from the Load More state. Check all `useQuery({ queryKey: ['watchlist'] })` callers.

---

## 12. E2E Test Specs

### 12.1 `tests/e2e/seed-integrity.spec.ts`

Validates that the seeded database has the correct counts and distributions. Calls the items API directly without UI interaction.

```typescript
import { test, expect } from '@playwright/test'

// These tests require a live dev server with seeded DB
// Run: npx tsx scripts/seed.ts && npx next dev
// Then: npx playwright test tests/e2e/seed-integrity.spec.ts

test.describe('Seed Data Integrity', () => {

  test('SI-01: total item count is 1000', async ({ request }) => {
    const resp = await request.get('/api/items?status=All')
    const { data } = await resp.json()
    // ranked + first page of unranked + total
    expect(data.counts.total).toBe(1000)
  })

  test('SI-02: 200 ranked items, 800 unranked', async ({ request }) => {
    const resp = await request.get('/api/items?status=All')
    const { data } = await resp.json()
    expect(data.ranked.length).toBe(200)
    // unrankedTotal should be 800 when status=All (all statuses)
    expect(data.unrankedTotal).toBe(800)
  })

  test('SI-03: status distribution matches targets', async ({ request }) => {
    const resp = await request.get('/api/items?status=All')
    const { data } = await resp.json()
    expect(data.counts.active).toBe(600)
    expect(data.counts.sold).toBe(250)
    expect(data.counts.ended).toBe(150)
    expect(data.counts.total).toBe(1000)
  })

  test('SI-04: mandatory item rank-1 has exact title', async ({ request }) => {
    const resp = await request.get('/api/items?status=All')
    const { data } = await resp.json()
    const rankOne = data.ranked.find((i: any) => i.rank === 1)
    expect(rankOne).toBeDefined()
    expect(rankOne.title).toBe('2023 Topps Chrome Elly De La Cruz RC Auto /25 PSA 10')
  })

  test('SI-05: mandatory item rank-7 (Mantle) has price > $40000', async ({ request }) => {
    const resp = await request.get('/api/items?status=All')
    const { data } = await resp.json()
    const mantle = data.ranked.find((i: any) => i.rank === 7)
    expect(mantle).toBeDefined()
    expect(mantle.currentPrice).toBeGreaterThan(40_000_00)  // $40,000 in cents
  })
})
```

### 12.2 `tests/e2e/pagination.spec.ts`

Tests Load More button behavior and filter-reset behavior with mock API responses.

```typescript
import { test, expect } from '@playwright/test'

// Mock response helpers
function makePaginatedResponse(opts: {
  rankedCount: number
  unrankedPage: number[]   // prices in cents for this page
  unrankedTotal: number
  offset: number
}) {
  const ranked = Array.from({ length: opts.rankedCount }, (_, i) => ({
    id: `v1|${100000 + i}|0`, rank: i + 1, title: `Ranked Card ${i + 1}`,
    currentPrice: 1000, listingType: 'FixedPrice', status: 'Active',
    endTime: new Date(Date.now() + 86400000).toISOString(), bidCount: 0,
    watcherCount: 5, shippingCost: 0, isInQueue: false, notes: null,
    firstSeenAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString(),
    imageUrl: null, listingUrl: null, sellerId: null, sellerFeedback: null,
    buyItNowPrice: null, conditionName: null, timeLeft: null,
  }))
  const unranked = opts.unrankedPage.map((price, i) => ({
    ...ranked[0],
    id: `v1|${200000 + opts.offset + i}|0`,
    rank: null,
    title: `Unranked Card ${opts.offset + i + 1}`,
    currentPrice: price,
  }))
  return {
    data: {
      ranked,
      unranked,
      unrankedTotal: opts.unrankedTotal,
      counts: { active: opts.rankedCount + opts.unrankedTotal, sold: 0, ended: 0, total: opts.rankedCount + opts.unrankedTotal },
    },
  }
}

test.describe('Pagination', () => {

  test('PA-01: initial load shows first 50 unranked items and Load More button', async ({ page }) => {
    const PAGE_1 = makePaginatedResponse({ rankedCount: 5, unrankedPage: Array(50).fill(999), unrankedTotal: 800, offset: 0 })

    await page.route('**/api/items**', (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('offset') === '0' || !url.searchParams.get('offset')) {
        route.fulfill({ json: PAGE_1 })
      } else {
        route.fulfill({ json: PAGE_1 })
      }
    })

    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // Check "800 items" label in unranked section header
    await expect(page.getByText(/Unranked \(800 items\)/)).toBeVisible()

    // Check Load More button shows remaining count
    await expect(page.getByText(/Load more \(750 remaining\)/)).toBeVisible()
  })

  test('PA-02: Load More appends next page to unranked section', async ({ page }) => {
    const PAGE_1 = makePaginatedResponse({ rankedCount: 3, unrankedPage: Array(50).fill(500), unrankedTotal: 120, offset: 0 })
    const PAGE_2 = makePaginatedResponse({ rankedCount: 3, unrankedPage: Array(50).fill(600), unrankedTotal: 120, offset: 50 })

    await page.route('**/api/items**', (route) => {
      const url  = new URL(route.request().url())
      const off  = parseInt(url.searchParams.get('offset') ?? '0', 10)
      route.fulfill({ json: off === 0 ? PAGE_1 : PAGE_2 })
    })

    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    const rowsBefore = await page.locator('tbody tr[class*="border-b"]').count()

    await page.getByText(/Load more/).click()
    await expect(page.getByText('Loading...')).toBeVisible()

    // After load, should have more rows
    await expect(page.getByText(/Load more \(20 remaining\)/)).toBeVisible({ timeout: 5000 })
    const rowsAfter = await page.locator('tbody tr[class*="border-b"]').count()
    expect(rowsAfter).toBeGreaterThan(rowsBefore)
  })

  test('PA-03: changing status filter resets unranked to page 1', async ({ page }) => {
    const ACTIVE = makePaginatedResponse({ rankedCount: 3, unrankedPage: Array(50).fill(500), unrankedTotal: 200, offset: 0 })
    const SOLD   = makePaginatedResponse({ rankedCount: 0, unrankedPage: Array(10).fill(1000), unrankedTotal: 10, offset: 0 })

    await page.route('**/api/items**', (route) => {
      const url    = new URL(route.request().url())
      const status = url.searchParams.get('status') ?? 'Active'
      route.fulfill({ json: status === 'Sold' ? SOLD : ACTIVE })
    })

    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.getByText(/Unranked \(200 items\)/)).toBeVisible()

    // Switch to Sold
    await page.locator('select').first().selectOption('Sold')
    await expect(page.getByText(/Unranked \(10 items\)/)).toBeVisible({ timeout: 5000 })

    // No Load More needed (10 < 50)
    await expect(page.getByText(/Load more/)).not.toBeVisible()
  })

  test('PA-04: ranked section always renders all ranked items (no pagination)', async ({ page }) => {
    // 200 ranked items should all be in DOM
    const FULL = makePaginatedResponse({ rankedCount: 200, unrankedPage: Array(50).fill(100), unrankedTotal: 800, offset: 0 })

    await page.route('**/api/items**', (route) => route.fulfill({ json: FULL }))

    await page.goto('/')
    await expect(page.locator('table')).toBeVisible()

    // All 200 ranked rows present — check by counting rows in the DndContext tbody
    // The DndContext tbody comes before the unranked divider row
    const rankedRows = await page.locator('table > tbody').first().locator('tr').count()
    expect(rankedRows).toBe(200)
  })
})
```

### 12.3 `tests/e2e/drag-reorder.spec.ts` Update

The existing `drag-reorder.spec.ts` uses `mockWatchlistResponse` which does not include `unrankedTotal`. Update `helpers/mock-data.ts` to add `unrankedTotal: 8` (matching current 8 unranked mock items). No other changes required — the table component will handle a missing Load More button gracefully when all pages are loaded.

---

## 13. Effort Estimate

| Task | Effort |
|------|--------|
| Rewrite `scripts/seed.ts` (player pool, brand/set pools, generators, distributions, mandatory items, seller pool, image strategy, snapshot patterns, event generator) | 2.0 hr |
| Add `getUnrankedPage` to `src/lib/db/items.ts` + update API route | 0.5 hr |
| Create `static-watchlist-row.tsx` + rename `watchlist-row.tsx` + update `watchlist-table.tsx` props and Load More | 0.5 hr |
| Add Load More state management to parent page component | 0.25 hr |
| Write E2E tests (`seed-integrity.spec.ts`, `pagination.spec.ts`) + update `mock-data.ts` | 0.5 hr |
| Manual QA: run seed, verify counts, test Load More, test drag-reorder with 200 ranked | 0.25 hr |
| **Total** | **~4.0 hr** |

---

## 14. Implementation Order

Execute tasks in this order to keep the app runnable after each step:

1. Rewrite `scripts/seed.ts` — does not affect running app, can be verified independently with `npx tsx scripts/seed.ts`.
2. Add `getUnrankedPage` to `src/lib/db/items.ts` — purely additive, does not break existing `getAll` callers.
3. Update `src/app/api/items/route.ts` — adds `unrankedTotal` to response (additive) and paginates unranked (breaking for callers that expect full unranked list).
4. Rename `watchlist-row.tsx` → `sortable-watchlist-row.tsx` and update import in `watchlist-table.tsx` — must be done atomically.
5. Create `static-watchlist-row.tsx`.
6. Update `watchlist-table.tsx` to accept new props and render split rows.
7. Update parent page component with Load More state.
8. Update `mock-data.ts` and write new E2E tests.

Step 3 and Steps 4-7 have a dependency: the API response shape change (step 3) must be accompanied by the table component update (steps 4-7) in the same deployment. In development this is a single local change so no coordination is required.

---

## 15. Open Questions for Implementation

1. **Events table column name**: The existing seed inserts events with `@detected_at` but the schema CREATE TABLE statement uses `created_at`. Verify against the migration SQL (`src/lib/db/migrate.ts`) before writing the event insert in the new seed.

2. **`useDragRank` optimistic update**: The hook merges `old.ranked` and `old.unranked` from the query cache. After the pagination change, `old.unranked` will be a page (50 items) not the full list. The optimistic update logic in `use-drag-rank.ts` at line 36 (`const allItems = [...old.ranked, ...old.unranked]`) will work correctly for ranked-to-ranked moves. For unranked-to-ranked moves (dragging an unranked item into ranked), the item may not be in the current unranked page. This is an edge case that the current UI does not expose (unranked rows do not have drag handles in `StaticWatchlistRow`), so no change is needed.

3. **Filter reset on search debounce**: The Load More offset must reset when the search term changes. If search is debounced (e.g., 300ms), the `useEffect` dependency on `search` should use the debounced value, not the raw input value, to avoid resetting the offset on every keypress.

4. **Indexes in migration**: Verify that `idx_items_status` and an index on `(rank, end_time)` exist in `src/lib/db/migrate.ts`. If not, add them in a new migration step before the seed runs.
